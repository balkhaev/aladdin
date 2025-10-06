"""Data normalization utilities."""

import json
import logging
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
import torch
from sklearn.preprocessing import MinMaxScaler, RobustScaler, StandardScaler

logger = logging.getLogger(__name__)


class Normalizer:
    """
    Data normalization with multiple strategies.

    Supports:
    - StandardScaler (mean=0, std=1)
    - MinMaxScaler (0 to 1)
    - RobustScaler (robust to outliers)
    """

    def __init__(self, method: Literal["standard", "minmax", "robust"] = "standard"):
        """
        Initialize normalizer.

        Args:
            method: Normalization method
        """
        self.method = method
        self.scaler = self._create_scaler()
        self.is_fitted = False

    def _create_scaler(self):
        """Create scaler based on method."""
        if self.method == "standard":
            return StandardScaler()
        if self.method == "minmax":
            return MinMaxScaler()
        if self.method == "robust":
            return RobustScaler()
        raise ValueError(f"Unknown normalization method: {self.method}")

    def fit(self, data: np.ndarray | pd.DataFrame) -> "Normalizer":
        """
        Fit scaler to data.

        Args:
            data: Training data to fit scaler

        Returns:
            Self for chaining
        """
        if isinstance(data, pd.DataFrame):
            data = data.values

        self.scaler.fit(data)
        self.is_fitted = True
        logger.info(f"Fitted {self.method} scaler on {data.shape} data")
        return self

    def transform(self, data: np.ndarray | pd.DataFrame) -> np.ndarray:
        """
        Transform data using fitted scaler.

        Args:
            data: Data to transform

        Returns:
            Normalized data
        """
        if not self.is_fitted:
            raise ValueError("Normalizer must be fitted before transform")

        if isinstance(data, pd.DataFrame):
            data = data.values

        return self.scaler.transform(data)

    def fit_transform(self, data: np.ndarray | pd.DataFrame) -> np.ndarray:
        """Fit and transform in one step."""
        return self.fit(data).transform(data)

    def inverse_transform(self, data: np.ndarray | pd.DataFrame) -> np.ndarray:
        """
        Inverse transform normalized data back to original scale.

        Args:
            data: Normalized data

        Returns:
            Original scale data
        """
        if not self.is_fitted:
            raise ValueError("Normalizer must be fitted before inverse_transform")

        if isinstance(data, pd.DataFrame):
            data = data.values

        return self.scaler.inverse_transform(data)

    def save(self, path: Path) -> None:
        """
        Save scaler parameters to disk.

        Args:
            path: Path to save scaler
        """
        if not self.is_fitted:
            raise ValueError("Cannot save unfitted scaler")

        # Save scaler parameters
        params = {
            "method": self.method,
            "is_fitted": self.is_fitted,
        }

        # Save scaler-specific parameters
        if self.method == "standard":
            params["mean"] = self.scaler.mean_.tolist()
            params["scale"] = self.scaler.scale_.tolist()
        elif self.method == "minmax":
            params["min"] = self.scaler.min_.tolist()
            params["scale"] = self.scaler.scale_.tolist()
            params["data_min"] = self.scaler.data_min_.tolist()
            params["data_max"] = self.scaler.data_max_.tolist()
        elif self.method == "robust":
            params["center"] = self.scaler.center_.tolist()
            params["scale"] = self.scaler.scale_.tolist()

        with open(path, "w") as f:
            json.dump(params, f, indent=2)

        logger.info(f"Saved scaler to {path}")

    @classmethod
    def load(cls, path: Path) -> "Normalizer":
        """
        Load scaler from disk.

        Args:
            path: Path to load scaler from

        Returns:
            Loaded normalizer
        """
        with open(path) as f:
            params = json.load(f)

        normalizer = cls(method=params["method"])

        # Restore scaler parameters
        if params["method"] == "standard":
            normalizer.scaler.mean_ = np.array(params["mean"])
            normalizer.scaler.scale_ = np.array(params["scale"])
            normalizer.scaler.n_features_in_ = len(params["mean"])
        elif params["method"] == "minmax":
            normalizer.scaler.min_ = np.array(params["min"])
            normalizer.scaler.scale_ = np.array(params["scale"])
            normalizer.scaler.data_min_ = np.array(params["data_min"])
            normalizer.scaler.data_max_ = np.array(params["data_max"])
            normalizer.scaler.n_features_in_ = len(params["min"])
        elif params["method"] == "robust":
            normalizer.scaler.center_ = np.array(params["center"])
            normalizer.scaler.scale_ = np.array(params["scale"])
            normalizer.scaler.n_features_in_ = len(params["center"])

        normalizer.is_fitted = True
        logger.info(f"Loaded scaler from {path}")

        return normalizer


def create_sequences(
    data: np.ndarray,
    sequence_length: int,
    target_column: int = 0,
    forecast_horizon: int = 1,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Create sequences for time series prediction.

    Args:
        data: Input data array of shape (timesteps, features)
        sequence_length: Length of input sequences
        target_column: Column index to use as target
        forecast_horizon: Number of steps ahead to predict

    Returns:
        Tuple of (X, y) where:
        - X: shape (samples, sequence_length, features)
        - y: shape (samples, forecast_horizon)
    """
    X, y = [], []

    for i in range(len(data) - sequence_length - forecast_horizon + 1):
        # Input sequence
        seq = data[i : i + sequence_length]
        X.append(seq)

        # Target(s)
        if forecast_horizon == 1:
            target = data[i + sequence_length, target_column]
        else:
            target = data[
                i + sequence_length : i + sequence_length + forecast_horizon, target_column
            ]
        y.append(target)

    X_tensor = torch.FloatTensor(np.array(X))
    y_tensor = torch.FloatTensor(np.array(y))

    logger.info(f"Created sequences: X={X_tensor.shape}, y={y_tensor.shape}")

    return X_tensor, y_tensor

