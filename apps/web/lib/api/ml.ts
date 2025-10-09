/**
 * ML Service API Client
 * Unified API client using apiGet/apiPost
 * Routes through API Gateway (port 3000)
 */

import { apiDelete, apiGet, apiPost } from "./client";

// ==================== Types ====================

export type PredictionHorizon = "1h" | "4h" | "1d" | "7d";
export type ModelType = "LSTM" | "HYBRID";
export type MarketRegime = "BULL" | "BEAR" | "SIDEWAYS";

// Prediction types
export type PredictionPoint = {
  timestamp: number;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
};

export type PredictionResult = {
  symbol: string;
  horizon: PredictionHorizon;
  predictions: PredictionPoint[];
  features: {
    technicalIndicators: Record<string, number>;
    onChainMetrics: Record<string, number>;
    sentimentScore?: number;
    marketRegime: MarketRegime;
    volatility: number;
    momentum: number;
  };
  modelInfo: {
    version: string;
    lastTrained: number;
    accuracy: number;
    confidence: number;
  };
  includeSentiment?: boolean;
  generatedAt: number;
};

// Backtesting types
export type EvaluationMetrics = {
  mae: number;
  rmse: number;
  mape: number;
  r2Score: number;
  directionalAccuracy: number;
  meanError: number;
  maxError: number;
  minError: number;
};

export type BacktestPrediction = {
  timestamp: number;
  actual: number;
  predicted: number;
  error: number;
  percentError: number;
  correctDirection: boolean;
};

export type BacktestResult = {
  config: {
    symbol: string;
    modelType: ModelType;
    horizon: PredictionHorizon;
    startDate: number;
    endDate: number;
    walkForward: boolean;
    retrainInterval?: number;
    includeSentiment?: boolean;
  };
  metrics: EvaluationMetrics;
  predictions: BacktestPrediction[];
  summary: {
    totalPredictions: number;
    successfulPredictions: number;
    failedPredictions: number;
    averageConfidence: number;
    modelRetrains: number;
  };
  includeSentiment?: boolean;
  executionTime: number;
  completedAt: number;
};

export type ComparisonResult = {
  lstm: BacktestResult;
  hybrid: BacktestResult;
  comparison: {
    winner: ModelType | "TIE";
    lstmBetter: string[];
    hybridBetter: string[];
  };
};

// Market Regime types
export type MarketRegimeAnalysis = {
  symbol: string;
  currentRegime: MarketRegime;
  confidence: number;
  indicators: {
    trend: number;
    volatility: number;
    momentum: number;
    volume: number;
  };
  history: Array<{
    timestamp: number;
    regime: MarketRegime;
    confidence: number;
  }>;
  generatedAt: number;
};

// HPO types
export type OptimizationMetric =
  | "mae"
  | "rmse"
  | "mape"
  | "r2_score"
  | "directional_accuracy";

export type HyperparameterSpace = {
  hidden_size?: { min: number; max: number };
  num_layers?: { min: number; max: number };
  learning_rate?: { min: number; max: number; log?: boolean };
  dropout?: { min: number; max: number };
  batch_size?: number[];
  sequence_length?: { min: number; max: number };
};

export type OptimizationTrial = {
  trialNumber: number;
  params: Record<string, number | boolean | string>;
  metrics: EvaluationMetrics;
  value: number;
};

export type OptimizationResult = {
  bestParams: Record<string, number | boolean | string>;
  bestValue: number;
  bestMetrics: EvaluationMetrics;
  trials: OptimizationTrial[];
  optimizationMetric: OptimizationMetric;
  totalTrials: number;
  method: "GRID" | "RANDOM";
  completedAt: number;
};

export type HPORecommendation = {
  symbol: string;
  modelType: ModelType;
  horizon: PredictionHorizon;
  recommendedParams: Record<string, number | boolean | string>;
  expectedMetrics: EvaluationMetrics;
  confidence: number;
  reasoning: string;
  generatedAt: number;
};

