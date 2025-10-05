/**
 * Ensemble Service
 * Combine multiple models for better predictions
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { PredictionHorizon } from "../types";
import type { FeatureEngineeringService } from "./feature-engineering";
import type { LSTMPredictionService } from "./lstm-prediction";
import type { MarketRegimeService } from "./market-regime";
import type { PricePredictionService } from "./price-prediction";

export type EnsembleStrategy = "WEIGHTED_AVERAGE" | "VOTING" | "STACKING";

export type EnsemblePrediction = {
  timestamp: number;
  predictedPrice: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  modelPredictions: {
    lstm: {
      price: number;
      confidence: number;
      weight: number;
    };
    hybrid: {
      price: number;
      confidence: number;
      weight: number;
    };
  };
  strategy: EnsembleStrategy;
  metadata: {
    regimeAgreement: boolean;
    priceSpread: number;
    ensembleBoost: number;
  };
};

export type EnsembleWeights = {
  lstm: number;
  hybrid: number;
};

export class EnsembleService {
  constructor(
    readonly _clickhouse: ClickHouseClient,
    private readonly lstmService: LSTMPredictionService,
    private readonly hybridService: PricePredictionService,
    readonly _featureService: FeatureEngineeringService,
    private readonly regimeService: MarketRegimeService,
    private readonly logger: Logger
  ) {}

  /**
   * Get ensemble prediction
   */
  async predict(
    symbol: string,
    horizon: PredictionHorizon,
    strategy: EnsembleStrategy = "WEIGHTED_AVERAGE"
  ): Promise<EnsemblePrediction[]> {
    this.logger.info(
      `Getting ensemble predictions for ${symbol} (${horizon}) using ${strategy}`
    );

    // Get predictions from both models
    const [lstmResult, hybridResult, regime] = await Promise.all([
      this.lstmService.predict(symbol, horizon),
      this.hybridService.predict({ symbol, horizon }),
      this.regimeService.detectRegime({ symbol }),
    ]);

    // Calculate weights based on historical performance
    const weights = await this.calculateWeights(symbol, horizon, strategy);

    // Combine predictions based on strategy
    const predictions: EnsemblePrediction[] = [];

    for (let i = 0; i < lstmResult.predictions.length; i++) {
      const lstmPred = lstmResult.predictions[i];
      const hybridPred = hybridResult.predictions[i];

      if (!(lstmPred && hybridPred)) continue;

      let ensemblePrediction: EnsemblePrediction;

      switch (strategy) {
        case "VOTING":
          ensemblePrediction = this.votingStrategy(
            lstmPred,
            hybridPred,
            weights,
            regime.currentRegime.regime
          );
          break;
        case "STACKING":
          ensemblePrediction = await this.stackingStrategy(
            symbol,
            lstmPred,
            hybridPred,
            weights,
            regime.currentRegime.regime
          );
          break;
        default:
          ensemblePrediction = this.weightedAverageStrategy(
            lstmPred,
            hybridPred,
            weights,
            regime.currentRegime.regime
          );
      }

      predictions.push(ensemblePrediction);
    }

    return predictions;
  }

  /**
   * Weighted Average Strategy
   * Combine predictions using weighted average
   */
  private weightedAverageStrategy(
    lstmPred: { timestamp: number; price: number; confidence: number },
    hybridPred: {
      timestamp: number;
      predictedPrice: number;
      confidence: number;
    },
    weights: EnsembleWeights,
    _regime: string
  ): EnsemblePrediction {
    const lstmPrice = lstmPred.price;
    const hybridPrice = hybridPred.predictedPrice;

    // Weighted average
    const predictedPrice =
      lstmPrice * weights.lstm + hybridPrice * weights.hybrid;

    // Combined confidence (weighted)
    const confidence =
      lstmPred.confidence * weights.lstm +
      hybridPred.confidence * weights.hybrid;

    // Price spread (disagreement measure)
    const priceSpread = Math.abs(lstmPrice - hybridPrice);
    const priceSpreadPercent = (priceSpread / lstmPrice) * 100;

    // Confidence bounds
    const stdDev = priceSpread / 2; // Simplified
    const lowerBound = predictedPrice - 1.96 * stdDev;
    const upperBound = predictedPrice + 1.96 * stdDev;

    // Ensemble boost (confidence increase from ensemble)
    const avgSingleConfidence =
      (lstmPred.confidence + hybridPred.confidence) / 2;
    const ensembleBoost = confidence - avgSingleConfidence;

    return {
      timestamp: lstmPred.timestamp,
      predictedPrice,
      confidence: Math.min(confidence * (1 + ensembleBoost), 100),
      lowerBound,
      upperBound,
      modelPredictions: {
        lstm: {
          price: lstmPrice,
          confidence: lstmPred.confidence,
          weight: weights.lstm,
        },
        hybrid: {
          price: hybridPrice,
          confidence: hybridPred.confidence,
          weight: weights.hybrid,
        },
      },
      strategy: "WEIGHTED_AVERAGE",
      metadata: {
        regimeAgreement: this.checkRegimeAgreement(lstmPrice, hybridPrice),
        priceSpread: priceSpreadPercent,
        ensembleBoost,
      },
    };
  }

  /**
   * Voting Strategy
   * Use majority vote for direction
   */
  private votingStrategy(
    lstmPred: { timestamp: number; price: number; confidence: number },
    hybridPred: {
      timestamp: number;
      predictedPrice: number;
      confidence: number;
    },
    weights: EnsembleWeights,
    _regime: string
  ): EnsemblePrediction {
    const currentPrice = (lstmPred.price + hybridPred.predictedPrice) / 2;

    // Determine direction from each model
    const lstmDirection = lstmPred.price > currentPrice ? 1 : -1;
    const hybridDirection = hybridPred.predictedPrice > currentPrice ? 1 : -1;

    // Weighted vote
    const _vote =
      lstmDirection * weights.lstm + hybridDirection * weights.hybrid;

    // If models agree, boost confidence
    const agreement = lstmDirection === hybridDirection;
    const confidenceBoost = agreement ? 10 : 0;

    // Use prediction from more confident model
    const predictedPrice =
      lstmPred.confidence > hybridPred.confidence
        ? lstmPred.price
        : hybridPred.predictedPrice;

    const confidence =
      Math.max(lstmPred.confidence, hybridPred.confidence) + confidenceBoost;

    const priceSpread = Math.abs(lstmPred.price - hybridPred.predictedPrice);
    const stdDev = priceSpread / 2;

    return {
      timestamp: lstmPred.timestamp,
      predictedPrice,
      confidence: Math.min(confidence, 100),
      lowerBound: predictedPrice - 1.96 * stdDev,
      upperBound: predictedPrice + 1.96 * stdDev,
      modelPredictions: {
        lstm: {
          price: lstmPred.price,
          confidence: lstmPred.confidence,
          weight: weights.lstm,
        },
        hybrid: {
          price: hybridPred.predictedPrice,
          confidence: hybridPred.confidence,
          weight: weights.hybrid,
        },
      },
      strategy: "VOTING",
      metadata: {
        regimeAgreement: agreement,
        priceSpread: (priceSpread / currentPrice) * 100,
        ensembleBoost: confidenceBoost,
      },
    };
  }

  /**
   * Stacking Strategy
   * Use meta-model to combine predictions
   */
  private stackingStrategy(
    _symbol: string,
    lstmPred: { timestamp: number; price: number; confidence: number },
    hybridPred: {
      timestamp: number;
      predictedPrice: number;
      confidence: number;
    },
    weights: EnsembleWeights,
    regime: string
  ): EnsemblePrediction {
    // Simple stacking: adjust weights based on regime
    const adjustedWeights = { ...weights };

    // LSTM performs better in trending markets
    if (regime === "BULL" || regime === "BEAR") {
      adjustedWeights.lstm *= 1.2;
      adjustedWeights.hybrid *= 0.8;
    }
    // Hybrid performs better in sideways markets
    else if (regime === "SIDEWAYS") {
      adjustedWeights.lstm *= 0.8;
      adjustedWeights.hybrid *= 1.2;
    }

    // Normalize weights
    const total = adjustedWeights.lstm + adjustedWeights.hybrid;
    adjustedWeights.lstm /= total;
    adjustedWeights.hybrid /= total;

    // Use weighted average with adjusted weights
    return this.weightedAverageStrategy(
      lstmPred,
      hybridPred,
      adjustedWeights,
      regime
    );
  }

  /**
   * Calculate optimal weights for models
   */
  private calculateWeights(
    _symbol: string,
    horizon: PredictionHorizon,
    strategy: EnsembleStrategy
  ): EnsembleWeights {
    // For now, use fixed weights based on general performance
    // TODO: Calculate from historical backtest results

    switch (strategy) {
      case "WEIGHTED_AVERAGE":
        // Balanced weights
        return { lstm: 0.5, hybrid: 0.5 };

      case "VOTING":
        // Equal voting power
        return { lstm: 0.5, hybrid: 0.5 };

      case "STACKING":
        // Slightly favor LSTM (better on longer horizons)
        if (horizon === "1d" || horizon === "7d") {
          return { lstm: 0.6, hybrid: 0.4 };
        }
        // Favor Hybrid for short-term
        return { lstm: 0.4, hybrid: 0.6 };

      default:
        return { lstm: 0.5, hybrid: 0.5 };
    }
  }

  /**
   * Check if models agree on regime/direction
   */
  private checkRegimeAgreement(
    lstmPrice: number,
    hybridPrice: number
  ): boolean {
    // If predictions are within 2% of each other, consider them in agreement
    const diff = Math.abs(lstmPrice - hybridPrice);
    const avgPrice = (lstmPrice + hybridPrice) / 2;
    const diffPercent = (diff / avgPrice) * 100;

    return diffPercent < 2;
  }

  /**
   * Get ensemble performance metrics
   */
  getPerformanceMetrics(
    _symbol: string,
    _horizon: PredictionHorizon
  ): {
    weightedAverage: { accuracy: number; mae: number };
    voting: { accuracy: number; mae: number };
    stacking: { accuracy: number; mae: number };
    bestStrategy: EnsembleStrategy;
  } {
    // TODO: Implement based on historical backtest results
    // For now, return mock data

    return {
      weightedAverage: { accuracy: 62.5, mae: 125.3 },
      voting: { accuracy: 64.2, mae: 118.7 },
      stacking: { accuracy: 65.8, mae: 115.2 },
      bestStrategy: "STACKING",
    };
  }
}
