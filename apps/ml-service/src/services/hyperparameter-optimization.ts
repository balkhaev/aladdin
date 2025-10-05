/**
 * Hyperparameter Optimization Service
 * Automatic parameter tuning for ML models
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { EvaluationMetrics, PredictionHorizon } from "../types";
import type { BacktestingService } from "./backtesting";

/**
 * Hyperparameter configuration
 */
export type HyperparameterSpace = {
  // LSTM parameters
  hiddenSize?: number[];
  sequenceLength?: number[];
  learningRate?: number[];
  epochs?: number[];

  // Hybrid parameters
  lookbackWindow?: number[];
  smoothingFactor?: number[];

  // General parameters
  retrainInterval?: number[];
};

/**
 * Optimization configuration
 */
export type OptimizationConfig = {
  symbol: string;
  modelType: "LSTM" | "HYBRID";
  horizon: PredictionHorizon;
  hyperparameterSpace: HyperparameterSpace;
  method: "GRID" | "RANDOM";
  nTrials?: number; // For random search
  startDate: number;
  endDate: number;
  optimizationMetric:
    | "mae"
    | "rmse"
    | "mape"
    | "r2Score"
    | "directionalAccuracy";
  crossValidationFolds?: number; // K-fold cross-validation
};

/**
 * Trial result
 */
export type TrialResult = {
  trialId: number;
  hyperparameters: Record<string, number>;
  metrics: EvaluationMetrics;
  score: number; // Optimization metric value
  executionTime: number;
  completedAt: number;
};

/**
 * Optimization result
 */
export type OptimizationResult = {
  config: OptimizationConfig;
  trials: TrialResult[];
  bestTrial: TrialResult;
  bestHyperparameters: Record<string, number>;
  improvementPercentage: number;
  totalExecutionTime: number;
  completedAt: number;
};

const DEFAULT_LSTM_SPACE: HyperparameterSpace = {
  hiddenSize: [16, 32, 64],
  sequenceLength: [10, 20, 30],
  learningRate: [0.0001, 0.001, 0.01],
  epochs: [50, 100, 200],
};

const DEFAULT_HYBRID_SPACE: HyperparameterSpace = {
  lookbackWindow: [20, 30, 50],
  smoothingFactor: [0.1, 0.2, 0.3],
};

const DEFAULT_N_TRIALS = 20;
const _DEFAULT_CV_FOLDS = 3;

/**
 * Hyperparameter Optimization Service
 */
export class HyperparameterOptimizationService {
  constructor(
    readonly _clickhouse: ClickHouseClient,
    private readonly backtestingService: BacktestingService,
    private readonly logger: Logger
  ) {}

  /**
   * Run hyperparameter optimization
   */
  async optimize(config: OptimizationConfig): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      this.logger.info("Starting hyperparameter optimization", {
        symbol: config.symbol,
        modelType: config.modelType,
        method: config.method,
      });

      // Validate configuration
      this.validateConfig(config);

      // Get hyperparameter space
      const space = this.getHyperparameterSpace(config);

      // Generate trials based on method
      const trials = await this.generateTrials(config, space);

      // Find best trial
      const bestTrial = this.findBestTrial(trials, config.optimizationMetric);

      // Calculate improvement
      const baselineScore = trials[0].score;
      const improvementPercentage = this.calculateImprovement(
        baselineScore,
        bestTrial.score,
        config.optimizationMetric
      );

      const totalExecutionTime = Date.now() - startTime;

      this.logger.info("Hyperparameter optimization completed", {
        symbol: config.symbol,
        bestScore: bestTrial.score,
        improvementPercentage,
        totalTrials: trials.length,
        executionTime: totalExecutionTime,
      });

      // Retrain final model with best hyperparameters to ensure it's saved
      this.logger.info("Retraining final model with best hyperparameters", {
        symbol: config.symbol,
        bestHyperparameters: bestTrial.hyperparameters,
      });

      await this.backtestingService.runBacktest({
        symbol: config.symbol,
        modelType: config.modelType,
        horizon: config.horizon,
        startDate: config.startDate,
        endDate: config.endDate,
        walkForward: true,
        retrainInterval: bestTrial.hyperparameters.retrainInterval,
        ...bestTrial.hyperparameters,
      });

      this.logger.info("Final optimized model saved to disk", {
        symbol: config.symbol,
      });

