import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import {
  type LSTMConfig,
  LSTMNetwork,
  type TrainingData,
} from "../models/lstm";
import type { LSTMPredictionService } from "./lstm-prediction";

/**
 * Evaluation Metrics
 */
export type EvaluationMetrics = {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2Score: number; // R² Score (coefficient of determination)
  directionalAccuracy: number; // % correct direction predictions
  meanError: number; // Mean Error (bias)
  maxError: number; // Maximum Error
  minError: number; // Minimum Error
};

/**
 * Backtest Configuration
 */
export type BacktestConfig = {
  symbol: string;
  modelType: "LSTM" | "HYBRID";
  horizon: "1h" | "4h" | "1d" | "7d";
  startDate: number; // timestamp
  endDate: number; // timestamp
  walkForward: boolean; // Use walk-forward testing
  retrainInterval?: number; // Retrain every N days
  // LSTM hyperparameters
  hiddenSize?: number;
  sequenceLength?: number;
  learningRate?: number;
  epochs?: number;
  // Hybrid hyperparameters
  lookbackWindow?: number;
  smoothingFactor?: number;
};

/**
 * Backtest Result
 */
export type BacktestResult = {
  config: BacktestConfig;
  metrics: EvaluationMetrics;
  predictions: Array<{
    timestamp: number;
    actual: number;
    predicted: number;
    error: number;
    percentError: number;
    correctDirection: boolean;
  }>;
  summary: {
    totalPredictions: number;
    successfulPredictions: number;
    failedPredictions: number;
    averageConfidence: number;
    modelRetrains: number;
  };
  executionTime: number;
  completedAt: number;
};

const HORIZON_TO_HOURS: Record<string, number> = {
  "1h": 1,
  "4h": 4,
  "1d": 24,
  "7d": 168,
};

/**
 * Backtesting Service
 * Test model accuracy on historical data
 */
export class BacktestingService {
  private modelCache: Map<string, LSTMNetwork> = new Map();

  constructor(
    private readonly clickhouse: ClickHouseClient,
    private readonly logger: Logger,
    private readonly lstmService: LSTMPredictionService
  ) {}

