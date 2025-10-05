import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";
import {
  type LSTMConfig,
  LSTMNetwork,
  type TrainingData,
} from "../models/lstm";
import type {
  PredictionPoint,
  PredictionRequest,
  PredictionResult,
} from "../types";
import type { FeatureEngineeringService } from "./feature-engineering";

const SEQUENCE_LENGTH = 20; // 20 candles lookback
const HIDDEN_SIZE = 32; // Hidden layer size
const LEARNING_RATE = 0.001;
const TRAINING_EPOCHS = 100;
const HOUR_MS = 3_600_000;

type ModelCache = {
  model: LSTMNetwork;
  symbol: string;
  lastTrained: number;
  accuracy: number;
};

/**
 * LSTM-based Price Prediction Service
 */
export class LSTMPredictionService {
  private models: Map<string, ModelCache> = new Map();
  private readonly modelExpiry = 86_400_000; // 24 hours

  constructor(
    _clickhouse: ClickHouseClient,
    private featureService: FeatureEngineeringService,
    private logger: Logger
  ) {}

  /**
   * Predict price using LSTM
   */
  async predictPrice(params: PredictionRequest): Promise<PredictionResult> {
    try {
      const { symbol, horizon, confidence } = params;

      this.logger.info("LSTM prediction starting", { symbol, horizon });

      // Get or train model
      const modelCache = await this.getOrTrainModel(symbol);

      // Extract recent features
      const features = await this.featureService.extractFeatures(symbol, 100);

      if (features.length < SEQUENCE_LENGTH) {
        throw new Error("Insufficient data for LSTM prediction");
      }

      // Prepare sequence
      const sequence = this.prepareSequence(features);
      const currentPrice = features.at(-1)?.price.close || 0;

      // Determine steps based on horizon
      const steps = this.getStepsForHorizon(horizon);

      // Generate predictions
      const rawPredictions = modelCache.model.predictMultiStep(sequence, steps);

      // Convert to price predictions with confidence intervals
      const predictions = this.convertToPredictions(
        rawPredictions,
        currentPrice,
        confidence,
        features.at(-1)?.price.volatility || 0.1
      );

      // Calculate technical indicators
      const lastFeature = features.at(-1);
      const technicalIndicators = lastFeature
        ? {
            rsi: lastFeature.technical.rsi,
            macd: lastFeature.technical.macd,
            ema20: lastFeature.technical.ema20,
            ema50: lastFeature.technical.ema50,
            bbUpper: lastFeature.technical.bbUpper,
            bbLower: lastFeature.technical.bbLower,
          }
        : {};

      return {
        symbol,
        horizon,
        predictions,
        features: {
          technicalIndicators,
          onChainMetrics: {},
          sentimentScore: 0,
          marketRegime: this.inferRegime(features),
          volatility: lastFeature?.price.volatility || 0,
          momentum: this.calculateMomentum(features),
        },
        modelInfo: {
          version: "1.0.0-lstm",
          lastTrained: modelCache.lastTrained,
          accuracy: modelCache.accuracy,
          confidence: modelCache.accuracy,
        },
        generatedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error("LSTM prediction failed", {
        symbol: params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get or train LSTM model for symbol
   */
  private async getOrTrainModel(symbol: string): Promise<ModelCache> {
    const cached = this.models.get(symbol);

    // Check if model is still valid
    if (cached && Date.now() - cached.lastTrained < this.modelExpiry) {
      return cached;
    }

    this.logger.info("Training new LSTM model", { symbol });

    // Extract features for training
    const features = await this.featureService.extractFeatures(symbol, 500);

    if (features.length < 100) {
      throw new Error("Insufficient data for model training");
    }

    // Prepare training data
    const trainingData = this.prepareTrainingData(features);

    // Create and train model
    const config: LSTMConfig = {
      inputSize: 1, // Using only close price for simplicity
      hiddenSize: HIDDEN_SIZE,
      outputSize: 1,
      learningRate: LEARNING_RATE,
      sequenceLength: SEQUENCE_LENGTH,
    };

    const model = new LSTMNetwork(config);

    // Train model
    const losses = await model.train(trainingData, TRAINING_EPOCHS);

    // Calculate accuracy (1 - final loss)
    const finalLoss = losses.at(-1) || 1;
    const accuracy = Math.max(0, 1 - finalLoss);

    const modelCache: ModelCache = {
      model,
      symbol,
      lastTrained: Date.now(),
      accuracy,
    };

    this.models.set(symbol, modelCache);

    this.logger.info("LSTM model trained", {
      symbol,
      epochs: losses.length,
      finalLoss,
      accuracy,
    });

    return modelCache;
  }

  /**
   * Prepare training data from features
   */
  private prepareTrainingData(
    features: Awaited<ReturnType<typeof this.featureService.extractFeatures>>
  ): TrainingData[] {
    const trainingData: TrainingData[] = [];

    // Normalize prices
    const prices = features.map((f) => f.price.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    const normalizedPrices = prices.map((p) => (p - minPrice) / range);

    // Create sequences
    for (let i = SEQUENCE_LENGTH; i < normalizedPrices.length; i++) {
      const input = normalizedPrices
        .slice(i - SEQUENCE_LENGTH, i)
        .map((p) => [p]);
      const output = [normalizedPrices[i]];

      trainingData.push({ input, output });
    }

    return trainingData;
  }

  /**
   * Prepare sequence for prediction
   */
  private prepareSequence(
    features: Awaited<ReturnType<typeof this.featureService.extractFeatures>>
  ): number[][] {
    const prices = features.slice(-SEQUENCE_LENGTH).map((f) => f.price.close);

    // Normalize
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    return prices.map((p) => [(p - minPrice) / range]);
  }

  /**
   * Convert raw predictions to PredictionPoints
   */
  private convertToPredictions(
    rawPredictions: number[][],
    currentPrice: number,
    confidence: number,
    volatility: number
  ): PredictionPoint[] {
    const predictions: PredictionPoint[] = [];

    // Get normalization params from current price
    const basePrice = currentPrice;

    for (let i = 0; i < rawPredictions.length; i++) {
      const normalizedPrediction = rawPredictions[i][0];

      // Denormalize prediction
      const predictedPrice = basePrice * (1 + normalizedPrediction * 0.1);

      // Calculate confidence interval
      const uncertainty = volatility * Math.sqrt(i + 1);
      const zScore = this.getZScore(confidence);
      const margin = predictedPrice * uncertainty * zScore;

      predictions.push({
        timestamp: Date.now() + (i + 1) * HOUR_MS,
        predictedPrice,
        lowerBound: predictedPrice - margin,
        upperBound: predictedPrice + margin,
        confidence,
      });
    }

    return predictions;
  }

  /**
   * Get Z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Get steps based on horizon
   */
  private getStepsForHorizon(horizon: string): number {
    const horizonMap: Record<string, number> = {
      "1h": 1,
      "4h": 4,
      "1d": 24,
      "7d": 168,
    };

    return horizonMap[horizon] || 1;
  }

  /**
   * Infer market regime from features
   */
  private inferRegime(
    features: Awaited<ReturnType<typeof this.featureService.extractFeatures>>
  ): "BULL" | "BEAR" | "SIDEWAYS" {
    const recentFeatures = features.slice(-20);
    const prices = recentFeatures.map((f) => f.price.close);

    // Simple trend calculation
    const firstPrice = prices[0];
    const lastPrice = prices.at(-1) || firstPrice;
    const change = (lastPrice - firstPrice) / firstPrice;

    if (change > 0.02) return "BULL";
    if (change < -0.02) return "BEAR";
    return "SIDEWAYS";
  }

  /**
   * Calculate momentum
   */
  private calculateMomentum(
    features: Awaited<ReturnType<typeof this.featureService.extractFeatures>>
  ): number {
    const recentFeatures = features.slice(-14);
    if (recentFeatures.length < 2) return 0;

    const firstPrice = recentFeatures[0].price.close;
    const lastPrice = recentFeatures.at(-1)?.price.close || firstPrice;

    return (lastPrice - firstPrice) / firstPrice;
  }

  /**
   * Clear cached models
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      this.models.delete(symbol);
    } else {
      this.models.clear();
    }
  }

  /**
   * Get model statistics
   */
  getModelStats(): Record<string, { accuracy: number; age: number }> {
    const stats: Record<string, { accuracy: number; age: number }> = {};

    for (const [symbol, cache] of this.models.entries()) {
      stats[symbol] = {
        accuracy: cache.accuracy,
        age: Date.now() - cache.lastTrained,
      };
    }

    return stats;
  }
}
