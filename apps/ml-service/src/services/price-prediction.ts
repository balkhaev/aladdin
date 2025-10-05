import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";
import type {
  PredictionHorizon,
  PredictionPoint,
  PredictionRequest,
  PredictionResult,
} from "../types";
import type { FeatureEngineeringService } from "./feature-engineering";
import type { MarketRegimeService } from "./market-regime";
import { SentimentIntegrationService } from "./sentiment-integration";

const HORIZON_TO_HOURS: Record<PredictionHorizon, number> = {
  "1h": 1,
  "4h": 4,
  "1d": 24,
  "7d": 168,
};

const HORIZON_TO_STEPS: Record<PredictionHorizon, number> = {
  "1h": 1,
  "4h": 4,
  "1d": 24,
  "7d": 168,
};

/**
 * Price Prediction Service
 * Использует гибридный подход для прогнозирования цен
 */
export class PricePredictionService {
  private sentimentService: SentimentIntegrationService;

  constructor(
    _clickhouse: ClickHouseClient,
    private featureService: FeatureEngineeringService,
    private regimeService: MarketRegimeService,
    private logger: Logger
  ) {
    this.sentimentService = new SentimentIntegrationService(logger);
  }

  /**
   * Предсказать цену для символа
   */
  async predictPrice(params: PredictionRequest): Promise<PredictionResult> {
    try {
      const { symbol, horizon, confidence } = params;

      this.logger.info("Starting price prediction", {
        symbol,
        horizon,
        confidence,
      });

      // Извлечь features
      const lookback = HORIZON_TO_HOURS[horizon] * 10; // 10x horizon for training
      const features = await this.featureService.extractFeatures(
        symbol,
        lookback
      );

      if (features.length === 0) {
        throw new Error("Insufficient data for prediction");
      }

      // Получить market regime
      const regimeResult = await this.regimeService.detectRegime({
        symbol,
        lookback: 30,
      });

      // Получить sentiment данные
      const sentimentData =
        await this.sentimentService.fetchSentimentData(symbol);

      // Текущая цена
      const currentPrice = features.at(-1)?.price.close;

      // Генерировать predictions
      const steps = HORIZON_TO_STEPS[horizon];
      let predictions = this.generatePredictions(
        currentPrice,
        features,
        steps,
        confidence,
        regimeResult.currentRegime
      );

      // Применить sentiment adjustments
      if (sentimentData) {
        predictions = this.applySentimentAdjustments(
          predictions,
          sentimentData,
          regimeResult.currentRegime
        );
      }

      // Вычислить sentiment score
      const sentimentScore = sentimentData?.overall || 0;

      return {
        symbol,
        horizon,
        predictions,
        features: {
          technicalIndicators: features.at(-1)
            ? this.extractTechnicalSummary(features.at(-1))
            : {},
          onChainMetrics: {},
          sentimentScore,
          marketRegime: regimeResult.currentRegime,
          volatility: regimeResult.indicators.volatility,
          momentum: regimeResult.indicators.momentum,
        },
        modelInfo: {
          version: "1.0.0-hybrid",
          lastTrained: Date.now(),
          accuracy: 0.75,
          confidence: regimeResult.confidence,
        },
        generatedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error("Failed to predict price", {
        symbol: params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Генерировать predictions с confidence intervals
   */
  private generatePredictions(
    currentPrice: number,
    features: typeof this.featureService extends {
      extractFeatures: (...args: unknown[]) => Promise<infer T>;
    }
      ? Awaited<T>
      : never,
    steps: number,
    confidenceLevel: number,
    marketRegime: string
  ): PredictionPoint[] {
    const predictions: PredictionPoint[] = [];

    // Calculate trend and volatility from features
    const recentFeatures = features.slice(-20);
    const trend = this.calculatePredictionTrend(recentFeatures);
    const volatility = recentFeatures.at(-1)?.price.volatility;

    // Adjust trend based on market regime
    let adjustedTrend = trend;
    if (marketRegime === "BULL") {
      adjustedTrend *= 1.2;
    } else if (marketRegime === "BEAR") {
      adjustedTrend *= 0.8;
    } else {
      adjustedTrend *= 0.9;
    }

    // Generate predictions for each step
    let lastPrice = currentPrice;
    const now = Date.now();
    const HOUR_MS = 3_600_000;

    for (let i = 1; i <= steps; i++) {
      // Exponential smoothing with trend
      const trendComponent = adjustedTrend * i;
      const randomWalk = this.generateRandomWalk(volatility);

      const predictedPrice = lastPrice * (1 + trendComponent + randomWalk);

      // Calculate confidence interval
      const uncertainty = volatility * Math.sqrt(i);
      const zScore = this.getZScore(confidenceLevel);
      const margin = predictedPrice * uncertainty * zScore;

      predictions.push({
        timestamp: now + i * HOUR_MS,
        predictedPrice,
        lowerBound: predictedPrice - margin,
        upperBound: predictedPrice + margin,
        confidence: confidenceLevel,
      });

      lastPrice = predictedPrice;
    }

    return predictions;
  }

  /**
   * Вычислить тренд для prediction
   */
  private calculatePredictionTrend(
    features: typeof this.featureService extends {
      extractFeatures: (...args: unknown[]) => Promise<infer T>;
    }
      ? Awaited<T>
      : never
  ): number {
    const prices = features.map((f) => f.price.close);
    const n = prices.length;

    if (n < 2) return 0;

    // Linear regression
    const xMean = (n - 1) / 2;
    const yMean = prices.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (prices[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = numerator / denominator;

    // Normalize to percentage
    return slope / yMean;
  }

  /**
   * Генерировать random walk component
   */
  private generateRandomWalk(volatility: number): number {
    // Box-Muller transform для нормального распределения
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    return z * volatility * 0.1; // Scale down the random component
  }

  /**
   * Get Z-score для confidence level
   */
  private getZScore(confidenceLevel: number): number {
    // Approximate Z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.9: 1.645,
      0.95: 1.96,
      0.99: 2.576,
    };

    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Извлечь технические индикаторы из features
   */
  private extractTechnicalSummary(
    feature: ReturnType<
      typeof this.featureService.extractFeatures
    > extends Promise<Array<infer T>>
      ? T
      : never
  ): Record<string, number> {
    return {
      rsi: feature.technical.rsi,
      macd: feature.technical.macd,
      ema20: feature.technical.ema20,
      ema50: feature.technical.ema50,
      bbUpper: feature.technical.bbUpper,
      bbLower: feature.technical.bbLower,
    };
  }

  /**
   * Получить sentiment score (mock)
   */
  /**
   * Применить sentiment adjustments к predictions
   */
  private applySentimentAdjustments(
    predictions: PredictionPoint[],
    sentimentData: import("../types").SentimentData,
    currentRegime: import("../types").MarketRegime
  ): PredictionPoint[] {
    // Get sentiment multiplier (0.9 to 1.1x based on sentiment)
    const sentimentMultiplier =
      this.sentimentService.getSentimentMultiplier(sentimentData);

    // Check for divergence between sentiment and regime
    const sentimentBias =
      this.sentimentService.getSentimentRegimeBias(sentimentData);
    const hasDivergence =
      (sentimentBias === "BULLISH" && currentRegime === "BEAR") ||
      (sentimentBias === "BEARISH" && currentRegime === "BULL");

    this.logger.debug("Applying sentiment adjustments", {
      sentimentMultiplier,
      sentimentBias,
      currentRegime,
      hasDivergence,
    });

    return predictions.map((pred) => {
      // Apply sentiment multiplier to price prediction
      const adjustedPrice = pred.predictedPrice * sentimentMultiplier;

      // Adjust confidence based on divergence
      let adjustedConfidence = pred.confidence;
      if (hasDivergence) {
        // Reduce confidence by up to 20% when divergence detected
        adjustedConfidence *= 0.8;
        this.logger.warn("Sentiment-technical divergence detected", {
          sentimentBias,
          currentRegime,
          confidenceReduction: "20%",
        });
      } else if (
        (sentimentBias === "BULLISH" && currentRegime === "BULL") ||
        (sentimentBias === "BEARISH" && currentRegime === "BEAR")
      ) {
        // Boost confidence by up to 10% when aligned
        adjustedConfidence = Math.min(1, adjustedConfidence * 1.1);
      }

      // Adjust confidence intervals based on sentiment multiplier
      const priceAdjustment = adjustedPrice - pred.predictedPrice;
      const adjustedLowerBound = pred.lowerBound + priceAdjustment;
      const adjustedUpperBound = pred.upperBound + priceAdjustment;

      return {
        ...pred,
        predictedPrice: adjustedPrice,
        lowerBound: adjustedLowerBound,
        upperBound: adjustedUpperBound,
        confidence: adjustedConfidence,
      };
    });
  }

  /**
   * Batch predictions для нескольких символов
   */
  async batchPredict(
    symbols: string[],
    horizon: PredictionHorizon,
    confidence = 0.95
  ): Promise<PredictionResult[]> {
    const results: PredictionResult[] = [];

    for (const symbol of symbols) {
      try {
        const result = await this.predictPrice({
          symbol,
          horizon,
          confidence,
        });
        results.push(result);
      } catch (error) {
        this.logger.error("Failed to predict price for symbol", {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }
}
