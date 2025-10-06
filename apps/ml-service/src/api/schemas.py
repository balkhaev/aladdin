"""Pydantic schemas for API requests and responses - Compatible with TypeScript ml-service."""

from typing import Literal

from pydantic import BaseModel, Field


# Common types
PredictionHorizon = Literal["1h", "4h", "1d", "7d"]
MarketRegime = Literal["BULL", "BEAR", "SIDEWAYS"]


# Prediction schemas (compatible with TypeScript)
class PredictionRequest(BaseModel):
    """Prediction request - matches TypeScript PredictionRequestSchema."""

    symbol: str = Field(..., min_length=1)
    horizon: PredictionHorizon = Field(default="1h")
    confidence: float = Field(default=0.95, ge=0, le=1)
    includeSentiment: bool = Field(default=True)  # camelCase для совместимости


class PredictionPoint(BaseModel):
    """Single prediction point."""

    timestamp: int
    predictedPrice: float  # camelCase для совместимости
    lowerBound: float
    upperBound: float
    confidence: float


class PredictionResult(BaseModel):
    """Prediction result - matches TypeScript PredictionResult."""

    symbol: str
    horizon: PredictionHorizon
    predictions: list[PredictionPoint]
    features: dict
    modelInfo: dict  # camelCase для совместимости
    generatedAt: int  # camelCase для совместимости


# Market Regime schemas
class MarketRegimeRequest(BaseModel):
    """Market regime request - matches TypeScript."""

    symbol: str = Field(..., min_length=1)
    lookback: int = Field(default=30, ge=1, le=365)
    includeSentiment: bool = Field(default=True)


class RegimeHistoryPoint(BaseModel):
    """Single regime history point."""

    timestamp: int
    regime: MarketRegime
    confidence: float


class MarketRegimeResult(BaseModel):
    """Market regime result - matches TypeScript."""

    symbol: str
    currentRegime: MarketRegime  # camelCase
    confidence: float
    regimeHistory: list[RegimeHistoryPoint]  # camelCase
    indicators: dict
    nextRegimeProb: dict  # camelCase
    generatedAt: int  # camelCase


# Backtesting schemas
class BacktestConfig(BaseModel):
    """Backtest configuration - matches TypeScript."""

    symbol: str = Field(..., min_length=1)
    modelType: Literal["LSTM", "HYBRID"] = Field(default="LSTM")  # camelCase
    horizon: PredictionHorizon = Field(default="1h")
    startDate: int = Field(..., ge=0)  # camelCase
    endDate: int = Field(..., ge=0)  # camelCase
    walkForward: bool = Field(default=False)  # camelCase
    retrainInterval: int = Field(default=30, ge=1)  # camelCase
    includeSentiment: bool = Field(default=True)  # camelCase
    # LSTM hyperparameters
    hiddenSize: int | None = Field(default=None, ge=1)  # camelCase
    sequenceLength: int | None = Field(default=None, ge=1)  # camelCase
    learningRate: float | None = Field(default=None, ge=0)  # camelCase
    epochs: int | None = Field(default=None, ge=1)
    # Hybrid hyperparameters
    lookbackWindow: int | None = Field(default=None, ge=1)  # camelCase
    smoothingFactor: float | None = Field(default=None, ge=0, le=1)  # camelCase


class CompareModelsRequest(BaseModel):
    """Compare models request - matches TypeScript."""

    symbol: str = Field(..., min_length=1)
    horizon: PredictionHorizon = Field(default="1h")
    startDate: int = Field(..., ge=0)  # camelCase
    endDate: int = Field(..., ge=0)  # camelCase
    walkForward: bool = Field(default=False)  # camelCase
    retrainInterval: int = Field(default=30, ge=1)  # camelCase
    includeSentiment: bool = Field(default=True)  # camelCase


# Ensemble schemas
class EnsemblePredictionRequest(BaseModel):
    """Ensemble prediction request - matches TypeScript."""

    symbol: str = Field(..., min_length=1)
    horizon: PredictionHorizon = Field(default="1h")
    strategy: Literal["WEIGHTED_AVERAGE", "VOTING", "STACKING"] = Field(
        default="WEIGHTED_AVERAGE"
    )
    includeSentiment: bool = Field(default=True)  # camelCase


