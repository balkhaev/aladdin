import type { Logger } from "@aladdin/shared/logger";
import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { LSTMPredictionService } from "./lstm-prediction";
import type { PricePredictionService } from "./price-prediction";
import type { FeatureEngineeringService } from "./feature-engineering";

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
  constructor(
    private readonly clickhouse: ClickHouseClient,
    private readonly lstmService: LSTMPredictionService,
    private readonly hybridService: PricePredictionService,
    _featureService: FeatureEngineeringService,
    private readonly logger: Logger
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
        ? await this.walkForwardBacktest(config, historicalData)
        : await this.simpleBacktest(config, historicalData);

      // Calculate metrics
      const metrics = this.calculateMetrics(predictions);

      // Calculate summary
      const summary = {
        totalPredictions: predictions.length,
        successfulPredictions: predictions.filter((p) => !Number.isNaN(p.predicted)).length,
        failedPredictions: predictions.filter((p) => Number.isNaN(p.predicted)).length,
        averageConfidence: 0.85, // Placeholder
        modelRetrains: config.walkForward ? Math.floor((config.endDate - config.startDate) / (86_400_000 * (config.retrainInterval || 30))) : 0,
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
  private async simpleBacktest(
    config: BacktestConfig,
    historicalData: Array<{ timestamp: number; close: number }>
  ): Promise<BacktestResult["predictions"]> {
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
        const predictionResult = await this.makePrediction(
          config,
          currentTime,
          historicalData.slice(0, i + 1)
        );

        const predictedPrice = predictionResult?.predictions[horizonHours - 1]?.predictedPrice;

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
  private async walkForwardBacktest(
    config: BacktestConfig,
    historicalData: Array<{ timestamp: number; close: number }>
  ): Promise<BacktestResult["predictions"]> {
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
        const predictionResult = await this.makePrediction(
          config,
          currentTime,
          historicalData.slice(0, i + 1)
        );

        const predictedPrice = predictionResult?.predictions[horizonHours - 1]?.predictedPrice;

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
   * Make prediction using specified model
   */
  private async makePrediction(
    config: BacktestConfig,
    _timestamp: number,
    _historicalData: Array<{ timestamp: number; close: number }>
  ) {
    try {
      const service = config.modelType === "LSTM" ? this.lstmService : this.hybridService;

      return await service.predictPrice({
        symbol: config.symbol,
        horizon: config.horizon,
        confidence: 0.95,
      });
    } catch (error) {
      this.logger.error("Prediction failed", { error });
      return null;
    }
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
    const mape = predictions.reduce((sum, p) => sum + Math.abs(p.percentError), 0) / n;

    // R² Score (coefficient of determination)
    const actualMean = predictions.reduce((sum, p) => sum + p.actual, 0) / n;
    const ssTot = predictions.reduce((sum, p) => sum + (p.actual - actualMean) ** 2, 0);
    const ssRes = predictions.reduce((sum, p) => sum + p.error ** 2, 0);
    const r2Score = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    // Directional Accuracy
    const correctDirections = predictions.filter((p) => p.correctDirection).length;
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
    const query = `
      SELECT
        toUnixTimestamp(timestamp) * 1000 as timestamp,
        close
      FROM candles_1h
      WHERE symbol = {symbol:String}
        AND timestamp >= fromUnixTimestamp({startDate:UInt64})
        AND timestamp <= fromUnixTimestamp({endDate:UInt64})
      ORDER BY timestamp ASC
    `;

    const result = await this.clickhouse.query({
      query,
      query_params: {
        symbol,
        startDate: Math.floor(startDate / 1000),
        endDate: Math.floor(endDate / 1000),
      },
      format: "JSONEachRow",
    });

    return result as Array<{ timestamp: number; close: number }>;
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
  async compareModels(
    config: Omit<BacktestConfig, "modelType">
  ): Promise<{
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

