"""Market regime detection service."""

import logging

import numpy as np
import pandas as pd

from src.data.clickhouse_loader import ClickHouseLoader
from src.features.engineering import FeatureEngineer

logger = logging.getLogger(__name__)


class MarketRegimeService:
    """Detect market regime (BULL/BEAR/SIDEWAYS)."""

    def __init__(self):
        """Initialize service."""
        self.loader = ClickHouseLoader()

    async def detect_regime(self, symbol: str, lookback: int = 30) -> dict:
        """
        Detect current market regime.

        Args:
            symbol: Trading pair symbol
            lookback: Lookback period in days

        Returns:
            Market regime result
        """
        logger.info(f"Detecting regime for {symbol} (lookback={lookback} days)")

        # Load data
        df = self.loader.load_recent_candles(
            symbol=symbol,
            timeframe="1h",  # Use hourly for regime detection
            lookback_days=lookback,
        )

        # Compute features
        df_features = FeatureEngineer.compute_all_features(df)

        # Detect regime
        current_regime = self._classify_regime(df_features)
        confidence = self._calculate_regime_confidence(df_features, current_regime)

        # Regime history (last 7 days)
        regime_history = self._build_regime_history(df_features)

        # Calculate indicators
        indicators = self._calculate_indicators(df_features)

        # Predict next regime probabilities
        next_regime_prob = self._predict_next_regime(df_features, current_regime)

        return {
            "symbol": symbol,
            "currentRegime": current_regime,
            "confidence": confidence,
            "regimeHistory": regime_history,
            "indicators": indicators,
            "nextRegimeProb": next_regime_prob,
            "generatedAt": int(__import__("time").time() * 1000),
        }

    def _classify_regime(self, df: pd.DataFrame) -> str:
        """
        Classify current market regime.

        Args:
            df: DataFrame with features

        Returns:
            Regime: BULL, BEAR, or SIDEWAYS
        """
        # Get recent data (last 20% of data)
        recent_window = max(len(df) // 5, 10)
        recent = df.tail(recent_window)

        # Calculate trend
        close = recent["close"].values
        first_price = close[0]
        last_price = close[-1]
        trend = (last_price - first_price) / first_price

        # Calculate volatility
        returns = recent["close"].pct_change().dropna()
        volatility = returns.std()

        # Classify regime
        if trend > 0.02 and volatility < 0.05:
            return "BULL"
        if trend < -0.02 and volatility < 0.05:
            return "BEAR"
        return "SIDEWAYS"

    def _calculate_regime_confidence(self, df: pd.DataFrame, regime: str) -> float:
        """Calculate confidence in regime classification."""
        recent = df.tail(20)

        # Use multiple indicators for confidence
        rsi = recent["rsi_14"].iloc[-1]
        adx = recent["adx_14"].iloc[-1]
        price = recent["close"].iloc[-1]
        sma_20 = recent["sma_20"].iloc[-1]

        confidence = 0.5  # Base confidence

        # RSI-based confidence
        if regime == "BULL":
            if 50 < rsi < 70:
                confidence += 0.15
            if price > sma_20:
                confidence += 0.15
        elif regime == "BEAR":
            if 30 < rsi < 50:
                confidence += 0.15
            if price < sma_20:
                confidence += 0.15
        else:  # SIDEWAYS
            if 40 < rsi < 60:
                confidence += 0.15

        # ADX-based confidence (trend strength)
        if adx > 25:
            confidence += 0.2

        return min(confidence, 0.95)

    def _build_regime_history(self, df: pd.DataFrame) -> list[dict]:
        """Build regime history for last 7 days."""
        history = []

        # Sample every 6 hours for last 7 days
        window_size = 24  # hours
        step = 6
        recent = df.tail(7 * 24)  # Last 7 days of hourly data

        for i in range(0, len(recent) - window_size, step):
            window = recent.iloc[i : i + window_size]
            regime = self._classify_regime(window)
            confidence = self._calculate_regime_confidence(window, regime)
            timestamp = int(window["timestamp"].iloc[-1].timestamp() * 1000)

            history.append({"timestamp": timestamp, "regime": regime, "confidence": confidence})

        return history[-20:]  # Return last 20 points

    def _calculate_indicators(self, df: pd.DataFrame) -> dict:
        """Calculate regime indicators."""
        recent = df.tail(20)

        # Trend (-1 to 1)
        close = recent["close"].values
        trend = (close[-1] - close[0]) / close[0]
        trend_normalized = np.clip(trend * 10, -1, 1)  # Scale to -1..1

        # Volatility (0 to 1)
        returns = recent["close"].pct_change().dropna()
        volatility = returns.std()

        # Volume (0 to 1, relative to average)
        volume_ratio = recent["volume"].iloc[-1] / recent["volume"].mean()
        volume_normalized = np.clip(volume_ratio, 0, 2) / 2  # Scale to 0..1

        # Momentum (-1 to 1)
        rsi = recent["rsi_14"].iloc[-1]
        momentum = (rsi - 50) / 50  # Convert RSI to -1..1

        return {
            "trend": float(trend_normalized),
            "volatility": float(volatility),
            "volume": float(volume_normalized),
            "momentum": float(momentum),
        }

    def _predict_next_regime(self, df: pd.DataFrame, current_regime: str) -> dict:
        """Predict next regime probabilities using transition matrix."""
        # Simple transition probabilities based on current regime
        transitions = {
            "BULL": {"BULL": 0.7, "SIDEWAYS": 0.2, "BEAR": 0.1},
            "BEAR": {"BEAR": 0.7, "SIDEWAYS": 0.2, "BULL": 0.1},
            "SIDEWAYS": {"SIDEWAYS": 0.5, "BULL": 0.25, "BEAR": 0.25},
        }

        base_probs = transitions[current_regime]

        # Adjust based on indicators
        recent = df.tail(20)
        rsi = recent["rsi_14"].iloc[-1]
        macd = recent["macd"].iloc[-1]

        probs = base_probs.copy()

        # Adjust based on RSI
        if rsi > 70:  # Overbought - higher chance of BEAR
            probs["BEAR"] += 0.1
            probs["BULL"] -= 0.1
        elif rsi < 30:  # Oversold - higher chance of BULL
            probs["BULL"] += 0.1
            probs["BEAR"] -= 0.1

        # Adjust based on MACD
        if macd > 0:  # Bullish momentum
            probs["BULL"] += 0.05
            probs["BEAR"] -= 0.05
        else:  # Bearish momentum
            probs["BEAR"] += 0.05
            probs["BULL"] -= 0.05

        # Normalize to sum to 1
        total = sum(probs.values())
        probs = {k: v / total for k, v in probs.items()}

        return {k.upper(): float(v) for k, v in probs.items()}

