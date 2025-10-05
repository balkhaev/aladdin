/**
 * ML Service API Client
 * Routes through API Gateway (port 3000)
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Model comparison failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
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
    `${API_BASE_URL}/api/ml/optimize/recommendations?symbol=${symbol}&modelType=${modelType}`
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
  const response = await fetch(`${API_BASE_URL}/api/ml/models`);

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
  const response = await fetch(`${API_BASE_URL}/api/ml/models/${symbol}/stats`);

  if (!response.ok) {
    throw new Error(`Failed to get model stats: ${response.statusText}`);
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
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Failed to cleanup models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}
