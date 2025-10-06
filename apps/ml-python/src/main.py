"""FastAPI application entry point - Compatible with TypeScript ml-service API."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api import advanced, health, models, prediction, training
from src.config import get_settings
from src.utils.logger import setup_logging

settings = get_settings()
setup_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager."""
    logger.info("🚀 Starting ML Python Service (TypeScript-compatible)")
    logger.info(f"📊 Device: {settings.device}")
    logger.info(f"📁 Model cache: {settings.model_cache_dir}")
    logger.info("🔄 API compatible with TypeScript ml-service")
    yield
    logger.info("👋 Shutting down ML Python Service")


app = FastAPI(
    title="ML Python Service",
    description="Production ML service for cryptocurrency price prediction (TypeScript-compatible)",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {"code": "INTERNAL_ERROR", "message": str(exc)},
            "timestamp": int(__import__("time").time() * 1000),
        },
    )


# Include routers with /api/ml prefix (compatible with TypeScript)
app.include_router(health.router, prefix="/api/ml", tags=["health"])
app.include_router(training.router, prefix="/api/ml", tags=["training"])
app.include_router(prediction.router, prefix="/api/ml", tags=["prediction"])
app.include_router(advanced.router, prefix="/api/ml", tags=["advanced"])
app.include_router(models.router, prefix="/api/ml", tags=["models"])


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "ml-python",
        "version": "1.0.0",
        "compatible_with": "TypeScript ml-service",
        "docs": "/docs",
        "health": "/health",
    }


# Health check endpoint (standard path without prefix)
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    import time
    import torch

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
        "timestamp": int(time.time() * 1000),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level=settings.log_level.lower(),
    )
