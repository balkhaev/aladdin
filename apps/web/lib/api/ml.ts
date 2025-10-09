/**
 * ML Service API Client
 * Routes through API Gateway (port 3000)
 */

import { API_BASE_URL } from "../runtime-env";

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

/**
 * Predict price
 */
export async function predictPrice(params: {
  symbol: string;
  horizon: PredictionHorizon;
  confidence?: number;
  includeSentiment?: boolean;
}): Promise<PredictionResult> {
  const response = await fetch(`${API_BASE_URL}/api/ml/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Prediction failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
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
  const response = await fetch(`${API_BASE_URL}/api/ml/predict/lstm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`LSTM prediction failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
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
  const response = await fetch(`${API_BASE_URL}/api/ml/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Backtest failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
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
  const response = await fetch(`${API_BASE_URL}/api/ml/backtest/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(config),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.error?.message || response.statusText;
    throw new Error(`Model comparison failed: ${errorMessage}`);
  }

  const hasSuccess = Boolean(data.success);
  const hasData = Boolean(data.data);

  if (!hasSuccess) {
    const errorMessage = data?.error?.message || "Request failed";
    throw new Error(`Model comparison failed: ${errorMessage}`);
  }

  if (!hasData) {
    const errorMessage = data?.error?.message || "Invalid response format";
    throw new Error(`Model comparison failed: ${errorMessage}`);
  }

  // Validate response structure
  const hasResults = Boolean(data.data.results);

  if (!hasResults) {
    console.error("Invalid comparison response (missing results):", data);
    throw new Error(
      "Model comparison returned incomplete results. Please check the date range and try again with more historical data."
    );
  }

  const hasLstm = Boolean(data.data.results.lstm);
  const hasHybrid = Boolean(data.data.results.hybrid);

  if (!hasLstm) {
    console.error("Invalid comparison response (missing LSTM):", data);
    throw new Error(
      "Model comparison returned incomplete results (missing LSTM data). Please check the date range and try again with more historical data."
    );
  }

  if (!hasHybrid) {
    console.error("Invalid comparison response (missing Hybrid):", data);
    throw new Error(
      "Model comparison returned incomplete results (missing Hybrid data). Please check the date range and try again with more historical data."
    );
  }

  // Return just the comparison results (unwrap from API response)
  return data.data.results;
}

/**
 * Get market regime
 */
export async function getMarketRegime(params: {
  symbol: string;
  lookback?: number;
  includeSentiment?: boolean;
}): Promise<{
  symbol: string;
  currentRegime: MarketRegime;
  confidence: number;
  regimeHistory: Array<{
    timestamp: number;
    regime: MarketRegime;
    confidence: number;
  }>;
  indicators: {
    trend: number;
    volatility: number;
    volume: number;
    momentum: number;
  };
  nextRegimeProb: {
    BULL: number;
    BEAR: number;
    SIDEWAYS: number;
  };
  includeSentiment?: boolean;
  generatedAt: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/ml/regime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Regime detection failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

// Hyperparameter Optimization types
export type HyperparameterSpace = {
  hiddenSize?: number[];
  sequenceLength?: number[];
  learningRate?: number[];
  epochs?: number[];
  lookbackWindow?: number[];
  smoothingFactor?: number[];
  retrainInterval?: number[];
};

export type OptimizationMetric =
  | "mae"
  | "rmse"
  | "mape"
  | "r2Score"
  | "directionalAccuracy";

export type TrialResult = {
  trialId: number;
  hyperparameters: Record<string, number>;
  metrics: EvaluationMetrics;
  score: number;
  executionTime: number;
  completedAt: number;
};

export type OptimizationResult = {
  config: {
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
  };
  trials: TrialResult[];
  bestTrial: TrialResult;
  bestHyperparameters: Record<string, number>;
  improvementPercentage: number;
  totalExecutionTime: number;
  completedAt: number;
};

export type OptimizationRecommendations = {
  recommendedSpace: HyperparameterSpace;
  reasoning: string;
};

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
  const response = await fetch(`${API_BASE_URL}/api/ml/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Optimization failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get hyperparameter recommendations
 */
export async function getHPORecommendations(
  symbol: string,
  modelType: ModelType
): Promise<OptimizationRecommendations> {
  const response = await fetch(
    `${API_BASE_URL}/api/ml/optimize/recommendations?symbol=${symbol}&modelType=${modelType}`,
    { credentials: "include" }
  );

  if (!response.ok) {
    throw new Error(`Failed to get recommendations: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

// Model Management types
export type SavedModel = {
  symbol: string;
  modelType: string;
  version: string;
  lastTrained: number;
  size: number;
};

export type ModelStats = {
  symbol: string;
  modelType: string;
  version: string;
  trainedAt: number;
  accuracy: number;
  mae: number;
  rmse: number;
  mape: number;
  r2Score: number;
  directionalAccuracy: number;
  trainingDuration: number;
  dataPoints: number;
};

/**
 * List all saved models
 */
export async function listModels(): Promise<{
  models: SavedModel[];
  count: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/ml/models`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to list models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get model statistics
 */
export async function getModelStats(symbol: string): Promise<ModelStats> {
  const response = await fetch(
    `${API_BASE_URL}/api/ml/models/${symbol}/stats`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get model stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Save model manually after backtest
 */
export async function saveModel(params: {
  symbol: string;
  modelType: ModelType;
  config: Record<string, number>;
  metrics: {
    mae: number;
    rmse: number;
    mape: number;
    r2Score: number;
    directionalAccuracy: number;
  };
}): Promise<{
  message: string;
  symbol: string;
  modelType: string;
  accuracy: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/ml/models/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Failed to save model: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete a model
 */
export async function deleteModel(symbol: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/ml/models/${symbol}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete model: ${response.statusText}`);
  }
}

/**
 * Cleanup old models
 */
export async function cleanupModels(
  olderThan?: number
): Promise<{ deleted: number }> {
  const body = olderThan ? { olderThan } : {};

  const response = await fetch(`${API_BASE_URL}/api/ml/models/cleanup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to cleanup models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

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

/**
 * Train a new ML model
 */
export async function trainModel(
  config: TrainRequest
): Promise<TrainingResult> {
  const response = await fetch(`${API_BASE_URL}/api/ml/train`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Training failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

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

/**
 * Detect anomalies in market data
 */
export async function detectAnomalies(
  params: AnomalyDetectionRequest
): Promise<AnomalyDetectionResult> {
  const response = await fetch(`${API_BASE_URL}/api/ml/anomalies/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Anomaly detection failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

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

/**
 * Run batch predictions for multiple symbols
 */
export async function batchPredict(
  params: BatchPredictionRequest
): Promise<BatchPredictionResult> {
  const response = await fetch(`${API_BASE_URL}/api/ml/predict/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Batch prediction failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

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

/**
 * Run ensemble prediction combining multiple models
 */
export async function ensemblePredict(
  params: EnsemblePredictionRequest
): Promise<EnsemblePredictionResult> {
  const response = await fetch(`${API_BASE_URL}/api/ml/predict/ensemble`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Ensemble prediction failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}