// Model Management types
export type ModelInfo = {
  symbol: string;
  modelType: ModelType;
  version: string;
  createdAt: number;
  lastUsed: number;
  accuracy: number;
  sizeBytes: number;
  path: string;
};

export type ModelStats = {
  symbol: string;
  totalModels: number;
  models: ModelInfo[];
  totalSizeBytes: number;
  oldestModel: number;
  newestModel: number;
};

export type SaveModelResult = {
  symbol: string;
  modelType: ModelType;
  version: string;
  path: string;
  sizeBytes: number;
  savedAt: number;
};

export type CleanupResult = {
  deletedModels: string[];
  freedSpaceBytes: number;
  remainingModels: number;
};

// Training types
export type TrainRequest = {
  symbol: string;
  model_type: "LSTM" | "GRU";
  hidden_size?: number;
  num_layers?: number;
  sequence_length?: number;
  lookback_days?: number;
  learning_rate?: number;
  batch_size?: number;
  epochs?: number;
  dropout?: number;
  bidirectional?: boolean;
  normalization?: "standard" | "minmax" | "robust";
};

export type TrainingResult = {
  symbol: string;
  model_type: string;
  model_path: string;
  training_time: number;
  epochs_trained: number;
  metrics: {
    mae: number;
    rmse: number;
    mape: number;
    r2Score: number;
    directionalAccuracy: number;
  };
  model_size_mb: number;
};

// Anomaly Detection types
export type AnomalyDetectionRequest = {
  symbol: string;
  lookbackMinutes?: number;
};

export type AnomalyAlert = {
  timestamp: number;
  type: "PRICE_SPIKE" | "VOLUME_SPIKE" | "SPREAD_ANOMALY" | "PATTERN_BREAK";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  price: number;
  expectedPrice: number;
  deviation: number;
  message: string;
  confidence: number;
};

export type AnomalyDetectionResult = {
  symbol: string;
  anomalies: AnomalyAlert[];
  detectedAt: number;
};

// Batch Prediction types
export type BatchPredictionRequest = {
  symbols: string[];
  horizon: PredictionHorizon;
  confidence?: number;
  includeSentiment?: boolean;
};

export type BatchPredictionResult = {
  predictions: PredictionResult[];
  count: number;
  includeSentiment?: boolean;
};

// Ensemble Prediction types
export type EnsembleStrategy = "WEIGHTED_AVERAGE" | "VOTING" | "STACKING";

export type EnsemblePredictionRequest = {
  symbol: string;
  horizon: PredictionHorizon;
  strategy?: EnsembleStrategy;
  includeSentiment?: boolean;
};

export type EnsemblePredictionResult = {
  symbol: string;
  horizon: PredictionHorizon;
  ensemble: {
    prediction: PredictionPoint;
    modelContributions: Array<{
      modelType: ModelType;
      prediction: PredictionPoint;
      weight: number;
    }>;
  };
  individualPredictions: {
    lstm: PredictionResult;
    hybrid: PredictionResult;
  };
  strategy: EnsembleStrategy;
  confidence: number;
  generatedAt: number;
};

// ==================== API Functions ====================

/**
 * Predict price
 */
export async function predictPrice(params: {
  symbol: string;
  horizon: PredictionHorizon;
  confidence?: number;
  includeSentiment?: boolean;
}): Promise<PredictionResult> {
  return apiPost<PredictionResult>("/api/ml/predict", params);
}

/**
 * Predict price with LSTM
 */
export async function predictPriceLSTM(params: {
  symbol: string;
  horizon: PredictionHorizon;
  confidence?: number;
  includeSentiment?: boolean;
}): Promise<PredictionResult> {
  return apiPost<PredictionResult>("/api/ml/predict/lstm", params);
}

/**
 * Run backtest
 */
export async function runBacktest(config: {
  symbol: string;
  modelType: ModelType;
  horizon: PredictionHorizon;
  startDate: number;
  endDate: number;
  walkForward?: boolean;
  retrainInterval?: number;
  includeSentiment?: boolean;
}): Promise<BacktestResult> {
  return apiPost<BacktestResult>("/api/ml/backtest", config);
}

