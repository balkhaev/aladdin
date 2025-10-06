"""Prediction endpoints - Compatible with TypeScript ml-service."""

import json
import logging
import time
from pathlib import Path

import numpy as np
import torch
from fastapi import APIRouter, HTTPException

from src.api.schemas import (
    BatchPredictionRequest,
    EnsemblePredictionRequest,
    PredictionRequest,
)
from src.config import get_settings
from src.data.clickhouse_loader import ClickHouseLoader
from src.features.engineering import FeatureEngineer
from src.features.normalization import Normalizer
from src.models.lstm import create_model
from src.services.ensemble import EnsembleService
from src.utils.device import get_device

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


HORIZON_TO_STEPS = {
    "1h": 60,  # 60 minutes
    "4h": 240,  # 4 hours in minutes
    "1d": 1440,  # 24 hours in minutes
    "7d": 10080,  # 7 days in minutes
}


@router.post("/predict")
async def predict_price(request: PredictionRequest):
    """
    Price prediction (Hybrid/LSTM) - Compatible with TypeScript POST /api/ml/predict.

    Returns same structure as TypeScript version.
    """
    try:
        logger.info(f"Prediction request: {request.model_dump()}")
        start_time = time.time()

        # Load model and metadata
        model_dir = settings.model_cache_dir / request.symbol
        if not model_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"No trained model found for {request.symbol}",
            )

        metadata_path = model_dir / "metadata.json"
        with open(metadata_path) as f:
            metadata = json.load(f)

        # Load model
        device = get_device(settings.device)
        model_type = metadata["model_type"]
        model_config = metadata.get("model_config", {})

        model = create_model(
            model_type=model_config.get("model_type", model_type),
            input_size=model_config.get("input_size", len(metadata["feature_columns"])),
            hidden_size=model_config.get("hidden_size", 128),
            num_layers=model_config.get("num_layers", 2),
            output_size=1,
            dropout=model_config.get("dropout", 0.2),
            bidirectional=model_config.get("bidirectional", False),
        )

        # Load weights
        model_path = model_dir / f"{model_type.lower()}_model.pt"
        checkpoint = torch.load(model_path, map_location=device)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()

        # Load normalizers
        X_normalizer = Normalizer.load(model_dir / "normalizer_X.json")
        y_normalizer = Normalizer.load(model_dir / "normalizer_y.json")

        # Fetch data
        loader = ClickHouseLoader()
        df = loader.load_recent_candles(
            symbol=request.symbol,
            timeframe="1m",
            lookback_days=7,
        )

        # Compute features
        df_features = FeatureEngineer.compute_all_features(df)
        feature_cols = metadata["feature_columns"]
        X_data = df_features[feature_cols].values

        # Normalize
        X_normalized = X_normalizer.transform(X_data)

        # Create sequence
        sequence_length = metadata["sequence_length"]
        recent_sequence = X_normalized[-sequence_length:]
        X_tensor = torch.FloatTensor(recent_sequence).unsqueeze(0).to(device)

        # Predict
        with torch.no_grad():
            prediction_normalized = model(X_tensor).cpu().numpy()

        # Denormalize
        prediction = y_normalizer.inverse_transform(prediction_normalized.reshape(-1, 1))[0][0]

        # Get current price
        current_price = df_features["close"].iloc[-1]

        # Calculate confidence interval
        returns = df_features["close"].pct_change().dropna()
        volatility = returns.std()

        z_scores = {0.80: 1.28, 0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
        z_score = z_scores.get(request.confidence, 1.96)

        steps = HORIZON_TO_STEPS[request.horizon]
        time_factor = np.sqrt(steps / 60)
        margin = prediction * volatility * z_score * time_factor

        prediction_time = int(time.time() * 1000)

        # Build response - COMPATIBLE WITH TYPESCRIPT
        result = {
            "symbol": request.symbol,
            "horizon": request.horizon,
            "predictions": [
                {
                    "timestamp": prediction_time + steps * 60 * 1000,
                    "predictedPrice": float(prediction),
                    "lowerBound": float(prediction - margin),
                    "upperBound": float(prediction + margin),
                    "confidence": request.confidence,
                }
            ],
            "features": {
                "technicalIndicators": {
                    "rsi": float(df_features["rsi_14"].iloc[-1]),
                    "macd": float(df_features["macd"].iloc[-1]),
                    "ema20": float(df_features["ema_20"].iloc[-1]),
                    "ema50": float(df_features["ema_50"].iloc[-1]),
                },
                "onChainMetrics": {},
                "sentimentScore": 0.0,
                "marketRegime": "SIDEWAYS",  # TODO: integrate regime detection
                "volatility": float(volatility),
                "momentum": float((prediction - current_price) / current_price),
            },
            "modelInfo": {
                "version": metadata.get("version", "1.0.0"),
                "lastTrained": metadata.get("trained_at", prediction_time),
                "accuracy": metadata.get("metrics", {}).get("directional_accuracy", 0.5) / 100,
                "confidence": request.confidence,
            },
            "generatedAt": prediction_time,
        }

        return {
            "success": True,
            "data": result,
            "timestamp": prediction_time,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict/lstm")
async def predict_lstm(request: PredictionRequest):
    """
    LSTM prediction - Compatible with TypeScript POST /api/ml/predict/lstm.

    Same as /predict but explicitly for LSTM models.
    """
    return await predict_price(request)


@router.post("/predict/batch")
async def predict_batch(request: BatchPredictionRequest):
    """
    Batch predictions - Compatible with TypeScript POST /api/ml/predict/batch.
    """
    try:
        logger.info(f"Batch prediction for {len(request.symbols)} symbols")

        results = []
        for symbol in request.symbols:
            try:
                pred_request = PredictionRequest(
                    symbol=symbol,
                    horizon=request.horizon,
                    confidence=request.confidence,
                    includeSentiment=request.includeSentiment,
                )
                result = await predict_price(pred_request)
                results.append(result["data"])
            except Exception as e:
                logger.warning(f"Failed to predict {symbol}: {e}")

        return {
            "success": True,
            "data": {
                "predictions": results,
                "count": len(results),
                "includeSentiment": request.includeSentiment,
            },
            "timestamp": int(time.time() * 1000),
        }

    except Exception as e:
        logger.error(f"Batch prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict/ensemble")
async def predict_ensemble(request: EnsemblePredictionRequest):
    """
    Ensemble prediction - Compatible with TypeScript POST /api/ml/predict/ensemble.
    """
    try:
        ensemble_service = EnsembleService()
        result = await ensemble_service.predict(
            symbol=request.symbol,
            horizon=request.horizon,
            strategy=request.strategy,
        )

        # Get current price for response
        loader = ClickHouseLoader()
        df = loader.load_recent_candles(symbol=request.symbol, timeframe="1m", lookback_days=1)
        current_price = df["close"].iloc[-1]

        # Calculate confidence interval
        predicted_price = result["predicted_price"]
        confidence = result["confidence"]

        # Simple margin based on confidence
        margin_pct = (1 - confidence) * 0.05  # 5% max margin
        margin = predicted_price * margin_pct

        prediction_time = int(time.time() * 1000)
        steps = HORIZON_TO_STEPS[request.horizon]

        response = {
            "symbol": request.symbol,
            "horizon": request.horizon,
            "strategy": request.strategy,
            "includeSentiment": request.includeSentiment,
            "predictions": [
                {
                    "timestamp": prediction_time + steps * 60 * 1000,
                    "predictedPrice": predicted_price,
                    "lowerBound": predicted_price - margin,
                    "upperBound": predicted_price + margin,
                    "confidence": confidence,
                }
            ],
            "ensemble": {
                "models_used": result["models_used"],
                "individual_predictions": result.get("individual_predictions", []),
            },
        }

        return {
            "success": True,
            "data": response,
            "timestamp": prediction_time,
        }

    except Exception as e:
        logger.error(f"Ensemble prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
