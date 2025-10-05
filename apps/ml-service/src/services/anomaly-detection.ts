/**
 * Anomaly Detection Service
 * Detect market anomalies: Pump & Dump, Flash Crash, etc.
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import { SentimentIntegrationService } from "./sentiment-integration";

export type AnomalyType =
  | "PUMP_AND_DUMP"
  | "FLASH_CRASH"
  | "UNUSUAL_VOLUME"
  | "PRICE_MANIPULATION"
  | "WHALE_MOVEMENT"
  | "SENTIMENT_DIVERGENCE"
  | "SOCIAL_VOLUME_SPIKE"
  | "SENTIMENT_WHIPLASH";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnomalyDetection = {
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  timestamp: number;
  symbol: string;
  description: string;
  metrics: Record<string, number>;
  recommendations: string[];
};

export type PumpAndDumpIndicators = {
  volumeSpike: number; // % increase
  priceIncrease: number; // % increase
  rapidityScore: number; // 0-100 (how fast)
  sustainabilityScore: number; // 0-100 (how long it lasts)
  socialMediaBuzz: number; // 0-100 (sentiment spike)
  whaleActivity: boolean;
};

export type FlashCrashRisk = {
  liquidationRisk: number; // 0-100
  orderBookImbalance: number; // ratio sell/buy
  marketDepth: number; // USD at 2% price
  volatility: number; // current volatility
  cascadeRisk: number; // 0-100 (liquidation cascade risk)
};

export class AnomalyDetectionService {
  private sentimentService: SentimentIntegrationService;

  constructor(
    private readonly clickhouse: ClickHouseClient,
    private readonly logger: Logger
  ) {
    this.sentimentService = new SentimentIntegrationService(logger);
  }

  /**
   * Detect all anomalies for a symbol
   */
  async detectAnomalies(
    symbol: string,
    lookbackMinutes = 60
  ): Promise<AnomalyDetection[]> {
    this.logger.info(`Detecting anomalies for ${symbol}`);

    const anomalies: AnomalyDetection[] = [];

    // Run all detection algorithms (including sentiment-based)
    const [pumpDump, flashCrash, sentimentDiv, socialSpike, sentimentWhiplash] =
      await Promise.all([
        this.detectPumpAndDump(symbol, lookbackMinutes),
        this.detectFlashCrashRisk(symbol),
        this.detectSentimentDivergence(symbol, lookbackMinutes),
        this.detectSocialVolumeSpike(symbol, lookbackMinutes),
        this.detectSentimentWhiplash(symbol, lookbackMinutes),
      ]);

    if (pumpDump) anomalies.push(pumpDump);
    if (flashCrash) anomalies.push(flashCrash);
    if (sentimentDiv) anomalies.push(sentimentDiv);
    if (socialSpike) anomalies.push(socialSpike);
    if (sentimentWhiplash) anomalies.push(sentimentWhiplash);

    return anomalies;
  }

  /**
   * Detect Pump & Dump schemes
   */
  async detectPumpAndDump(
    symbol: string,
    lookbackMinutes = 60
  ): Promise<AnomalyDetection | null> {
    try {
      const indicators = await this.calculatePumpAndDumpIndicators(
        symbol,
        lookbackMinutes
      );

      // Score the pump & dump likelihood
      const score = this.scorePumpAndDump(indicators);

      if (score < 50) return null; // Not significant enough

      const severity = this.getSeverity(score);

      return {
        type: "PUMP_AND_DUMP",
        severity,
        confidence: score,
        timestamp: Date.now(),
        symbol,
        description: this.generatePumpDumpDescription(indicators, score),
        metrics: {
          volumeSpike: indicators.volumeSpike,
          priceIncrease: indicators.priceIncrease,
          rapidityScore: indicators.rapidityScore,
          sustainabilityScore: indicators.sustainabilityScore,
          score,
        },
        recommendations: this.getPumpDumpRecommendations(indicators, severity),
      };
    } catch (error) {
      this.logger.error("Error detecting pump & dump", error);
      return null;
    }
  }

  /**
   * Calculate Pump & Dump indicators
   */
  private async calculatePumpAndDumpIndicators(
    symbol: string,
    lookbackMinutes: number
  ): Promise<PumpAndDumpIndicators> {
    const endTime = Date.now();
    const startTime = endTime - lookbackMinutes * 60 * 1000;

    // Get recent candles
    const query = `
      SELECT
        timestamp,
        open,
        high,
        low,
        close,
        volume,
        quoteVolume as quote_volume
      FROM candles
      WHERE symbol = {symbol: String}
        AND timeframe = '1m'
        AND timestamp >= {startTime: DateTime64(3)}
        AND timestamp <= {endTime: DateTime64(3)}
      ORDER BY timestamp ASC
    `;

    const candles = await this.clickhouse.query<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      quote_volume: number;
    }>(query, {
      symbol,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });

    if (candles.length < 10) {
      throw new Error("Insufficient data for analysis");
    }

    // Calculate indicators
    const recentCandles = candles.slice(-10);
    const oldCandles = candles.slice(0, -10);

    const recentVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0);
    const oldVolume = oldCandles.reduce((sum, c) => sum + c.volume, 0);
    const avgOldVolume = oldVolume / oldCandles.length;
    const avgRecentVolume = recentVolume / recentCandles.length;

    const volumeSpike = ((avgRecentVolume - avgOldVolume) / avgOldVolume) * 100;

    const firstPrice = candles[0].open;
    const lastPrice = candles.at(-1).close;
    const priceIncrease = ((lastPrice - firstPrice) / firstPrice) * 100;

    // Rapidity: how quickly did the price rise?
    const priceChanges = candles.slice(1).map((c, i) => {
      const prev = candles[i];
      return ((c.close - prev.close) / prev.close) * 100;
    });
    const maxPriceChange = Math.max(...priceChanges.map(Math.abs));
    const rapidityScore = Math.min(maxPriceChange * 10, 100);

    // Sustainability: is the price holding?
    const recentPrices = recentCandles.map((c) => c.close);
    const priceStd = this.standardDeviation(recentPrices);
    const avgRecentPrice =
      recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const sustainabilityScore = Math.max(
      0,
      100 - (priceStd / avgRecentPrice) * 100
    );

    return {
      volumeSpike,
      priceIncrease,
      rapidityScore,
      sustainabilityScore,
      socialMediaBuzz: 0, // TODO: integrate social media sentiment
      whaleActivity: false, // TODO: integrate whale detection
    };
  }

  /**
   * Score Pump & Dump likelihood
   */
  private scorePumpAndDump(indicators: PumpAndDumpIndicators): number {
    let score = 0;

    // Volume spike (0-30 points)
    if (indicators.volumeSpike > 500) score += 30;
    else if (indicators.volumeSpike > 300) score += 25;
    else if (indicators.volumeSpike > 200) score += 20;
    else if (indicators.volumeSpike > 100) score += 15;

    // Price increase (0-30 points)
    if (indicators.priceIncrease > 50) score += 30;
    else if (indicators.priceIncrease > 30) score += 25;
    else if (indicators.priceIncrease > 20) score += 20;
    else if (indicators.priceIncrease > 10) score += 15;

    // Rapidity (0-20 points)
    score += (indicators.rapidityScore / 100) * 20;

    // Low sustainability (indicates dump incoming) (0-20 points)
    score += ((100 - indicators.sustainabilityScore) / 100) * 20;

    return Math.min(score, 100);
  }

  /**
   * Detect Flash Crash risk
   */
  async detectFlashCrashRisk(symbol: string): Promise<AnomalyDetection | null> {
    try {
      const risk = await this.calculateFlashCrashRisk(symbol);

      const score = this.scoreFlashCrashRisk(risk);

      if (score < 50) return null;

      const severity = this.getSeverity(score);

      return {
        type: "FLASH_CRASH",
        severity,
        confidence: score,
        timestamp: Date.now(),
        symbol,
        description: this.generateFlashCrashDescription(risk, score),
        metrics: {
          liquidationRisk: risk.liquidationRisk,
          orderBookImbalance: risk.orderBookImbalance,
          volatility: risk.volatility,
          cascadeRisk: risk.cascadeRisk,
          score,
        },
        recommendations: this.getFlashCrashRecommendations(risk, severity),
      };
    } catch (error) {
      this.logger.error("Error detecting flash crash risk", error);
      return null;
    }
  }

  /**
   * Calculate Flash Crash risk
   */
  private async calculateFlashCrashRisk(
    symbol: string
  ): Promise<FlashCrashRisk> {
    // Get recent volatility
    const endTime = Date.now();
    const startTime = endTime - 60 * 60 * 1000; // 1 hour

    const query = `
      SELECT
        close,
        high,
        low
      FROM candles
      WHERE symbol = {symbol: String}
        AND timeframe = '1m'
        AND timestamp >= {startTime: DateTime64(3)}
        AND timestamp <= {endTime: DateTime64(3)}
      ORDER BY timestamp DESC
      LIMIT 60
    `;

    const candles = await this.clickhouse.query<{
      close: number;
      high: number;
      low: number;
    }>(query, {
      symbol,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });

    if (candles.length < 10) {
      throw new Error("Insufficient data for analysis");
    }

    // Calculate volatility
    const returns = candles
      .slice(1)
      .map((c, i) => Math.log(c.close / candles[i].close));
    const volatility = this.standardDeviation(returns) * Math.sqrt(60 * 24); // Annualized

    // Order book imbalance (mock - TODO: integrate real order book)
    const orderBookImbalance = 1.0; // Neutral

    // Market depth (mock - TODO: integrate real order book)
    const marketDepth = 1_000_000; // $1M

    // Liquidation risk (simplified)
    // High volatility + low liquidity = high liquidation risk
    const liquidationRisk = Math.min(
      (volatility * 100) / (marketDepth / 100_000),
      100
    );

    // Cascade risk
    const cascadeRisk =
      liquidationRisk * 0.6 + (orderBookImbalance > 1.5 ? 40 : 0);

    return {
      liquidationRisk,
      orderBookImbalance,
      marketDepth,
      volatility,
      cascadeRisk: Math.min(cascadeRisk, 100),
    };
  }

  /**
   * Score Flash Crash risk
   */
  private scoreFlashCrashRisk(risk: FlashCrashRisk): number {
    let score = 0;

    // Liquidation risk (0-40 points)
    score += (risk.liquidationRisk / 100) * 40;

    // Order book imbalance (0-30 points)
    if (risk.orderBookImbalance > 2.0) score += 30;
    else if (risk.orderBookImbalance > 1.5) score += 20;
    else if (risk.orderBookImbalance > 1.2) score += 10;

    // Low market depth (0-30 points)
    if (risk.marketDepth < 100_000) score += 30;
    else if (risk.marketDepth < 500_000) score += 20;
    else if (risk.marketDepth < 1_000_000) score += 10;

    return Math.min(score, 100);
  }

  /**
   * Get severity level
   */
  private getSeverity(score: number): AnomalySeverity {
    if (score >= 80) return "CRITICAL";
    if (score >= 70) return "HIGH";
    if (score >= 60) return "MEDIUM";
    return "LOW";
  }

  /**
   * Generate Pump & Dump description
   */
  private generatePumpDumpDescription(
    indicators: PumpAndDumpIndicators,
    score: number
  ): string {
    return `Potential pump & dump detected (${score.toFixed(0)}% confidence). Volume spike: ${indicators.volumeSpike.toFixed(0)}%, Price increase: ${indicators.priceIncrease.toFixed(1)}%. Rapid price movement with ${indicators.sustainabilityScore < 50 ? "low" : "medium"} sustainability.`;
  }

  /**
   * Generate Flash Crash description
   */
  private generateFlashCrashDescription(
    risk: FlashCrashRisk,
    score: number
  ): string {
    return `Flash crash risk detected (${score.toFixed(0)}% confidence). Liquidation risk: ${risk.liquidationRisk.toFixed(0)}%, Order book imbalance: ${risk.orderBookImbalance.toFixed(2)}x, Cascade risk: ${risk.cascadeRisk.toFixed(0)}%.`;
  }

  /**
   * Get Pump & Dump recommendations
   */
  private getPumpDumpRecommendations(
    indicators: PumpAndDumpIndicators,
    severity: AnomalySeverity
  ): string[] {
    const recommendations: string[] = [];

    if (severity === "CRITICAL" || severity === "HIGH") {
      recommendations.push("🚨 Avoid buying - high pump & dump risk");
      recommendations.push("Consider taking profits if already in position");
      recommendations.push("Set tight stop losses");
    }

    if (indicators.volumeSpike > 300) {
      recommendations.push("Unusual volume spike - exercise caution");
    }

    if (indicators.sustainabilityScore < 40) {
      recommendations.push("Price unlikely to sustain - expect reversal");
    }

    if (indicators.rapidityScore > 80) {
      recommendations.push(
        "Extremely rapid price movement - likely manipulation"
      );
    }

    recommendations.push("Monitor for sudden price reversal");
    recommendations.push("Check social media for coordinated activity");

    return recommendations;
  }

  /**
   * Get Flash Crash recommendations
   */
  private getFlashCrashRecommendations(
    risk: FlashCrashRisk,
    severity: AnomalySeverity
  ): string[] {
    const recommendations: string[] = [];

    if (severity === "CRITICAL" || severity === "HIGH") {
      recommendations.push("🚨 High flash crash risk - reduce position size");
      recommendations.push("Use stop-limit orders instead of stop-market");
      recommendations.push("Avoid high leverage");
    }

    if (risk.liquidationRisk > 70) {
      recommendations.push(
        "High liquidation risk - liquidation cascade possible"
      );
    }

    if (risk.orderBookImbalance > 1.5) {
      recommendations.push("Order book heavily skewed - poor liquidity");
    }

    if (risk.marketDepth < 500_000) {
      recommendations.push(
        "Low market depth - large orders can cause slippage"
      );
    }

    recommendations.push("Monitor funding rates for leverage positions");
    recommendations.push("Consider hedging with options or futures");

    return recommendations;
  }

  /**
   * Detect Sentiment Divergence
   * When price action contradicts strong sentiment
   */
  async detectSentimentDivergence(
    symbol: string,
    lookbackMinutes = 60
  ): Promise<AnomalyDetection | null> {
    try {
      // Get sentiment data
      const sentimentData =
        await this.sentimentService.fetchSentimentData(symbol);
      if (!sentimentData || sentimentData.confidence < 0.5) {
        return null; // Not enough confidence
      }

      // Get recent price change
      const query = `
        SELECT
          (last - first) / first * 100 as priceChangePercent
        FROM (
          SELECT
            first_value(close) OVER (ORDER BY timestamp ASC) as first,
            last_value(close) OVER (ORDER BY timestamp DESC) as last
          FROM candles
          WHERE symbol = {symbol:String}
            AND timeframe = '1m'
            AND timestamp >= now() - INTERVAL {minutes:UInt32} MINUTE
          LIMIT 1
        )
      `;

      const result = await this.clickhouse.query<{
        priceChangePercent: number;
      }>(query, { symbol, minutes: lookbackMinutes });

      if (!result || result.length === 0) {
        return null;
      }

      const priceChange = result[0].priceChangePercent;
      const sentimentScore = sentimentData.overall;

      // Divergence: Strong bearish sentiment (-0.5 to -1) but price up (+5%+)
      // OR: Strong bullish sentiment (+0.5 to +1) but price down (-5%-+)
      const strongBearishSentiment = sentimentScore < -0.5;
      const strongBullishSentiment = sentimentScore > 0.5;
      const priceUp = priceChange > 5;
      const priceDown = priceChange < -5;

      const hasDivergence =
        (strongBearishSentiment && priceUp) ||
        (strongBullishSentiment && priceDown);

      if (!hasDivergence) {
        return null;
      }

      // Calculate severity
      const divergenceMagnitude = Math.abs(sentimentScore * priceChange);
      let severity: AnomalySeverity;
      if (divergenceMagnitude > 15) {
        severity = "CRITICAL";
      } else if (divergenceMagnitude > 10) {
        severity = "HIGH";
      } else if (divergenceMagnitude > 5) {
        severity = "MEDIUM";
      } else {
        severity = "LOW";
      }

      return {
        type: "SENTIMENT_DIVERGENCE",
        severity,
        confidence: sentimentData.confidence,
        timestamp: Date.now(),
        symbol,
        description: `Strong sentiment-price divergence detected. ${strongBearishSentiment ? "Bearish" : "Bullish"} sentiment (${sentimentScore.toFixed(2)}) but price ${priceUp ? "up" : "down"} ${Math.abs(priceChange).toFixed(1)}%`,
        metrics: {
          sentimentScore,
          priceChangePercent: priceChange,
          divergenceMagnitude,
          sentimentConfidence: sentimentData.confidence,
        },
        recommendations: [
          strongBearishSentiment && priceUp
            ? "Possible pump & dump or FOMO buying - exercise caution"
            : "Possible panic selling or capitulation - check fundamentals",
          "Monitor for trend reversal",
          "Consider reducing position size until alignment",
        ],
      };
    } catch (error) {
      this.logger.error("Failed to detect sentiment divergence", {
        symbol,
        error,
      });
      return null;
    }
  }

  /**
   * Detect Social Volume Spike
   * Sudden increase in social media activity without price movement
   */
  async detectSocialVolumeSpike(
    symbol: string,
    lookbackMinutes = 60
  ): Promise<AnomalyDetection | null> {
    try {
      const sentimentData =
        await this.sentimentService.fetchSentimentData(symbol);
      if (!sentimentData) {
        return null;
      }

      const features = sentimentData
        ? this.sentimentService.calculateSentimentFeatures(sentimentData)
        : null;

      if (!features) {
        return null;
      }

      const socialVolume = features.socialVolume;

      // Threshold: more than 100 social items in recent period
      if (socialVolume < 100) {
        return null;
      }

      // Get price volatility
      const query = `
        SELECT
          stddevSamp(close) / avg(close) * 100 as volatilityPercent
        FROM candles
        WHERE symbol = {symbol:String}
          AND timeframe = '1m'
          AND timestamp >= now() - INTERVAL {minutes:UInt32} MINUTE
      `;

      const result = await this.clickhouse.query<{ volatilityPercent: number }>(
        query,
        { symbol, minutes: lookbackMinutes }
      );

      if (!result || result.length === 0) {
        return null;
      }

      const volatility = result[0].volatilityPercent;

      // Spike: High social volume but low price volatility
      if (volatility > 2) {
        return null; // Price is moving, not a spike
      }

      let severity: AnomalySeverity;
      if (socialVolume > 300) {
        severity = "HIGH";
      } else if (socialVolume > 200) {
        severity = "MEDIUM";
      } else {
        severity = "LOW";
      }

      return {
        type: "SOCIAL_VOLUME_SPIKE",
        severity,
        confidence: 0.7,
        timestamp: Date.now(),
        symbol,
        description: `Unusual social media activity spike detected (${socialVolume} mentions) with low price movement (${volatility.toFixed(2)}% volatility)`,
        metrics: {
          socialVolume,
          volatilityPercent: volatility,
          tweets: sentimentData.twitter.tweets,
          redditPosts: sentimentData.reddit.posts,
        },
        recommendations: [
          "Monitor for upcoming news or announcement",
          "Possible pre-pump social campaign",
          "Check for coordinated group activity",
          "Watch for sudden price movement in next hours",
        ],
      };
    } catch (error) {
      this.logger.error("Failed to detect social volume spike", {
        symbol,
        error,
      });
      return null;
    }
  }

  /**
   * Detect Sentiment Whiplash
   * Rapid change in sentiment direction
   */
  async detectSentimentWhiplash(
    symbol: string,
    _lookbackMinutes = 60
  ): Promise<AnomalyDetection | null> {
    try {
      // For now, we only have current sentiment
      // In production, we'd query historical sentiment from ClickHouse
      const sentimentData =
        await this.sentimentService.fetchSentimentData(symbol);
      if (!sentimentData) {
        return null;
      }

      // TODO: Implement historical sentiment comparison when we store sentiment history
      // For now, check for extreme sentiment swings in social sources

      const twitterScore = sentimentData.twitter.score;
      const redditScore = sentimentData.reddit.score;
      const telegramScore = sentimentData.telegram.score;

      // Check if sources disagree significantly
      const scores = [twitterScore, redditScore, telegramScore].filter(
        (s) => s !== 0
      );
      if (scores.length < 2) {
        return null;
      }

      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      const disagreement = maxScore - minScore;

      // Whiplash: Sources disagree by more than 1.0 on -1 to 1 scale
      if (disagreement < 1.0) {
        return null;
      }

      let severity: AnomalySeverity;
      if (disagreement > 1.5) {
        severity = "HIGH";
      } else if (disagreement > 1.2) {
        severity = "MEDIUM";
      } else {
        severity = "LOW";
      }

      return {
        type: "SENTIMENT_WHIPLASH",
        severity,
        confidence: sentimentData.confidence,
        timestamp: Date.now(),
        symbol,
        description: `Conflicting sentiment across social sources. Twitter: ${twitterScore.toFixed(2)}, Reddit: ${redditScore.toFixed(2)}, Telegram: ${telegramScore.toFixed(2)}`,
        metrics: {
          twitterScore,
          redditScore,
          telegramScore,
          disagreement,
          overall: sentimentData.overall,
        },
        recommendations: [
          "Mixed social signals - wait for clarity",
          "Different communities have different views",
          "Check for conflicting news or narratives",
          "Consider neutral position until alignment",
        ],
      };
    } catch (error) {
      this.logger.error("Failed to detect sentiment whiplash", {
        symbol,
        error,
      });
      return null;
    }
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => (v - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }
}