/**
 * Compare models
 */
export async function compareModels(config: {
  symbol: string;
  horizon: PredictionHorizon;
  startDate: number;
  endDate: number;
  walkForward?: boolean;
  retrainInterval?: number;
  includeSentiment?: boolean;
}): Promise<ComparisonResult> {
  return apiPost<ComparisonResult>("/api/ml/backtest/compare", config);
}

/**
 * Get market regime analysis
 */
export async function getMarketRegime(params: {
  symbol: string;
  lookbackDays?: number;
}): Promise<MarketRegimeAnalysis> {
  return apiPost<MarketRegimeAnalysis>("/api/ml/market-regime", params);
}

/**
 * Run hyperparameter optimization
 */
export async function runOptimization(config: {
  symbol: string;
  modelType: ModelType;
  horizon: PredictionHorizon;
  hyperparameterSpace: HyperparameterSpace;
  method: "GRID" | "RANDOM";
  nTrials?: number;
  startDate: number;
  endDate: number;
  optimizationMetric: OptimizationMetric;
  crossValidationFolds?: number;
  includeSentiment?: boolean;
}): Promise<OptimizationResult> {
  return apiPost<OptimizationResult>("/api/ml/hpo/optimize", config);
}

/**
 * Get HPO recommendations
 */
export async function getHPORecommendations(
  symbol: string,
  modelType: ModelType,
  horizon: PredictionHorizon
): Promise<HPORecommendation> {
  return apiGet<HPORecommendation>("/api/ml/hpo/recommendations", {
    symbol,
    modelType,
    horizon,
  });
}

/**
 * List all models
 */
export async function listModels(): Promise<{
  models: ModelInfo[];
  totalModels: number;
  totalSizeBytes: number;
}> {
  return apiGet<{
    models: ModelInfo[];
    totalModels: number;
    totalSizeBytes: number;
  }>("/api/ml/models");
}

/**
 * Get model statistics for a symbol
 */
export async function getModelStats(symbol: string): Promise<ModelStats> {
  return apiGet<ModelStats>(`/api/ml/models/${symbol}/stats`);
}

/**
 * Save a trained model
 */
export async function saveModel(params: {
  symbol: string;
  modelType: ModelType;
  modelData: unknown;
  metrics: EvaluationMetrics;
}): Promise<SaveModelResult> {
  return apiPost<SaveModelResult>("/api/ml/models/save", params);
}

/**
 * Delete a specific model
 */
export async function deleteModel(symbol: string): Promise<void> {
  return apiDelete<void>(`/api/ml/models/${symbol}`);
}

/**
 * Cleanup old models
 */
export async function cleanupModels(
  olderThanDays?: number,
  keepBest?: boolean
): Promise<CleanupResult> {
  return apiPost<CleanupResult>("/api/ml/models/cleanup", {
    olderThanDays,
    keepBest,
  });
}

/**
 * Train a new model
 */
export async function trainModel(
  config: TrainRequest
): Promise<TrainingResult> {
  return apiPost<TrainingResult>("/api/ml/train", config);
}

/**
 * Detect anomalies in recent data
 */
export async function detectAnomalies(
  params: AnomalyDetectionRequest
): Promise<AnomalyDetectionResult> {
  return apiPost<AnomalyDetectionResult>("/api/ml/anomalies/detect", params);
}

/**
 * Run batch predictions for multiple symbols
 */
export async function batchPredict(
  params: BatchPredictionRequest
): Promise<BatchPredictionResult> {
  return apiPost<BatchPredictionResult>("/api/ml/predict/batch", params);
}

/**
 * Run ensemble prediction combining multiple models
 */
export async function ensemblePredict(
  params: EnsemblePredictionRequest
): Promise<EnsemblePredictionResult> {
  return apiPost<EnsemblePredictionResult>(
    "/api/ml/predict/ensemble",
    params
  );
}
