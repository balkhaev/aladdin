"""Training endpoints."""

import logging
import time
from pathlib import Path

import torch
from fastapi import APIRouter, HTTPException

from src.api.schemas import TrainRequest, TrainResponse
from src.config import get_settings
from src.data.clickhouse_loader import ClickHouseLoader
from src.features.engineering import FeatureEngineer
from src.features.normalization import Normalizer, create_sequences
from src.models.lstm import create_model
from src.training.trainer import Trainer, create_data_loaders
from src.utils.device import get_device

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post("/train", response_model=TrainResponse)
async def train_model(request: TrainRequest):
    """
    Train a new ML model.

    This endpoint:
    1. Loads historical data from ClickHouse
    2. Computes technical features
    3. Normalizes data
    4. Creates train/val/test splits
    5. Trains model with early stopping
    6. Evaluates on test set
    7. Saves model and metadata
    """
    try:
        logger.info(f"Training request: {request.model_dump()}")
        start_time = time.time()

        # 1. Load data
        logger.info(f"Loading data for {request.symbol}")
        loader = ClickHouseLoader()
        df = loader.load_recent_candles(
            symbol=request.symbol,
            timeframe="1m",
            lookback_days=request.lookback_days,
        )

        if len(df) < 1000:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data: {len(df)} candles (minimum 1000 required)",
            )

        # 2. Feature engineering
        logger.info("Computing features")
        df_features = FeatureEngineer.compute_all_features(df)

        # Select features (exclude timestamp and OHLCV raw data)
        feature_cols = [
            col
            for col in df_features.columns
            if col not in ["timestamp", "open", "high", "low", "close", "volume"]
        ]
        X_data = df_features[feature_cols].values
        y_data = df_features["close"].values

        logger.info(f"Feature shape: {X_data.shape}, Target shape: {y_data.shape}")

        # 3. Normalization
        logger.info(f"Normalizing data with {request.normalization} scaler")
        X_normalizer = Normalizer(method=request.normalization)
        X_normalized = X_normalizer.fit_transform(X_data)

        y_normalizer = Normalizer(method=request.normalization)
        y_normalized = y_normalizer.fit_transform(y_data.reshape(-1, 1)).flatten()

        # 4. Create sequences
        logger.info(f"Creating sequences (length={request.sequence_length})")
        X_sequences, y_targets = create_sequences(
            data=X_normalized,
            sequence_length=request.sequence_length,
            target_column=0,  # Will be replaced with normalized close price
            forecast_horizon=1,
        )

        # Replace first feature with normalized close price
        y_close_normalized = y_normalized[request.sequence_length :]
        y_targets = torch.FloatTensor(y_close_normalized[: len(X_sequences)])

        # 5. Train/Val/Test split (70/15/15)
        n = len(X_sequences)
        train_size = int(n * 0.7)
        val_size = int(n * 0.15)

        X_train = X_sequences[:train_size]
        y_train = y_targets[:train_size]
        X_val = X_sequences[train_size : train_size + val_size]
        y_val = y_targets[train_size : train_size + val_size]
        X_test = X_sequences[train_size + val_size :]
        y_test = y_targets[train_size + val_size :]

        logger.info(
            f"Split: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}"
        )

        # 6. Create model
        device = get_device(settings.device)
        input_size = X_sequences.shape[2]

        model = create_model(
            model_type=request.model_type,
            input_size=input_size,
            hidden_size=request.hidden_size,
            num_layers=request.num_layers,
            output_size=1,
            dropout=request.dropout,
            bidirectional=request.bidirectional,
        )

        # 7. Create data loaders
        train_loader, val_loader = create_data_loaders(
            X_train, y_train, X_val, y_val, batch_size=request.batch_size
        )

        # 8. Train
        logger.info("Starting training")
        trainer = Trainer(
            model=model,
            device=device,
            learning_rate=request.learning_rate,
        )

        # Create model directory
        model_dir = settings.model_cache_dir / request.symbol
        model_dir.mkdir(parents=True, exist_ok=True)

        training_history = trainer.train(
            train_loader=train_loader,
            val_loader=val_loader,
            epochs=request.epochs,
            early_stopping_patience=settings.early_stopping_patience,
            checkpoint_dir=model_dir,
        )

        # 9. Evaluate on test set
        test_loader = torch.utils.data.DataLoader(
            torch.utils.data.TensorDataset(X_test, y_test),
            batch_size=request.batch_size,
            shuffle=False,
        )
        test_metrics = trainer.evaluate(test_loader)

        # 10. Save model and metadata
        model_path = model_dir / f"{request.model_type.lower()}_model.pt"
        normalizer_X_path = model_dir / "normalizer_X.json"
        normalizer_y_path = model_dir / "normalizer_y.json"
        metadata_path = model_dir / "metadata.json"

        # Save model
        torch.save(
            {
                "model_state_dict": model.state_dict(),
                "model_config": {
                    "model_type": request.model_type,
                    "input_size": input_size,
                    "hidden_size": request.hidden_size,
                    "num_layers": request.num_layers,
                    "dropout": request.dropout,
                    "bidirectional": request.bidirectional,
                },
            },
            model_path,
        )

        # Save normalizers
        X_normalizer.save(normalizer_X_path)
        y_normalizer.save(normalizer_y_path)

        # Save metadata
        import json

        metadata = {
            "symbol": request.symbol,
            "model_type": request.model_type,
            "version": "1.0.0",
            "trained_at": int(time.time() * 1000),
            "training_params": request.model_dump(),
            "feature_columns": feature_cols,
            "sequence_length": request.sequence_length,
            "metrics": test_metrics,
            "training_history": {
                "epochs": training_history["epochs"],
                "best_val_loss": training_history["best_val_loss"],
                "training_time": training_history["training_time"],
            },
        }

        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        total_time = time.time() - start_time

        logger.info(
            f"Training completed in {total_time:.2f}s - "
            f"Test MAE: {test_metrics['mae']:.6f}, "
            f"Directional Accuracy: {test_metrics['directional_accuracy']:.2f}%"
        )

        return {
            "success": True,
            "data": {
                "symbol": request.symbol,
                "model_type": request.model_type,
                "model_path": str(model_path),
                "training_time": total_time,
                "epochs_trained": training_history["epochs"],
                "metrics": test_metrics,
                "model_size_mb": model_path.stat().st_size / (1024 * 1024),
            },
            "timestamp": int(time.time() * 1000),
        }

    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

