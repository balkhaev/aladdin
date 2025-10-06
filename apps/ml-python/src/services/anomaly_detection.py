"""Anomaly detection service using statistical methods."""

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from src.data.clickhouse_loader import ClickHouseLoader
from src.features.engineering import FeatureEngineer

logger = logging.getLogger(__name__)


class AnomalyDetectionService:
    """Detect anomalies in market data."""

    def __init__(self):
        """Initialize service."""
        self.loader = ClickHouseLoader()

    async def detect_anomalies(self, symbol: str, lookback_minutes: int = 60) -> list[dict]:
        """
        Detect anomalies in recent market data.

        Args:
            symbol: Trading pair symbol
            lookback_minutes: Minutes of data to analyze

        Returns:
            List of detected anomalies
        """
        logger.info(f"Detecting anomalies for {symbol} (lookback={lookback_minutes}min)")

        # Load recent 1-minute data
        lookback_days = max(lookback_minutes // 1440 + 1, 1)
        df = self.loader.load_recent_candles(
            symbol=symbol,
            timeframe="1m",
            lookback_days=lookback_days,
        )

        # Get last N minutes
        df = df.tail(lookback_minutes)

        if len(df) < 30:
            logger.warning(f"Insufficient data: {len(df)} candles")
            return []

        # Compute features
        df_features = FeatureEngineer.compute_all_features(df)

        # Detect different types of anomalies
        anomalies = []

        # 1. Price anomalies (sudden spikes)
        price_anomalies = self._detect_price_anomalies(df_features)
        anomalies.extend(price_anomalies)

        # 2. Volume anomalies
        volume_anomalies = self._detect_volume_anomalies(df_features)
        anomalies.extend(volume_anomalies)

        # 3. Volatility anomalies
        volatility_anomalies = self._detect_volatility_anomalies(df_features)
        anomalies.extend(volatility_anomalies)

        # 4. ML-based anomalies (Isolation Forest)
        ml_anomalies = self._detect_ml_anomalies(df_features)
        anomalies.extend(ml_anomalies)

        # Sort by timestamp
        anomalies.sort(key=lambda x: x["timestamp"])

        logger.info(f"Detected {len(anomalies)} anomalies")

        return anomalies

    def _detect_price_anomalies(self, df: pd.DataFrame) -> list[dict]:
        """Detect price spike anomalies."""
        anomalies = []

        # Calculate price changes
        df["price_change"] = df["close"].pct_change()

        # Z-score method
        mean = df["price_change"].mean()
        std = df["price_change"].std()
        threshold = 3  # 3 standard deviations

        for idx, row in df.iterrows():
            if pd.notna(row["price_change"]):
                z_score = abs((row["price_change"] - mean) / std)

                if z_score > threshold:
                    anomalies.append(
                        {
                            "timestamp": int(row["timestamp"].timestamp() * 1000),
                            "type": "PRICE_SPIKE",
                            "severity": min(z_score / threshold, 3.0),  # 0-3
                            "value": float(row["close"]),
                            "change_pct": float(row["price_change"] * 100),
                            "description": f"Price spike detected: {row['price_change']*100:.2f}%",
                        }
                    )

        return anomalies

    def _detect_volume_anomalies(self, df: pd.DataFrame) -> list[dict]:
        """Detect volume anomalies."""
        anomalies = []

        # Z-score method for volume
        mean = df["volume"].mean()
        std = df["volume"].std()
        threshold = 3

        for idx, row in df.iterrows():
            if row["volume"] > 0:
                z_score = (row["volume"] - mean) / std

                if z_score > threshold:
                    anomalies.append(
                        {
                            "timestamp": int(row["timestamp"].timestamp() * 1000),
                            "type": "VOLUME_SPIKE",
                            "severity": min(z_score / threshold, 3.0),
                            "value": float(row["volume"]),
                            "avg_volume": float(mean),
                            "description": f"Volume spike: {z_score:.1f}x normal",
                        }
                    )

        return anomalies

    def _detect_volatility_anomalies(self, df: pd.DataFrame) -> list[dict]:
        """Detect volatility anomalies."""
        anomalies = []

        if "volatility_10" not in df.columns:
            return anomalies

        # Detect sudden volatility increases
        mean = df["volatility_10"].mean()
        std = df["volatility_10"].std()
        threshold = 2.5

        for idx, row in df.iterrows():
            if pd.notna(row["volatility_10"]):
                z_score = (row["volatility_10"] - mean) / std

                if z_score > threshold:
                    anomalies.append(
                        {
                            "timestamp": int(row["timestamp"].timestamp() * 1000),
                            "type": "VOLATILITY_SPIKE",
                            "severity": min(z_score / threshold, 3.0),
                            "value": float(row["volatility_10"]),
                            "description": f"High volatility detected: {z_score:.1f}σ",
                        }
                    )

        return anomalies

    def _detect_ml_anomalies(self, df: pd.DataFrame) -> list[dict]:
        """Detect anomalies using Isolation Forest."""
        anomalies = []

        # Select features for ML
        feature_cols = ["close", "volume", "volatility_10", "rsi_14"]
        available_cols = [col for col in feature_cols if col in df.columns]

        if len(available_cols) < 3:
            return anomalies

        # Prepare data
        X = df[available_cols].copy()
        X = X.fillna(method="ffill").fillna(0)

        if len(X) < 10:
            return anomalies

        # Train Isolation Forest
        iso_forest = IsolationForest(
            contamination=0.1,  # Expect 10% anomalies
            random_state=42,
        )

        predictions = iso_forest.fit_predict(X)
        scores = iso_forest.score_samples(X)

        # Find anomalies (prediction == -1)
        for idx, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:
                row = df.iloc[idx]
                anomalies.append(
                    {
                        "timestamp": int(row["timestamp"].timestamp() * 1000),
                        "type": "ML_ANOMALY",
                        "severity": float(min(abs(score) * 2, 3.0)),
                        "value": float(row["close"]),
                        "description": f"ML anomaly detected (score: {score:.3f})",
                    }
                )

        return anomalies