  /**
   * Run backtest on historical data
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting backtest", config);

      // Validate config
      this.validateConfig(config);

      // Get historical data
      const historicalData = await this.getHistoricalData(
        config.symbol,
        config.startDate,
        config.endDate
      );

      if (historicalData.length < 50) {
        throw new Error("Insufficient historical data for backtesting");
      }

      // Run predictions and compare with actuals
      const predictions = config.walkForward
        ? this.walkForwardBacktest(config, historicalData)
        : this.simpleBacktest(config, historicalData);

      // Calculate metrics
      const metrics = this.calculateMetrics(predictions);

      // Calculate summary
      const summary = {
        totalPredictions: predictions.length,
        successfulPredictions: predictions.filter(
          (p) => !Number.isNaN(p.predicted)
        ).length,
        failedPredictions: predictions.filter((p) => Number.isNaN(p.predicted))
          .length,
        averageConfidence: 0.85, // Placeholder
        modelRetrains: config.walkForward
          ? Math.floor(
              (config.endDate - config.startDate) /
                (86_400_000 * (config.retrainInterval || 30))
            )
          : 0,
      };

      const executionTime = Date.now() - startTime;

      this.logger.info("Backtest completed", {
        symbol: config.symbol,
        predictions: predictions.length,
        mae: metrics.mae,
        rmse: metrics.rmse,
        directionalAccuracy: metrics.directionalAccuracy,
        executionTime,
      });

      return {
        config,
        metrics,
        predictions,
        summary,
        executionTime,
        completedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error("Backtest failed", {
        config,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Simple backtest (single model, no retraining)
   */
  private simpleBacktest(
    config: BacktestConfig,
    historicalData: Array<{ timestamp: number; close: number }>
  ): BacktestResult["predictions"] {
    const predictions: BacktestResult["predictions"] = [];
    const horizonHours = HORIZON_TO_HOURS[config.horizon];

    // For each data point, make prediction and compare with future actual
    for (let i = 50; i < historicalData.length - horizonHours; i++) {
      const currentTime = historicalData[i].timestamp;
      const currentPrice = historicalData[i].close;

      // Get actual future price
      const futureIndex = i + horizonHours;
      const actualFuturePrice = historicalData[futureIndex]?.close;

      if (!actualFuturePrice) continue;

      try {
        // Make prediction (using features up to current time)
        const predictionResult = this.makePrediction(
          config,
          currentTime,
          historicalData.slice(0, i + 1)
        );

        const predictedPrice = predictionResult?.predictions[0]?.predictedPrice;

        if (!predictedPrice || Number.isNaN(predictedPrice)) {
          this.logger.warn("Invalid prediction", { timestamp: currentTime });
          continue;
        }

        // Calculate error
        const error = predictedPrice - actualFuturePrice;
        const percentError = (error / actualFuturePrice) * 100;

        // Check direction
        const predictedDirection = predictedPrice > currentPrice;
        const actualDirection = actualFuturePrice > currentPrice;
        const correctDirection = predictedDirection === actualDirection;

        predictions.push({
          timestamp: currentTime,
          actual: actualFuturePrice,
          predicted: predictedPrice,
          error,
          percentError,
          correctDirection,
        });
      } catch (error) {
        this.logger.warn("Prediction failed for timestamp", {
          timestamp: currentTime,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return predictions;
  }

  /**
   * Walk-forward backtest (retrain model periodically)
   */
  private walkForwardBacktest(
    config: BacktestConfig,
    historicalData: Array<{ timestamp: number; close: number }>
  ): BacktestResult["predictions"] {
    const predictions: BacktestResult["predictions"] = [];
    const horizonHours = HORIZON_TO_HOURS[config.horizon];
    const retrainIntervalMs = (config.retrainInterval || 30) * 86_400_000;

    let lastRetrainTime = config.startDate;

    for (let i = 50; i < historicalData.length - horizonHours; i++) {
      const currentTime = historicalData[i].timestamp;
      const currentPrice = historicalData[i].close;

      // Check if we need to retrain
      if (currentTime - lastRetrainTime >= retrainIntervalMs) {
        this.logger.info("Retraining model for walk-forward test", {
          timestamp: currentTime,
        });

        // Clear model cache to force retraining
        this.lstmService.clearCache(config.symbol);
        lastRetrainTime = currentTime;
      }

      // Get actual future price
      const futureIndex = i + horizonHours;
      const actualFuturePrice = historicalData[futureIndex]?.close;

      if (!actualFuturePrice) continue;

      try {
        // Make prediction
        const predictionResult = this.makePrediction(
          config,
          currentTime,
          historicalData.slice(0, i + 1)
        );

        const predictedPrice = predictionResult?.predictions[0]?.predictedPrice;

        if (!predictedPrice || Number.isNaN(predictedPrice)) continue;

        // Calculate metrics
        const error = predictedPrice - actualFuturePrice;
        const percentError = (error / actualFuturePrice) * 100;

        const predictedDirection = predictedPrice > currentPrice;
        const actualDirection = actualFuturePrice > currentPrice;
        const correctDirection = predictedDirection === actualDirection;

        predictions.push({
          timestamp: currentTime,
          actual: actualFuturePrice,
          predicted: predictedPrice,
          error,
          percentError,
          correctDirection,
        });
      } catch (error) {
        this.logger.warn("Walk-forward prediction failed", {
          timestamp: currentTime,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return predictions;
  }

  /**
   * Make prediction using selected model
   */
  private makePrediction(
    config: BacktestConfig,
    _timestamp: number,
    historicalData: Array<{ timestamp: number; close: number }>
  ): { predictions: Array<{ predictedPrice: number }> } | null {
    try {
      if (config.modelType === "LSTM") {
        return this.makeLSTMPrediction(config, historicalData);
      }
      return this.makeHybridPrediction(config, historicalData);
    } catch (error) {
      this.logger.error("Prediction failed", { error });
      return null;
    }
  }

  /**
   * Make prediction using LSTM model
   */
  private makeLSTMPrediction(
    config: BacktestConfig,
    historicalData: Array<{ timestamp: number; close: number }>
  ): { predictions: Array<{ predictedPrice: number }> } | null {
    try {
      // Use hyperparameters from config or defaults
      const sequenceLength = config.sequenceLength || 20;
      const hiddenSize = config.hiddenSize || 32;
      const learningRate = config.learningRate || 0.001;
      const epochs = config.epochs || 100;

      // Need enough data for training
      if (historicalData.length < sequenceLength + 10) {
        return null;
      }

      // Get or train model with these hyperparameters
      const cacheKey = `${config.symbol}_${hiddenSize}_${sequenceLength}_${learningRate}`;
      let model = this.modelCache.get(cacheKey);

      if (!model) {
        // Train new model
        const lstmConfig: LSTMConfig = {
          inputSize: 1,
          hiddenSize,
          outputSize: 1,
          learningRate,
          sequenceLength,
        };

        model = new LSTMNetwork(lstmConfig);

        // Prepare training data
        const trainingData = this.prepareLSTMTrainingData(
          historicalData,
          sequenceLength
        );

        // Train model (without await - synchronous)
        model.train(trainingData, epochs);

        // Cache model
        this.modelCache.set(cacheKey, model);
      }

      // Make prediction
      const recentPrices = historicalData
        .slice(-sequenceLength)
        .map((d) => d.close);

      // Normalize
      const minPrice = Math.min(...recentPrices);
      const maxPrice = Math.max(...recentPrices);
      const range = maxPrice - minPrice || 1;
      const normalizedPrices = recentPrices.map((p) => (p - minPrice) / range);

      // Predict - LSTM expects input in same format as training: number[][]
      // where each timestep is [price]
      const input: number[][] = normalizedPrices.map((p) => [p]);
      const normalizedPredictions = model.predict(input);

      // Denormalize
      const predictedPrice = normalizedPredictions[0] * range + minPrice;

      return {
        predictions: [{ predictedPrice }],
      };
    } catch (error) {
      this.logger.error("LSTM prediction failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        historicalDataLength: historicalData.length,
        config,
      });
      return null;
    }
  }

  /**
   * Make prediction using Hybrid model (SMA + momentum)
   */
  private makeHybridPrediction(
    config: BacktestConfig,
    historicalData: Array<{ timestamp: number; close: number }>
  ): { predictions: Array<{ predictedPrice: number }> } | null {
    try {
      const lookbackWindow = config.lookbackWindow || 20;
      const smoothingFactor = config.smoothingFactor || 0.2;

      const lookback = Math.min(lookbackWindow, historicalData.length);
      const recentPrices = historicalData.slice(-lookback).map((d) => d.close);

      // Calculate SMA
      const sma =
        recentPrices.reduce((sum, price) => sum + price, 0) / lookback;

      // Calculate EMA with smoothing factor
      let ema = recentPrices[0];
      for (const price of recentPrices) {
        ema = smoothingFactor * price + (1 - smoothingFactor) * ema;
      }

      // Calculate trend (momentum)
      const oldPrice = recentPrices[0];
      const currentPrice = recentPrices.at(-1) || oldPrice;
      const momentum = (currentPrice - oldPrice) / oldPrice;

      // Hybrid prediction: weighted average of SMA and EMA + momentum
      const horizonHours = HORIZON_TO_HOURS[config.horizon];
      const basePrediction = 0.5 * sma + 0.5 * ema;
      const predictedPrice =
        basePrediction * (1 + (momentum * horizonHours) / 24);

      return {
        predictions: [{ predictedPrice }],
      };
    } catch (error) {
      this.logger.error("Hybrid prediction failed", { error });
      return null;
    }
  }

  /**
   * Prepare training data for LSTM
   */
  private prepareLSTMTrainingData(
    historicalData: Array<{ timestamp: number; close: number }>,
    sequenceLength: number
  ): TrainingData[] {
    const prices = historicalData.map((d) => d.close);

    // Normalize prices
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const normalizedPrices = prices.map((p) => (p - minPrice) / range);

    const trainingData: TrainingData[] = [];

    for (let i = 0; i < normalizedPrices.length - sequenceLength; i++) {
      const input: number[][] = [];
      for (let j = 0; j < sequenceLength; j++) {
        input.push([normalizedPrices[i + j]]);
      }
      const output = [normalizedPrices[i + sequenceLength]];

      trainingData.push({ input, output });
    }

    return trainingData;
  }

  /**
   * Calculate evaluation metrics
   */
  private calculateMetrics(
    predictions: Array<{
      actual: number;
      predicted: number;
      error: number;
      percentError: number;
      correctDirection: boolean;
    }>
  ): EvaluationMetrics {
    if (predictions.length === 0) {
      return {
        mae: 0,
        rmse: 0,
        mape: 0,
        r2Score: 0,
        directionalAccuracy: 0,
        meanError: 0,
        maxError: 0,
        minError: 0,
      };
    }

    const n = predictions.length;

    // Mean Absolute Error
    const mae = predictions.reduce((sum, p) => sum + Math.abs(p.error), 0) / n;

    // Root Mean Squared Error
    const mse = predictions.reduce((sum, p) => sum + p.error ** 2, 0) / n;
    const rmse = Math.sqrt(mse);

    // Mean Absolute Percentage Error
    const mape =
      predictions.reduce((sum, p) => sum + Math.abs(p.percentError), 0) / n;

    // R² Score (coefficient of determination)
    const actualMean = predictions.reduce((sum, p) => sum + p.actual, 0) / n;
    const ssTot = predictions.reduce(
      (sum, p) => sum + (p.actual - actualMean) ** 2,
      0
    );
    const ssRes = predictions.reduce((sum, p) => sum + p.error ** 2, 0);
    const r2Score = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    // Directional Accuracy
    const correctDirections = predictions.filter(
      (p) => p.correctDirection
    ).length;
    const directionalAccuracy = (correctDirections / n) * 100;

    // Mean Error (bias)
    const meanError = predictions.reduce((sum, p) => sum + p.error, 0) / n;

    // Max/Min Error
    const errors = predictions.map((p) => p.error);
    const maxError = Math.max(...errors);
    const minError = Math.min(...errors);

    return {
      mae,
      rmse,
      mape,
      r2Score,
      directionalAccuracy,
      meanError,
      maxError,
      minError,
    };
  }

  /**
   * Get historical data from ClickHouse
   */
  private async getHistoricalData(
    symbol: string,
    startDate: number,
    endDate: number
  ): Promise<Array<{ timestamp: number; close: number }>> {
    this.logger.info("Fetching historical data", {
      symbol,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    });

    // Query historical candles from aladdin database
    // Use DateTime comparison instead of unix timestamp for better accuracy
    // Aggregate data from multiple exchanges using AVG
    const startDateSeconds = Math.floor(startDate / 1000);
    const endDateSeconds = Math.floor(endDate / 1000);

    this.logger.info("Query parameters", {
      symbol,
      startDateSeconds,
      endDateSeconds,
    });

    const query = `
      SELECT 
        toUnixTimestamp(timestamp) * 1000 as ts,
        AVG(close) as close
      FROM aladdin.candles 
      WHERE symbol = '${symbol}'
        AND timeframe = '1h'
        AND timestamp >= toDateTime(${startDateSeconds})
        AND timestamp <= toDateTime(${endDateSeconds})
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `;

    this.logger.info("Executing query", { query: query.trim() });

    const rawResult = await this.clickhouse.query<{
      ts: number;
      close: number;
    }>(query);

    this.logger.info("Raw result from ClickHouse", {
      rowCount: rawResult.length,
      sample: rawResult.slice(0, 2),
    });

    // Map ts to timestamp for consistency
    const result = rawResult.map((row) => ({
      timestamp: Number(row.ts),
      close: Number(row.close),
    }));

    const firstItem = result.at(0);
    const lastItem = result.at(-1);

    this.logger.info("Historical data fetched", {
      symbol,
      rowCount: result.length,
      firstItem: firstItem
        ? { ts: firstItem.timestamp, close: firstItem.close }
        : null,
      lastItem: lastItem
        ? { ts: lastItem.timestamp, close: lastItem.close }
        : null,
      firstTimestamp: firstItem?.timestamp
        ? new Date(firstItem.timestamp).toISOString()
        : null,
      lastTimestamp: lastItem?.timestamp
        ? new Date(lastItem.timestamp).toISOString()
        : null,
    });

    return result;
  }

  /**
   * Validate backtest configuration
   */
  private validateConfig(config: BacktestConfig): void {
    if (!config.symbol) {
      throw new Error("Symbol is required");
    }

    if (config.endDate <= config.startDate) {
      throw new Error("End date must be after start date");
    }

    const duration = config.endDate - config.startDate;
    const minDuration = 7 * 86_400_000; // 7 days

    if (duration < minDuration) {
      throw new Error("Backtest duration must be at least 7 days");
    }
  }

  /**
   * Compare two models
   */
  async compareModels(config: Omit<BacktestConfig, "modelType">): Promise<{
    lstm: BacktestResult;
    hybrid: BacktestResult;
    comparison: {
      winner: "LSTM" | "HYBRID" | "TIE";
      lstmBetter: string[];
      hybridBetter: string[];
    };
  }> {
    // Run both backtests
    const lstm = await this.runBacktest({ ...config, modelType: "LSTM" });
    const hybrid = await this.runBacktest({ ...config, modelType: "HYBRID" });

    // Compare results
    const lstmBetter: string[] = [];
    const hybridBetter: string[] = [];

    // Compare metrics
    if (lstm.metrics.mae < hybrid.metrics.mae) {
      lstmBetter.push("MAE");
    } else {
      hybridBetter.push("MAE");
    }

    if (lstm.metrics.rmse < hybrid.metrics.rmse) {
      lstmBetter.push("RMSE");
    } else {
      hybridBetter.push("RMSE");
    }

    if (lstm.metrics.mape < hybrid.metrics.mape) {
      lstmBetter.push("MAPE");
    } else {
      hybridBetter.push("MAPE");
    }

    if (lstm.metrics.r2Score > hybrid.metrics.r2Score) {
      lstmBetter.push("R²");
    } else {
      hybridBetter.push("R²");
    }

    if (lstm.metrics.directionalAccuracy > hybrid.metrics.directionalAccuracy) {
      lstmBetter.push("Directional Accuracy");
    } else {
      hybridBetter.push("Directional Accuracy");
    }

    // Determine winner
    let winner: "LSTM" | "HYBRID" | "TIE" = "TIE";
    if (lstmBetter.length > hybridBetter.length) {
      winner = "LSTM";
    } else if (hybridBetter.length > lstmBetter.length) {
      winner = "HYBRID";
    }

    return {
      lstm,
      hybrid,
      comparison: {
        winner,
        lstmBetter,
        hybridBetter,
      },
    };
  }
}
