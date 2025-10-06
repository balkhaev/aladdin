"""Device selection utilities."""

import logging

import torch

logger = logging.getLogger(__name__)


def get_device(preferred: str = "auto") -> torch.device:
    """
    Get the best available device.

    Args:
        preferred: Preferred device ("auto", "cpu", "cuda", "mps")

    Returns:
        torch.device: Selected device
    """
    if preferred == "auto":
        if torch.cuda.is_available():
            device = torch.device("cuda")
            logger.info(f"Using CUDA: {torch.cuda.get_device_name(0)}")
        elif torch.backends.mps.is_available():
            device = torch.device("mps")
            logger.info("Using Apple Silicon MPS")
        else:
            device = torch.device("cpu")
            logger.info("Using CPU")
    else:
        device = torch.device(preferred)
        logger.info(f"Using specified device: {preferred}")

    return device