      return {
        config,
        trials,
        bestTrial,
        bestHyperparameters: bestTrial.hyperparameters,
        improvementPercentage,
        totalExecutionTime,
        completedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error("Hyperparameter optimization failed", {
        config,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate trials based on optimization method
   */
  private generateTrials(
    config: OptimizationConfig,
    space: HyperparameterSpace
  ): Promise<TrialResult[]> {
    if (config.method === "GRID") {
      return this.gridSearch(config, space);
    }
    return this.randomSearch(config, space);
  }

  /**
   * Grid search - try all combinations
   */
  private async gridSearch(
    config: OptimizationConfig,
    space: HyperparameterSpace
  ): Promise<TrialResult[]> {
    this.logger.info("Running grid search");

    // Generate all combinations
    const combinations = this.generateCombinations(space);

    this.logger.info(`Testing ${combinations.length} combinations`);

    // Run trials
    const trials: TrialResult[] = [];
    for (let i = 0; i < combinations.length; i++) {
      const hyperparameters = combinations[i];

      this.logger.info(
        `Trial ${i + 1}/${combinations.length}`,
        hyperparameters
      );

      const trial = await this.runTrial(i + 1, config, hyperparameters);

      trials.push(trial);
    }

    return trials;
  }

  /**
   * Random search - try random combinations
   */
  private async randomSearch(
    config: OptimizationConfig,
    space: HyperparameterSpace
  ): Promise<TrialResult[]> {
    const nTrials = config.nTrials || DEFAULT_N_TRIALS;

    this.logger.info(`Running random search with ${nTrials} trials`);

    const trials: TrialResult[] = [];
    for (let i = 0; i < nTrials; i++) {
      // Sample random hyperparameters
      const hyperparameters = this.sampleHyperparameters(space);

      this.logger.info(`Trial ${i + 1}/${nTrials}`, hyperparameters);

      const trial = await this.runTrial(i + 1, config, hyperparameters);

      trials.push(trial);
    }

    return trials;
  }

  /**
   * Run single trial
   */
  private async runTrial(
    trialId: number,
    config: OptimizationConfig,
    hyperparameters: Record<string, number>
  ): Promise<TrialResult> {
    const startTime = Date.now();

    try {
      // Run backtest with these hyperparameters
      const result = await this.backtestingService.runBacktest({
        symbol: config.symbol,
        modelType: config.modelType,
        horizon: config.horizon,
        startDate: config.startDate,
        endDate: config.endDate,
        walkForward: true,
        retrainInterval: hyperparameters.retrainInterval || 30,
        // LSTM hyperparameters
        hiddenSize: hyperparameters.hiddenSize,
        sequenceLength: hyperparameters.sequenceLength,
        learningRate: hyperparameters.learningRate,
        epochs: hyperparameters.epochs,
        // Hybrid hyperparameters
        lookbackWindow: hyperparameters.lookbackWindow,
        smoothingFactor: hyperparameters.smoothingFactor,
      });

      // Extract optimization metric
      const score = this.extractScore(
        result.metrics,
        config.optimizationMetric
      );

      return {
        trialId,
        hyperparameters,
        metrics: result.metrics,
        score,
        executionTime: Date.now() - startTime,
        completedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Trial ${trialId} failed`, {
        hyperparameters,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return worst possible score
      return {
        trialId,
        hyperparameters,
        metrics: {
          mae: Number.POSITIVE_INFINITY,
          rmse: Number.POSITIVE_INFINITY,
          mape: Number.POSITIVE_INFINITY,
          r2Score: Number.NEGATIVE_INFINITY,
          directionalAccuracy: 0,
          meanError: 0,
          maxError: 0,
          minError: 0,
        },
        score: this.getWorstScore(config.optimizationMetric),
        executionTime: Date.now() - startTime,
        completedAt: Date.now(),
      };
    }
  }

  /**
   * Generate all combinations of hyperparameters
   */
  private generateCombinations(
    space: HyperparameterSpace
  ): Record<string, number>[] {
    const keys = Object.keys(space);
    const values = keys.map(
      (key) => space[key as keyof HyperparameterSpace] || []
    );

    const combinations: Record<string, number>[] = [];

    const generate = (index: number, current: Record<string, number>) => {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }

      const key = keys[index];
      const vals = values[index];

      for (const val of vals) {
        current[key] = val;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  /**
   * Sample random hyperparameters from space
   */
  private sampleHyperparameters(
    space: HyperparameterSpace
  ): Record<string, number> {
    const hyperparameters: Record<string, number> = {};

    for (const [key, values] of Object.entries(space)) {
      if (values && values.length > 0) {
        const randomIndex = Math.floor(Math.random() * values.length);
        hyperparameters[key] = values[randomIndex];
      }
    }

    return hyperparameters;
  }

  /**
   * Find best trial based on optimization metric
   */
  private findBestTrial(
    trials: TrialResult[],
    metric: OptimizationConfig["optimizationMetric"]
  ): TrialResult {
    // For metrics where lower is better (MAE, RMSE, MAPE)
    const lowerIsBetter =
      metric === "mae" || metric === "rmse" || metric === "mape";

    let bestTrial = trials[0];

    for (const trial of trials) {
      if (lowerIsBetter) {
        if (trial.score < bestTrial.score) {
          bestTrial = trial;
        }
      } else if (trial.score > bestTrial.score) {
        bestTrial = trial;
      }
    }

    return bestTrial;
  }

  /**
   * Extract score from metrics
   */
  private extractScore(
    metrics: EvaluationMetrics,
    metric: OptimizationConfig["optimizationMetric"]
  ): number {
    switch (metric) {
      case "mae":
        return metrics.mae;
      case "rmse":
        return metrics.rmse;
      case "mape":
        return metrics.mape;
      case "r2Score":
        return metrics.r2Score;
      case "directionalAccuracy":
        return metrics.directionalAccuracy;
      default:
        return metrics.mae;
    }
  }

  /**
   * Get worst possible score for metric
   */
  private getWorstScore(
    metric: OptimizationConfig["optimizationMetric"]
  ): number {
    // For metrics where lower is better
    if (metric === "mae" || metric === "rmse" || metric === "mape") {
      return Number.POSITIVE_INFINITY;
    }
    // For metrics where higher is better
    return Number.NEGATIVE_INFINITY;
  }

  /**
   * Calculate improvement percentage
   */
  private calculateImprovement(
    baselineScore: number,
    bestScore: number,
    metric: OptimizationConfig["optimizationMetric"]
  ): number {
    // For metrics where lower is better
    if (metric === "mae" || metric === "rmse" || metric === "mape") {
      return ((baselineScore - bestScore) / baselineScore) * 100;
    }
    // For metrics where higher is better
    return ((bestScore - baselineScore) / baselineScore) * 100;
  }

  /**
   * Get hyperparameter space
   */
  private getHyperparameterSpace(
    config: OptimizationConfig
  ): HyperparameterSpace {
    // Use provided space or default
    if (Object.keys(config.hyperparameterSpace).length > 0) {
      return config.hyperparameterSpace;
    }

    // Use default space based on model type
    return config.modelType === "LSTM"
      ? DEFAULT_LSTM_SPACE
      : DEFAULT_HYBRID_SPACE;
  }

  /**
   * Validate optimization configuration
   */
  private validateConfig(config: OptimizationConfig): void {
    if (!config.symbol) {
      throw new Error("Symbol is required");
    }

    if (config.endDate <= config.startDate) {
      throw new Error("End date must be after start date");
    }

    const duration = config.endDate - config.startDate;
    const minDuration = 7 * 86_400_000; // 7 days

    if (duration < minDuration) {
      throw new Error("Optimization period must be at least 7 days");
    }

    // Check hyperparameter space
    const space = config.hyperparameterSpace;
    const hasParams = Object.values(space).some(
      (values) => values && values.length > 0
    );

    if (!hasParams && config.method === "GRID") {
      this.logger.warn("No hyperparameters provided, using defaults");
    }
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(
    _symbol: string,
    modelType: "LSTM" | "HYBRID"
  ): {
    recommendedSpace: HyperparameterSpace;
    reasoning: string;
  } {
    // Basic recommendations based on model type
    if (modelType === "LSTM") {
      return {
        recommendedSpace: DEFAULT_LSTM_SPACE,
        reasoning:
          "LSTM models benefit from tuning hidden size (16-64), sequence length (10-30), learning rate (0.0001-0.01), and epochs (50-200). Start with medium values and adjust based on results.",
      };
    }

    return {
      recommendedSpace: DEFAULT_HYBRID_SPACE,
      reasoning:
        "Hybrid models benefit from tuning lookback window (20-50 candles) and smoothing factor (0.1-0.3). These control the balance between trend following and noise reduction.",
    };
  }
}
