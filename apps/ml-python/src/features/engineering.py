"""Feature engineering for time series data."""

import logging
from typing import Literal

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """
    Feature engineering for cryptocurrency price prediction.

    Computes 40+ technical indicators and features:
    - Price features (returns, log returns, volatility, spreads)
    - Moving averages (SMA, EMA)
    - Momentum indicators (RSI, MACD, Stochastic, ROC)
    - Volatility indicators (Bollinger Bands, ATR, Standard Deviation)
    - Volume indicators (OBV, Volume SMA, Volume ratio)
    - Trend indicators (ADX, CCI, Aroon)
    """

    @staticmethod
    def compute_all_features(df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute all technical features.

        Args:
            df: DataFrame with OHLCV data

        Returns:
            DataFrame with all computed features
        """
        df = df.copy()

        # Price features
        df = FeatureEngineer._compute_price_features(df)

        # Moving averages
        df = FeatureEngineer._compute_moving_averages(df)

        # Momentum indicators
        df = FeatureEngineer._compute_momentum_indicators(df)

        # Volatility indicators
        df = FeatureEngineer._compute_volatility_indicators(df)

        # Volume indicators
        df = FeatureEngineer._compute_volume_indicators(df)

        # Trend indicators
        df = FeatureEngineer._compute_trend_indicators(df)

        # Drop NaN values from indicator calculation
        df = df.dropna()

        logger.info(f"Computed {len(df.columns) - 6} features from OHLCV data")

        return df

    @staticmethod
    def _compute_price_features(df: pd.DataFrame) -> pd.DataFrame:
        """Compute basic price features."""
        # Returns
        df["returns"] = df["close"].pct_change()
        df["log_returns"] = np.log(df["close"] / df["close"].shift(1))

        # Spreads
        df["hl_spread"] = (df["high"] - df["low"]) / df["close"]
        df["oc_spread"] = (df["close"] - df["open"]) / df["close"]

        # Volatility (rolling std of returns)
        df["volatility_10"] = df["returns"].rolling(window=10).std()
        df["volatility_20"] = df["returns"].rolling(window=20).std()
        df["volatility_50"] = df["returns"].rolling(window=50).std()

        return df

    @staticmethod
    def _compute_moving_averages(df: pd.DataFrame) -> pd.DataFrame:
        """Compute moving averages."""
        # Simple Moving Averages
        for period in [7, 20, 50, 100, 200]:
            df[f"sma_{period}"] = df["close"].rolling(window=period).mean()

        # Exponential Moving Averages
        for period in [7, 20, 50, 100, 200]:
            df[f"ema_{period}"] = df["close"].ewm(span=period, adjust=False).mean()

        # Price relative to MAs
        df["price_sma20_ratio"] = df["close"] / df["sma_20"]
        df["price_sma50_ratio"] = df["close"] / df["sma_50"]

        return df

    @staticmethod
    def _compute_momentum_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Compute momentum indicators."""
        # RSI
        df["rsi_14"] = FeatureEngineer._rsi(df["close"], period=14)
        df["rsi_7"] = FeatureEngineer._rsi(df["close"], period=7)

        # MACD
        ema12 = df["close"].ewm(span=12, adjust=False).mean()
        ema26 = df["close"].ewm(span=26, adjust=False).mean()
        df["macd"] = ema12 - ema26
        df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()
        df["macd_histogram"] = df["macd"] - df["macd_signal"]

        # Stochastic Oscillator
        low_14 = df["low"].rolling(window=14).min()
        high_14 = df["high"].rolling(window=14).max()
        df["stoch_k"] = 100 * (df["close"] - low_14) / (high_14 - low_14)
        df["stoch_d"] = df["stoch_k"].rolling(window=3).mean()

        # Rate of Change
        df["roc_10"] = ((df["close"] - df["close"].shift(10)) / df["close"].shift(10)) * 100
        df["roc_20"] = ((df["close"] - df["close"].shift(20)) / df["close"].shift(20)) * 100

        # Williams %R
        df["williams_r"] = -100 * (high_14 - df["close"]) / (high_14 - low_14)

        return df

    @staticmethod
    def _compute_volatility_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Compute volatility indicators."""
        # Bollinger Bands
        for period in [20]:
            sma = df["close"].rolling(window=period).mean()
            std = df["close"].rolling(window=period).std()
            df[f"bb_upper_{period}"] = sma + (2 * std)
            df[f"bb_middle_{period}"] = sma
            df[f"bb_lower_{period}"] = sma - (2 * std)
            df[f"bb_width_{period}"] = (
                (df[f"bb_upper_{period}"] - df[f"bb_lower_{period}"]) / df[f"bb_middle_{period}"]
            )
            df[f"bb_position_{period}"] = (df["close"] - df[f"bb_lower_{period}"]) / (
                df[f"bb_upper_{period}"] - df[f"bb_lower_{period}"]
            )

        # ATR (Average True Range)
        df["atr_14"] = FeatureEngineer._atr(df, period=14)

        return df

    @staticmethod
    def _compute_volume_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Compute volume indicators."""
        # OBV (On-Balance Volume)
        obv = [0]
        for i in range(1, len(df)):
            if df["close"].iloc[i] > df["close"].iloc[i - 1]:
                obv.append(obv[-1] + df["volume"].iloc[i])
            elif df["close"].iloc[i] < df["close"].iloc[i - 1]:
                obv.append(obv[-1] - df["volume"].iloc[i])
            else:
                obv.append(obv[-1])
        df["obv"] = obv

        # Volume moving averages
        df["volume_sma_20"] = df["volume"].rolling(window=20).mean()
        df["volume_ratio"] = df["volume"] / df["volume_sma_20"]

        # Force Index
        df["force_index"] = df["close"].diff() * df["volume"]
        df["force_index_13"] = df["force_index"].ewm(span=13, adjust=False).mean()

        return df

    @staticmethod
    def _compute_trend_indicators(df: pd.DataFrame) -> pd.DataFrame:
        """Compute trend indicators."""
        # ADX (Average Directional Index)
        df["adx_14"] = FeatureEngineer._adx(df, period=14)

        # CCI (Commodity Channel Index)
        df["cci_20"] = FeatureEngineer._cci(df, period=20)

        # Aroon
        aroon_up, aroon_down = FeatureEngineer._aroon(df, period=25)
        df["aroon_up"] = aroon_up
        df["aroon_down"] = aroon_down
        df["aroon_oscillator"] = aroon_up - aroon_down

        return df

    @staticmethod
    def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI."""
        delta = series.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))

    @staticmethod
    def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate ATR."""
        high_low = df["high"] - df["low"]
        high_close = np.abs(df["high"] - df["close"].shift())
        low_close = np.abs(df["low"] - df["close"].shift())
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return true_range.rolling(window=period).mean()

    @staticmethod
    def _adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
        """Calculate ADX."""
        plus_dm = df["high"].diff()
        minus_dm = -df["low"].diff()
        plus_dm[plus_dm < 0] = 0
        minus_dm[minus_dm < 0] = 0

        atr = FeatureEngineer._atr(df, period)
        plus_di = 100 * (plus_dm.ewm(alpha=1 / period).mean() / atr)
        minus_di = 100 * (minus_dm.ewm(alpha=1 / period).mean() / atr)

        dx = (np.abs(plus_di - minus_di) / (plus_di + minus_di)) * 100
        return dx.ewm(alpha=1 / period).mean()

    @staticmethod
    def _cci(df: pd.DataFrame, period: int = 20) -> pd.Series:
        """Calculate CCI."""
        tp = (df["high"] + df["low"] + df["close"]) / 3
        ma = tp.rolling(window=period).mean()
        md = tp.rolling(window=period).apply(lambda x: np.abs(x - x.mean()).mean())
        return (tp - ma) / (0.015 * md)

    @staticmethod
    def _aroon(df: pd.DataFrame, period: int = 25) -> tuple[pd.Series, pd.Series]:
        """Calculate Aroon Up and Aroon Down."""
        aroon_up = (
            df["high"]
            .rolling(window=period + 1)
            .apply(lambda x: float(period - x.argmax()) / period * 100)
        )
        aroon_down = (
            df["low"]
            .rolling(window=period + 1)
            .apply(lambda x: float(period - x.argmin()) / period * 100)
        )
        return aroon_up, aroon_down

    @staticmethod
    def select_features(
        df: pd.DataFrame, feature_type: Literal["all", "price", "technical"] = "all"
    ) -> pd.DataFrame:
        """
        Select specific feature types.

        Args:
            df: DataFrame with all features
            feature_type: Type of features to select

        Returns:
            DataFrame with selected features
        """
        if feature_type == "all":
            return df

        # Price features only
        if feature_type == "price":
            price_cols = ["open", "high", "low", "close", "volume"]
            price_feature_cols = [
                col for col in df.columns if any(x in col for x in ["returns", "spread", "volatility"])
            ]
            return df[price_cols + price_feature_cols]

        # Technical indicators only
        if feature_type == "technical":
            exclude = ["open", "high", "low", "close", "volume", "timestamp"]
            return df[[col for col in df.columns if col not in exclude]]

        return df

