"""Model management endpoints - Compatible with TypeScript ml-service."""

import json
import logging
import shutil
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException

from src.config import get_settings

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.get("/models")
async def list_models():
    """
    List all models - Compatible with TypeScript GET /api/ml/models.
    """
    try:
        models_dir = settings.model_cache_dir

        if not models_dir.exists():
            return {
                "success": True,
                "data": {"models": [], "count": 0},
                "timestamp": int(time.time() * 1000),
            }

        models = []

        for symbol_dir in models_dir.iterdir():
            if not symbol_dir.is_dir():
                continue

            metadata_path = symbol_dir / "metadata.json"
            if not metadata_path.exists():
                continue

            try:
                with open(metadata_path) as f:
                    metadata = json.load(f)

                # Convert to TypeScript format
                models.append(
                    {
                        "symbol": metadata["symbol"],
                        "modelType": metadata["model_type"],
                        "version": metadata["version"],
                        "trainedAt": metadata["trained_at"],
                        "accuracy": metadata.get("metrics", {}).get(
                            "directional_accuracy", 0
                        ),
                        "metrics": metadata.get("metrics", {}),
                    }
                )
            except Exception as e:
                logger.warning(f"Failed to load metadata for {symbol_dir.name}: {e}")

        return {
            "success": True,
            "data": {"models": models, "count": len(models)},
            "timestamp": int(time.time() * 1000),
        }

    except Exception as e:
        logger.error(f"Failed to list models: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/{symbol}/stats")
async def get_model_stats(symbol: str):
    """
    Get model statistics - Compatible with TypeScript GET /api/ml/models/:symbol/stats.
    """
    try:
        model_dir = settings.model_cache_dir / symbol

        if not model_dir.exists():
            raise HTTPException(status_code=404, detail=f"Model not found for {symbol}")

        metadata_path = model_dir / "metadata.json"
        if not metadata_path.exists():
            raise HTTPException(status_code=404, detail=f"Metadata not found for {symbol}")

        with open(metadata_path) as f:
            metadata = json.load(f)

        # Convert to TypeScript format
        metrics = metadata.get("metrics", {})

        return {
            "success": True,
            "data": {
                "symbol": symbol,
                "modelType": metadata["model_type"],
                "version": metadata["version"],
                "trainedAt": metadata["trained_at"],
                "accuracy": metrics.get("directional_accuracy", 0) / 100,
                "mae": metrics.get("mae", 0),
                "rmse": metrics.get("rmse", 0),
                "mape": metrics.get("mape", 0),
                "r2Score": metrics.get("r2_score", 0),
                "directionalAccuracy": metrics.get("directional_accuracy", 0),
                "trainingDuration": metadata.get("training_history", {}).get(
                    "training_time", 0
                ),
                "dataPoints": metadata.get("training_params", {}).get("lookback_days", 0) * 1440,
            },
            "timestamp": int(time.time() * 1000),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get model stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/save")
async def save_model(data: dict):
    """
    Save model - Compatible with TypeScript POST /api/ml/models/save.

    Note: In Python version, models are auto-saved during training.
    This endpoint returns success if model exists.
    """
    try:
        symbol = data.get("symbol")
        if not symbol:
            raise HTTPException(status_code=400, detail="symbol is required")

        model_dir = settings.model_cache_dir / symbol

        if not model_dir.exists():
            raise HTTPException(status_code=404, detail=f"Model not found for {symbol}")

        metadata_path = model_dir / "metadata.json"
        with open(metadata_path) as f:
            metadata = json.load(f)

        return {
            "success": True,
            "data": {
                "message": f"Model for {symbol} already saved",
                "symbol": symbol,
                "modelType": metadata["model_type"],
                "accuracy": metadata.get("metrics", {}).get("directional_accuracy", 0) / 100,
                "metrics": metadata.get("metrics", {}),
            },
            "timestamp": int(time.time() * 1000),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save model: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/models/{symbol}")
async def delete_model(symbol: str):
    """
    Delete model - Compatible with TypeScript DELETE /api/ml/models/:symbol.
    """
    try:
        model_dir = settings.model_cache_dir / symbol

        if not model_dir.exists():
            raise HTTPException(status_code=404, detail=f"Model not found for {symbol}")

        # Delete model directory
        shutil.rmtree(model_dir)

        logger.info(f"Deleted model for {symbol}")

        return {
            "success": True,
            "data": {"message": f"Model for {symbol} deleted", "symbol": symbol},
            "timestamp": int(time.time() * 1000),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete model: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/models/cleanup")
async def cleanup_models(data: dict | None = None):
    """
    Cleanup old models - Compatible with TypeScript POST /api/ml/models/cleanup.
    """
    try:
        max_age_days = data.get("maxAgeDays", 30) if data else 30
        models_dir = settings.model_cache_dir

        if not models_dir.exists():
            return {
                "success": True,
                "data": {"message": "No models to cleanup", "deletedCount": 0, "maxAgeDays": max_age_days},
                "timestamp": int(time.time() * 1000),
            }

        deleted_count = 0
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 60 * 60

        for symbol_dir in models_dir.iterdir():
            if not symbol_dir.is_dir():
                continue

            metadata_path = symbol_dir / "metadata.json"
            if not metadata_path.exists():
                continue

            try:
                with open(metadata_path) as f:
                    metadata = json.load(f)

                trained_at = metadata.get("trained_at", 0) / 1000  # Convert ms to seconds
                age = current_time - trained_at

                if age > max_age_seconds:
                    shutil.rmtree(symbol_dir)
                    deleted_count += 1
                    logger.info(f"Deleted old model for {symbol_dir.name}")

            except Exception as e:
                logger.warning(f"Failed to check/delete {symbol_dir.name}: {e}")

        return {
            "success": True,
            "data": {
                "message": f"Deleted {deleted_count} old models",
                "deletedCount": deleted_count,
                "maxAgeDays": max_age_days,
            },
            "timestamp": int(time.time() * 1000),
        }

    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
