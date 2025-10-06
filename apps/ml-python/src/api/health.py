"""Health check endpoints."""

import torch
from fastapi import APIRouter

from src.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "service": "ml-python",
            "version": "1.0.0",
            "device": str(settings.device),
            "cuda_available": torch.cuda.is_available(),
            "mps_available": torch.backends.mps.is_available(),
        },
        "timestamp": int(__import__("time").time() * 1000),
    }

