"""Ensemble prediction service."""

import json
import logging
from pathlib import Path

import numpy as np
import torch

from src.config import get_settings
from src.data.clickhouse_loader import ClickHouseLoader
from src.features.engineering import FeatureEngineer
from src.features.normalization import Normalizer
from src.models.lstm import create_model
from src.utils.device import get_device

logger = logging.getLogger(__name__)
settings = get_settings()


class EnsembleService:
    """Ensemble predictions from multiple models."""

    def __init__(self):
        """Initialize service."""
        self.loader = ClickHouseLoader()
        self.device = get_device(settings.device)

    async def predict(
        self,
        symbol: str,
        horizon: str,
        strategy: str = "WEIGHTED_AVERAGE",
    ) -> dict:
        """
        Make ensemble predictions.

        Args:
            symbol: Trading pair symbol
            horizon: Prediction horizon
            strategy: Ensemble strategy (WEIGHTED_AVERAGE, VOTING, STACKING)

        Returns:
            Ensemble prediction result
        """
        logger.info(f"Ensemble prediction: {symbol} {horizon} ({strategy})")

        # Load all available models for this symbol
        models = self._load_available_models(symbol)

        if len(models) == 0:
            raise ValueError(f"No models found for {symbol}")

        logger.info(f"Using {len(models)} models for ensemble")

        # Get predictions from each model
        predictions = []
        weights = []

        for model_info in models:
            try:
                pred = await self._get_model_prediction(model_info, symbol, horizon)
                predictions.append(pred)

                # Weight based on model accuracy
                weight = model_info["metadata"].get("metrics", {}).get(
                    "directional_accuracy", 0.5
                )
                weights.append(weight)

            except Exception as e:
                logger.warning(f"Failed to get prediction from model: {e}")

        if len(predictions) == 0:
            raise ValueError("No valid predictions obtained")

        # Combine predictions based on strategy
        if strategy == "WEIGHTED_AVERAGE":
            combined = self._weighted_average(predictions, weights)
        elif strategy == "VOTING":
            combined = self._voting(predictions)
        else:  # STACKING (fallback to weighted average)
            combined = self._weighted_average(predictions, weights)

        return combined

    def _load_available_models(self, symbol: str) -> list[dict]:
        """Load all available models for symbol."""
        model_dir = settings.model_cache_dir / symbol

        if not model_dir.exists():
            return []

        models = []

        # Load metadata
        metadata_path = model_dir / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path) as f:
                metadata = json.load(f)

            # Check for LSTM model
            lstm_path = model_dir / "lstm_model.pt"
            if lstm_path.exists():
                models.append({"type": "LSTM", "path": lstm_path, "metadata": metadata})

            # Check for GRU model (if exists)
            gru_path = model_dir / "gru_model.pt"
            if gru_path.exists():
                models.append({"type": "GRU", "path": gru_path, "metadata": metadata})

        return models

    async def _get_model_prediction(
        self, model_info: dict, symbol: str, horizon: str
    ) -> dict:
        """Get prediction from a single model."""
        metadata = model_info["metadata"]
        model_type = model_info["type"]

        # Load model
        model_config = metadata.get("model_config", {})
        model = create_model(
            model_type=model_type,
            input_size=model_config.get("input_size", len(metadata["feature_columns"])),
            hidden_size=model_config.get("hidden_size", 128),
            num_layers=model_config.get("num_layers", 2),
            output_size=1,
            dropout=model_config.get("dropout", 0.2),
            bidirectional=model_config.get("bidirectional", False),
        )

        # Load weights
        checkpoint = torch.load(model_info["path"], map_location=self.device)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()

        # Load normalizers
        model_dir = model_info["path"].parent
        X_normalizer = Normalizer.load(model_dir / "normalizer_X.json")
        y_normalizer = Normalizer.load(model_dir / "normalizer_y.json")

        # Get recent data
        df = self.loader.load_recent_candles(symbol=symbol, timeframe="1m", lookback_days=7)

        df_features = FeatureEngineer.compute_all_features(df)

        # Extract features
        feature_cols = metadata["feature_columns"]
        X_data = df_features[feature_cols].values

        # Normalize
        X_normalized = X_normalizer.transform(X_data)

        # Create sequence
        sequence_length = metadata["sequence_length"]
        recent_sequence = X_normalized[-sequence_length:]
        X_tensor = torch.FloatTensor(recent_sequence).unsqueeze(0).to(self.device)

        # Predict
        with torch.no_grad():
            prediction_normalized = model(X_tensor).cpu().numpy()

        # Denormalize
        prediction = y_normalizer.inverse_transform(prediction_normalized.reshape(-1, 1))[0][0]

        return {
            "model_type": model_type,
            "predicted_price": float(prediction),
            "accuracy": metadata.get("metrics", {}).get("directional_accuracy", 0.5),
        }

    def _weighted_average(self, predictions: list[dict], weights: list[float]) -> dict:
        """Combine predictions using weighted average."""
        # Normalize weights
        weights = np.array(weights)
        weights = weights / weights.sum()

        # Weighted average of predictions
        predicted_prices = [p["predicted_price"] for p in predictions]
        combined_price = np.average(predicted_prices, weights=weights)

        # Calculate confidence based on agreement
        std = np.std(predicted_prices)
        confidence = 1.0 / (1.0 + std / combined_price) if combined_price > 0 else 0.5

        return {
            "ensemble_strategy": "WEIGHTED_AVERAGE",
            "predicted_price": float(combined_price),
            "confidence": float(confidence),
            "models_used": len(predictions),
            "individual_predictions": predictions,
        }

    def _voting(self, predictions: list[dict]) -> dict:
        """Combine predictions using voting (majority direction)."""
        # Get current price (from first prediction context)
        predicted_prices = [p["predicted_price"] for p in predictions]
        median_price = np.median(predicted_prices)

        # Vote: how many predict up vs down
        # For simplicity, use median
        votes_up = sum(1 for p in predicted_prices if p > median_price)
        votes_down = len(predicted_prices) - votes_up

        # Confidence based on vote strength
        confidence = max(votes_up, votes_down) / len(predictions)

        return {
            "ensemble_strategy": "VOTING",
            "predicted_price": float(median_price),
            "confidence": float(confidence),
            "models_used": len(predictions),
            "votes": {"up": votes_up, "down": votes_down},
            "individual_predictions": predictions,
        }

