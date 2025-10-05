import { z } from "zod";

// Prediction types
export type PredictionHorizon = "1h" | "4h" | "1d" | "7d";
export type MarketRegime = "BULL" | "BEAR" | "SIDEWAYS";

const DEFAULT_CONFIDENCE = 0.95;
const MAX_DAYS = 365;
const DEFAULT_LOOKBACK_DAYS = 30;

export const PredictionRequestSchema = z.object({
  symbol: z.string().min(1),
  horizon: z.enum(["1h", "4h", "1d", "7d"]),
  confidence: z.number().min(0).max(1).optional().default(DEFAULT_CONFIDENCE),
});

export type PredictionRequest = z.infer<typeof PredictionRequestSchema>;

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
    sentimentScore: number;
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
  generatedAt: number;
};

// Market Regime Detection
export const MarketRegimeRequestSchema = z.object({
  symbol: z.string().min(1),
  lookback: z
    .number()
    .min(1)
    .max(MAX_DAYS)
    .optional()
    .default(DEFAULT_LOOKBACK_DAYS),
});

export type MarketRegimeRequest = z.infer<typeof MarketRegimeRequestSchema>;

export type MarketRegimeResult = {
  symbol: string;
  currentRegime: MarketRegime;
  confidence: number;
  regimeHistory: Array<{
    timestamp: number;
    regime: MarketRegime;
    confidence: number;
  }>;
  indicators: {
    trend: number; // -1 to 1
    volatility: number;
    volume: number;
    momentum: number;
  };
  nextRegimeProb: {
    BULL: number;
    BEAR: number;
    SIDEWAYS: number;
  };
  generatedAt: number;
};

// Feature Engineering
export type TechnicalFeatures = {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  ema20: number;
  ema50: number;
  ema200: number;
  sma20: number;
  sma50: number;
  sma200: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  atr: number;
  adx: number;
  obv: number;
};

export type PriceFeatures = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  returns: number;
  logReturns: number;
  volatility: number;
  highLowSpread: number;
  openCloseSpread: number;
};

export type FeatureSet = {
  timestamp: number;
  price: PriceFeatures;
  technical: TechnicalFeatures;
  onChain?: Record<string, number>;
  sentiment?: number;
};

// Model training
export type ModelTrainingConfig = {
  symbol: string;
  modelType: "LSTM" | "GRU" | "TRANSFORMER";
  lookbackWindow: number;
  forecastHorizon: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
};

export type TrainingResult = {
  modelId: string;
  symbol: string;
  modelType: string;
  metrics: {
    loss: number;
    mae: number;
    rmse: number;
    mape: number;
    r2Score: number;
  };
  trainingDuration: number;
  trainingDataPoints: number;
  validationDataPoints: number;
  completedAt: number;
};