# Anomaly detection schemas
class AnomalyDetectionRequest(BaseModel):
    """Anomaly detection request - matches TypeScript."""

    symbol: str = Field(..., min_length=1)
    lookbackMinutes: int = Field(default=60, ge=5, le=1440)  # camelCase


# Batch prediction schemas
class BatchPredictionRequest(BaseModel):
    """Batch prediction request."""

    symbols: list[str] = Field(..., min_items=1)
    horizon: PredictionHorizon = Field(default="1h")
    confidence: float = Field(default=0.95, ge=0, le=1)
    includeSentiment: bool = Field(default=True)  # camelCase


# HPO schemas
class HyperparameterSpace(BaseModel):
    """Hyperparameter space - matches TypeScript."""

    hiddenSize: list[int] | None = None  # camelCase
    sequenceLength: list[int] | None = None  # camelCase
    learningRate: list[float] | None = None  # camelCase
    epochs: list[int] | None = None
    lookbackWindow: list[int] | None = None  # camelCase
    smoothingFactor: list[float] | None = None  # camelCase
    retrainInterval: list[int] | None = None  # camelCase


class OptimizationConfig(BaseModel):
    """Optimization configuration - matches TypeScript."""

    symbol: str = Field(..., min_length=1)
    modelType: Literal["LSTM", "HYBRID"] = Field(default="LSTM")  # camelCase
    horizon: PredictionHorizon = Field(default="1h")
    hyperparameterSpace: HyperparameterSpace  # camelCase
    method: Literal["GRID", "RANDOM"] = Field(default="RANDOM")
    nTrials: int = Field(default=20, ge=1)  # camelCase
    startDate: int = Field(..., ge=0)  # camelCase
    endDate: int = Field(..., ge=0)  # camelCase
    optimizationMetric: Literal["mae", "rmse", "mape", "r2Score", "directionalAccuracy"] = Field(
        default="directionalAccuracy"
    )  # camelCase
    crossValidationFolds: int = Field(default=3, ge=2, le=10)  # camelCase
    includeSentiment: bool = Field(default=True)  # camelCase


# Training schemas (extended for compatibility)
class TrainRequest(BaseModel):
    """Training request."""

    symbol: str = Field(..., description="Trading pair symbol")
    model_type: Literal["LSTM", "GRU"] = Field(default="LSTM", description="Model type")
    hidden_size: int = Field(default=128, ge=16, le=512, description="Hidden layer size")
    num_layers: int = Field(default=2, ge=1, le=5, description="Number of layers")
    sequence_length: int = Field(default=60, ge=10, le=200, description="Sequence length")
    lookback_days: int = Field(default=30, ge=7, le=365, description="Days of historical data")
    learning_rate: float = Field(default=0.001, ge=0.00001, le=0.1, description="Learning rate")
    batch_size: int = Field(default=32, ge=8, le=256, description="Batch size")
    epochs: int = Field(default=100, ge=10, le=500, description="Maximum epochs")
    dropout: float = Field(default=0.2, ge=0.0, le=0.5, description="Dropout rate")
    bidirectional: bool = Field(default=False, description="Use bidirectional model")
    normalization: Literal["standard", "minmax", "robust"] = Field(
        default="standard", description="Normalization method"
    )


class TrainResponseData(BaseModel):
    """Training response data."""

    symbol: str
    model_type: str
    model_path: str
    training_time: float
    epochs_trained: int
    metrics: dict
    model_size_mb: float


class TrainResponse(BaseModel):
    """Training response."""

    success: bool
    data: TrainResponseData
    timestamp: int


# Standard response wrapper
class SuccessResponse(BaseModel):
    """Standard success response - matches TypeScript."""

    success: bool = True
    data: dict
    timestamp: int


class ErrorResponse(BaseModel):
    """Standard error response - matches TypeScript."""

    success: bool = False
    error: dict
    timestamp: int
