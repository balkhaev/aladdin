/**
 * Combined Sentiment Analysis Service
 * Aggregates sentiment from:
 * 1. Analytics (Fear&Greed + OnChain + Technical)
 * 2. Futures (Funding Rates + Open Interest)
 * 3. Order Book (Bid/Ask imbalance, liquidity)
 * 4. Social (Telegram + Twitter sentiment)
 */

import type { Logger } from "@aladdin/shared/logger";
import type { SentimentAnalysisService } from "./sentiment-analysis";

type SentimentSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

type ComponentSentiment = {
  score: number; // -100 to +100
  signal: SentimentSignal;
  confidence: number; // 0 to 1
  weight: number; // Weight in final calculation
};

type CombinedSentiment = {
  symbol: string;
  timestamp: Date;

  // Overall metrics
  combinedScore: number; // -100 to +100
  combinedSignal: SentimentSignal;
  confidence: number; // 0 to 1
  strength: "WEAK" | "MODERATE" | "STRONG";

  // Component breakdowns
  components: {
    analytics: ComponentSentiment;
    futures: ComponentSentiment;
    orderBook: ComponentSentiment;
    social: ComponentSentiment;
  };

  // Trading recommendations
  recommendation: {
    action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
    reasoning: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  };

  // Key insights
  insights: string[];
};

type FuturesSentimentData = {
  fundingRate: number;
  fundingAvg24h: number;
  oiChangePct: number;
  priceChangePct: number;
  signal: SentimentSignal;
};

type OrderBookData = {
  bidAskImbalance: number; // -1 to +1
  spread: number;
  liquidityScore: number; // 0 to 100
};

type SocialSentimentData = {
  overall: number; // -1 to 1
  telegram: {
    score: number;
    bullish: number;
    bearish: number;
    signals: number;
  };
  twitter: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    tweets: number;
  };
  confidence: number; // 0 to 1
};

export class CombinedSentimentService {
  // Component weights (must sum to 1.0)
  private static readonly WEIGHTS = {
    ANALYTICS: 0.35, // 35% - multi-factor analysis
    FUTURES: 0.25, // 25% - funding + OI
    ORDER_BOOK: 0.15, // 15% - current market structure
    SOCIAL: 0.25, // 25% - social sentiment (Telegram + Twitter)
  };

  // Thresholds for signal strength
  private static readonly STRENGTH_THRESHOLDS = {
    STRONG: 50,
    MODERATE: 25,
  };

  // Thresholds for recommendations
  private static readonly RECOMMENDATION_THRESHOLDS = {
    STRONG_BUY: 60,
    BUY: 30,
    SELL: -30,
    STRONG_SELL: -60,
  };

  private marketDataBaseUrl: string;
  private scraperBaseUrl: string;
  private sentimentService: SentimentAnalysisService | null = null;

  constructor(
    private logger: Logger,
    _analyticsBaseUrl: string,
    marketDataBaseUrl: string,
    scraperBaseUrl: string
  ) {
    this.marketDataBaseUrl = marketDataBaseUrl;
    this.scraperBaseUrl = scraperBaseUrl;
    // _analyticsBaseUrl не используется, т.к. Combined Sentiment работает в самом analytics сервисе
  }

  /**
   * Set the sentiment analysis service (to avoid circular dependency in constructor)
   */
  setSentimentService(service: SentimentAnalysisService): void {
    this.sentimentService = service;
  }

  /**
   * Get combined sentiment for a symbol
   */
  async getCombinedSentiment(symbol: string): Promise<CombinedSentiment> {
    this.logger.info("Calculating combined sentiment", { symbol });

    // Fetch all data in parallel
    const [analyticsResult, futuresResult, orderBookResult, socialResult] =
      await Promise.allSettled([
        this.fetchAnalyticsSentiment(symbol),
        this.fetchFuturesSentiment(symbol),
        this.fetchOrderBookData(symbol),
        this.fetchSocialSentiment(symbol),
      ]);

    // Calculate component sentiments
    const analyticsSentiment = this.calculateAnalyticsSentiment(
      analyticsResult.status === "fulfilled" ? analyticsResult.value : null
    );

    const futuresSentiment = this.calculateFuturesSentiment(
      futuresResult.status === "fulfilled" ? futuresResult.value : null
    );

    const orderBookSentiment = this.calculateOrderBookSentiment(
      orderBookResult.status === "fulfilled" ? orderBookResult.value : null
    );

    const socialSentiment = this.calculateSocialSentiment(
      socialResult.status === "fulfilled" ? socialResult.value : null
    );

    // Calculate combined score
    const combinedScore = this.calculateCombinedScore({
      analytics: analyticsSentiment,
      futures: futuresSentiment,
      orderBook: orderBookSentiment,
      social: socialSentiment,
    });

    // Determine signal and strength
    const combinedSignal = this.getSignalFromScore(combinedScore);
    const strength = this.getStrengthFromScore(combinedScore);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence({
      analytics: analyticsSentiment,
      futures: futuresSentiment,
      orderBook: orderBookSentiment,
      social: socialSentiment,
    });

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      combinedScore,
      confidence,
      {
        analytics: analyticsSentiment,
        futures: futuresSentiment,
        orderBook: orderBookSentiment,
        social: socialSentiment,
      }
    );

    // Generate insights
    const insights = this.generateInsights({
      analytics: analyticsSentiment,
      futures: futuresSentiment,
      orderBook: orderBookSentiment,
      social: socialSentiment,
      combinedScore,
      combinedSignal,
    });

    return {
      symbol,
      timestamp: new Date(),
      combinedScore,
      combinedSignal,
      confidence,
      strength,
      components: {
        analytics: analyticsSentiment,
        futures: futuresSentiment,
        orderBook: orderBookSentiment,
        social: socialSentiment,
      },
      recommendation,
      insights,
    };
  }

  /**
   * Fetch analytics sentiment from SentimentAnalysisService
   */
  private async fetchAnalyticsSentiment(symbol: string) {
    if (!this.sentimentService) {
      this.logger.debug("Analytics sentiment service not set", { symbol });
      return null;
    }

    try {
      const result = await this.sentimentService.getCompositeSentiment(symbol);
      return {
        compositeScore: result.compositeScore,
        confidence: result.confidence,
      };
    } catch (error) {
      this.logger.error("Failed to fetch analytics sentiment", {
        symbol,
        error,
      });
      return null;
    }
  }

  /**
   * Fetch futures sentiment (funding rate + open interest)
   */
  private async fetchFuturesSentiment(
    symbol: string
  ): Promise<FuturesSentimentData | null> {
    try {
      // Fetch funding rates and open interest in parallel
      const [fundingRes, oiRes] = await Promise.all([
        fetch(
          `${this.marketDataBaseUrl}/api/market-data/${symbol}/funding-rate/all`
        ),
        fetch(
          `${this.marketDataBaseUrl}/api/market-data/${symbol}/open-interest/all`
        ),
      ]);

      if (!(fundingRes.ok && oiRes.ok)) {
        throw new Error("Futures data API error");
      }

      const fundingData = await fundingRes.json();
      const oiData = await oiRes.json();

      if (!(fundingData.success && oiData.success)) {
        return null;
      }

      // Funding rates API returns object format: {binance: {...}, bybit: {...}, okx: {...}}
      // Open Interest API returns object format: {binance: {...}, bybit: {...}, okx: {...}}
      const binanceFunding = fundingData.data.binance;
      const binanceOI = oiData.data.binance;

      if (!(binanceFunding && binanceOI)) {
        return null;
      }

      // Determine overall futures sentiment
      const EXTREME_FUNDING_THRESHOLD = 0.0005; // 0.05%
      const HIGH_OI_CHANGE_THRESHOLD = 10; // 10%

      const fundingRate = binanceFunding.fundingRate;
      const fundingAvg24h = binanceFunding.avgFunding24h;
      const oiChangePct = binanceOI.openInterestChangePct;
      const priceChangePct = binanceOI.priceChange24h;

      let signal: SentimentSignal = "NEUTRAL";

      // High positive funding + OI increase + price increase = Strong BULLISH
      if (
        fundingRate > EXTREME_FUNDING_THRESHOLD &&
        oiChangePct > HIGH_OI_CHANGE_THRESHOLD &&
        priceChangePct > 0
      ) {
        signal = "BULLISH";
      }
      // High negative funding + OI increase + price decrease = Strong BEARISH
      else if (
        fundingRate < -EXTREME_FUNDING_THRESHOLD &&
        oiChangePct > HIGH_OI_CHANGE_THRESHOLD &&
        priceChangePct < 0
      ) {
        signal = "BEARISH";
      }

      return {
        fundingRate,
        fundingAvg24h,
        oiChangePct,
        priceChangePct,
        signal,
      };
    } catch (error) {
      this.logger.error("Failed to fetch futures sentiment", {
        symbol,
        error,
      });
      return null;
    }
  }

  /**
   * Fetch order book data
   */
  private async fetchOrderBookData(
    symbol: string
  ): Promise<OrderBookData | null> {
    try {
      const response = await fetch(
        `${this.marketDataBaseUrl}/api/market-data/${symbol}/orderbook`
      );

      if (!response.ok) {
        throw new Error(`Order book API error: ${response.statusText}`);
      }

      const result = await response.json();

      if (!(result.success && result.data)) {
        return null;
      }

      const { snapshot, analysis } = result.data;

      return {
        bidAskImbalance: snapshot.bidAskImbalance ?? 0,
        spread: snapshot.spread ?? 0,
        liquidityScore: analysis.details?.liquidityScore ?? 0,
      };
    } catch (error) {
      this.logger.error("Failed to fetch order book data", { symbol, error });
      return null;
    }
  }

  /**
   * Fetch social sentiment (Telegram + Twitter)
   */
  private async fetchSocialSentiment(
    symbol: string
  ): Promise<SocialSentimentData | null> {
    try {
      // Social sentiment is available through scraper service
      const response = await fetch(
        `${this.scraperBaseUrl}/api/social/sentiment/${symbol}`
      );

      if (!response.ok) {
        this.logger.warn("Social sentiment API not available", {
          symbol,
          status: response.status,
        });
        return null;
      }

      const result = await response.json();

      if (!(result.success && result.data)) {
        return null;
      }

      return result.data;
    } catch (error) {
      this.logger.error("Failed to fetch social sentiment", { symbol, error });
      return null;
    }
  }

  /**
   * Calculate analytics component sentiment
   */
  private calculateAnalyticsSentiment(
    data: { compositeScore?: number; confidence?: number } | null
  ): ComponentSentiment {
    if (!data || data.compositeScore === undefined) {
      return {
        score: 0,
        signal: "NEUTRAL",
        confidence: 0,
        weight: CombinedSentimentService.WEIGHTS.ANALYTICS,
      };
    }

    // Analytics API returns confidence in 0-100 range, convert to 0-1
    const PERCENTAGE_DIVISOR = 100;
    const normalizedConfidence = (data.confidence ?? 50) / PERCENTAGE_DIVISOR;

    return {
      score: data.compositeScore,
      signal: this.getSignalFromScore(data.compositeScore),
      confidence: normalizedConfidence,
      weight: CombinedSentimentService.WEIGHTS.ANALYTICS,
    };
  }

  /**
   * Calculate futures component sentiment
   */
  private calculateFuturesSentiment(
    data: FuturesSentimentData | null
  ): ComponentSentiment {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        confidence: 0,
        weight: CombinedSentimentService.WEIGHTS.FUTURES,
      };
    }

    const FUNDING_SCALE = 200_000; // Scale factor for funding rate
    const OI_SCALE = 10; // Scale factor for OI change

    // Calculate score based on funding and OI
    const fundingScore = data.fundingRate * FUNDING_SCALE;
    const oiScore = data.oiChangePct / OI_SCALE;

    // If price and OI move together, strong signal
    const priceOIAlignment =
      (data.oiChangePct > 0 && data.priceChangePct > 0) ||
      (data.oiChangePct < 0 && data.priceChangePct < 0);

    const rawScore = (fundingScore + oiScore) / 2;
    const score = priceOIAlignment ? rawScore * 1.5 : rawScore;

    // Clamp to -100 to +100
    const clampedScore = Math.max(-100, Math.min(100, score));

    // Higher confidence if funding deviates from 24h average
    const fundingDeviation = Math.abs(data.fundingRate - data.fundingAvg24h);
    const BASE_CONFIDENCE = 0.7;
    const DEVIATION_SCALE = 1000;
    const confidence = Math.min(
      1,
      BASE_CONFIDENCE + fundingDeviation * DEVIATION_SCALE
    );

    return {
      score: clampedScore,
      signal: this.getSignalFromScore(clampedScore),
      confidence,
      weight: CombinedSentimentService.WEIGHTS.FUTURES,
    };
  }

  /**
   * Calculate order book component sentiment
   */
  private calculateOrderBookSentiment(
    data: OrderBookData | null
  ): ComponentSentiment {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        confidence: 0,
        weight: CombinedSentimentService.WEIGHTS.ORDER_BOOK,
      };
    }

    const IMBALANCE_SCALE = 100;

    // Bid/ask imbalance is primary signal
    const score = data.bidAskImbalance * IMBALANCE_SCALE;

    // Confidence based on liquidity
    const MIN_LIQUIDITY_THRESHOLD = 50;
    const confidence =
      data.liquidityScore > MIN_LIQUIDITY_THRESHOLD
        ? Math.min(1, data.liquidityScore / 100)
        : 0.3;

    return {
      score,
      signal: this.getSignalFromScore(score),
      confidence,
      weight: CombinedSentimentService.WEIGHTS.ORDER_BOOK,
    };
  }

  /**
   * Calculate social component sentiment (Telegram + Twitter)
   */
  private calculateSocialSentiment(
    data: SocialSentimentData | null
  ): ComponentSentiment {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        confidence: 0,
        weight: CombinedSentimentService.WEIGHTS.SOCIAL,
      };
    }

    // Convert from -1..1 range to -100..+100 range
    const SCORE_SCALE = 100;
    const score = data.overall * SCORE_SCALE;

    // Use confidence from social sentiment data
    // Boost confidence if we have both Telegram and Twitter data
    const hasTelegram = data.telegram.signals > 0;
    const hasTwitter = data.twitter.tweets > 0;

    let confidence = data.confidence;
    if (hasTelegram && hasTwitter) {
      confidence = Math.min(1, confidence * 1.2); // 20% boost for having both sources
    }

    return {
      score,
      signal: this.getSignalFromScore(score),
      confidence,
      weight: CombinedSentimentService.WEIGHTS.SOCIAL,
    };
  }

  /**
   * Calculate combined score from all components
   */
  private calculateCombinedScore(components: {
    analytics: ComponentSentiment;
    futures: ComponentSentiment;
    orderBook: ComponentSentiment;
    social: ComponentSentiment;
  }): number {
    const weightedSum =
      components.analytics.score *
        components.analytics.confidence *
        components.analytics.weight +
      components.futures.score *
        components.futures.confidence *
        components.futures.weight +
      components.orderBook.score *
        components.orderBook.confidence *
        components.orderBook.weight +
      components.social.score *
        components.social.confidence *
        components.social.weight;

    const totalConfidenceWeight =
      components.analytics.confidence * components.analytics.weight +
      components.futures.confidence * components.futures.weight +
      components.orderBook.confidence * components.orderBook.weight +
      components.social.confidence * components.social.weight;

    if (totalConfidenceWeight === 0) {
      return 0;
    }

    const combinedScore = weightedSum / totalConfidenceWeight;

    // Debug logging to understand the calculation
    this.logger.debug("Combined score calculation", {
      analytics: {
        score: components.analytics.score,
        confidence: components.analytics.confidence,
        weight: components.analytics.weight,
        contribution:
          components.analytics.score *
          components.analytics.confidence *
          components.analytics.weight,
      },
      futures: {
        score: components.futures.score,
        confidence: components.futures.confidence,
        weight: components.futures.weight,
        contribution:
          components.futures.score *
          components.futures.confidence *
          components.futures.weight,
      },
      orderBook: {
        score: components.orderBook.score,
        confidence: components.orderBook.confidence,
        weight: components.orderBook.weight,
        contribution:
          components.orderBook.score *
          components.orderBook.confidence *
          components.orderBook.weight,
      },
      social: {
        score: components.social.score,
        confidence: components.social.confidence,
        weight: components.social.weight,
        contribution:
          components.social.score *
          components.social.confidence *
          components.social.weight,
      },
      weightedSum,
      totalConfidenceWeight,
      combinedScore,
    });

    return combinedScore;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(components: {
    analytics: ComponentSentiment;
    futures: ComponentSentiment;
    orderBook: ComponentSentiment;
    social: ComponentSentiment;
  }): number {
    // Count available components (confidence > 0)
    const availableComponents: Array<{ confidence: number; weight: number }> =
      [];

    if (components.analytics.confidence > 0) {
      availableComponents.push(components.analytics);
    }
    if (components.futures.confidence > 0) {
      availableComponents.push(components.futures);
    }
    if (components.orderBook.confidence > 0) {
      availableComponents.push(components.orderBook);
    }
    if (components.social.confidence > 0) {
      availableComponents.push(components.social);
    }

    // If no components available, return 0
    if (availableComponents.length === 0) {
      return 0;
    }

    // Calculate weighted average confidence ONLY for available components
    const totalWeight = availableComponents.reduce(
      (sum, c) => sum + c.weight,
      0
    );
    const weightedConfidence = availableComponents.reduce(
      (sum, c) => sum + c.confidence * c.weight,
      0
    );

    const avgConfidence = weightedConfidence / totalWeight;

    // Penalty for missing data sources
    const TOTAL_COMPONENTS = 4;
    const missingPenalty =
      (TOTAL_COMPONENTS - availableComponents.length) * 0.12;

    // Check for signal alignment (only for available components)
    const signals = availableComponents.map((c) => {
      if (c === components.analytics) return components.analytics.signal;
      if (c === components.futures) return components.futures.signal;
      if (c === components.social) return components.social.signal;
      return components.orderBook.signal;
    });

    const bullishCount = signals.filter((s) => s === "BULLISH").length;
    const bearishCount = signals.filter((s) => s === "BEARISH").length;

    // If all available components align, give small bonus
    const ALIGNMENT_BONUS = 0.1;
    const alignmentBonus =
      (bullishCount === signals.length || bearishCount === signals.length) &&
      signals.length >= 2
        ? ALIGNMENT_BONUS
        : 0;

    // Final confidence = avg - penalty + bonus
    const finalConfidence = avgConfidence - missingPenalty + alignmentBonus;

    return Math.max(0, Math.min(1, finalConfidence));
  }

  /**
   * Get signal from score
   */
  private getSignalFromScore(score: number): SentimentSignal {
    // Use consistent thresholds: -20 to +20 is NEUTRAL zone
    const BULLISH_THRESHOLD = 20;
    const BEARISH_THRESHOLD = -20;

    if (score > BULLISH_THRESHOLD) return "BULLISH";
    if (score < BEARISH_THRESHOLD) return "BEARISH";
    return "NEUTRAL";
  }

  /**
   * Get strength from score
   */
  private getStrengthFromScore(score: number): "WEAK" | "MODERATE" | "STRONG" {
    const absScore = Math.abs(score);

    if (absScore >= CombinedSentimentService.STRENGTH_THRESHOLDS.STRONG) {
      return "STRONG";
    }
    if (absScore >= CombinedSentimentService.STRENGTH_THRESHOLDS.MODERATE) {
      return "MODERATE";
    }
    return "WEAK";
  }

  /**
   * Generate trading recommendation
   */
  private generateRecommendation(
    score: number,
    confidence: number,
    components: {
      analytics: ComponentSentiment;
      futures: ComponentSentiment;
      orderBook: ComponentSentiment;
      social: ComponentSentiment;
    }
  ): {
    action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
    reasoning: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  } {
    const thresholds = CombinedSentimentService.RECOMMENDATION_THRESHOLDS;
    const MIN_CONFIDENCE_FOR_STRONG_ACTION = 0.75;

    let action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" = "HOLD";

    if (
      score >= thresholds.STRONG_BUY &&
      confidence >= MIN_CONFIDENCE_FOR_STRONG_ACTION
    ) {
      action = "STRONG_BUY";
    } else if (score >= thresholds.BUY) {
      action = "BUY";
    } else if (
      score <= thresholds.STRONG_SELL &&
      confidence >= MIN_CONFIDENCE_FOR_STRONG_ACTION
    ) {
      action = "STRONG_SELL";
    } else if (score <= thresholds.SELL) {
      action = "SELL";
    }

    // Determine risk level
    // Check how many components are available
    const availableCount =
      (components.analytics.confidence > 0 ? 1 : 0) +
      (components.futures.confidence > 0 ? 1 : 0) +
      (components.orderBook.confidence > 0 ? 1 : 0) +
      (components.social.confidence > 0 ? 1 : 0);

    let riskLevel: "LOW" | "MEDIUM" | "HIGH";

    // If less than 2 components available, risk is at least MEDIUM
    if (availableCount < 2) {
      riskLevel = "HIGH";
    } else if (
      confidence >= MIN_CONFIDENCE_FOR_STRONG_ACTION &&
      availableCount === 4
    ) {
      riskLevel = "LOW";
    } else if (confidence >= 0.5 && availableCount >= 3) {
      riskLevel = "MEDIUM";
    } else {
      riskLevel = "HIGH";
    }

    // Generate reasoning
    const reasons: string[] = [];

    if (components.analytics.confidence > 0.7) {
      reasons.push(
        `Analytics ${components.analytics.signal.toLowerCase()} (${Math.round(components.analytics.score)})`
      );
    }

    if (components.futures.confidence > 0.7) {
      reasons.push(
        `Futures ${components.futures.signal.toLowerCase()} (${Math.round(components.futures.score)})`
      );
    }

    if (components.orderBook.confidence > 0.7) {
      reasons.push(
        `Order flow ${components.orderBook.signal.toLowerCase()} (${Math.round(components.orderBook.score)})`
      );
    }

    if (components.social.confidence > 0.7) {
      reasons.push(
        `Social ${components.social.signal.toLowerCase()} (${Math.round(components.social.score)})`
      );
    }

    const reasoning =
      reasons.length > 0
        ? reasons.join(", ")
        : `Low confidence signal (${Math.round(confidence * 100)}%)`;

    return {
      action,
      reasoning,
      riskLevel,
    };
  }

  /**
   * Generate insights
   */
  private generateInsights(context: {
    analytics: ComponentSentiment;
    futures: ComponentSentiment;
    orderBook: ComponentSentiment;
    social: ComponentSentiment;
    combinedScore: number;
    combinedSignal: SentimentSignal;
  }): string[] {
    const insights: string[] = [];

    // Check for missing data sources
    const missingDataSources: string[] = [];
    if (context.analytics.confidence === 0) {
      missingDataSources.push("Analytics");
    }
    if (context.futures.confidence === 0) {
      missingDataSources.push("Futures");
    }
    if (context.orderBook.confidence === 0) {
      missingDataSources.push("Order Book");
    }
    if (context.social.confidence === 0) {
      missingDataSources.push("Social");
    }

    if (missingDataSources.length > 0) {
      insights.push(
        `⚠️ Limited data: ${missingDataSources.join(", ")} unavailable - confidence reduced`
      );
    }

    // Check for strong alignment
    if (
      context.analytics.signal === context.futures.signal &&
      context.futures.signal === context.orderBook.signal &&
      context.orderBook.signal === context.social.signal &&
      context.analytics.signal !== "NEUTRAL"
    ) {
      insights.push(
        `🎯 Strong ${context.combinedSignal.toLowerCase()} consensus across all metrics`
      );
    }

    // Check for divergences
    if (
      context.analytics.signal === "BULLISH" &&
      context.futures.signal === "BEARISH"
    ) {
      insights.push(
        "⚠️ Divergence: Analytics bullish but futures bearish - potential reversal"
      );
    }

    if (
      context.analytics.signal === "BEARISH" &&
      context.futures.signal === "BULLISH"
    ) {
      insights.push(
        "⚠️ Divergence: Analytics bearish but futures bullish - watch for trend change"
      );
    }

    // Social sentiment divergence
    if (
      context.social.confidence > 0.5 &&
      context.social.signal !== context.combinedSignal &&
      context.social.signal !== "NEUTRAL"
    ) {
      insights.push(
        `💬 Social sentiment ${context.social.signal.toLowerCase()} diverges from market - monitor community mood`
      );
    }

    // Order book insights
    if (context.orderBook.confidence > 0.7) {
      if (context.orderBook.score > 50) {
        insights.push("💪 Strong buying pressure in order book");
      } else if (context.orderBook.score < -50) {
        insights.push("📉 Heavy selling pressure in order book");
      }
    }

    // Futures insights
    if (context.futures.confidence > 0.7) {
      if (context.futures.score > 50) {
        insights.push("📈 Futures market showing strong bullish positioning");
      } else if (context.futures.score < -50) {
        insights.push("📉 Futures market showing strong bearish positioning");
      }
    }

    // Social sentiment insights
    if (context.social.confidence > 0.7) {
      if (context.social.score > 50) {
        insights.push(
          "🚀 Social sentiment extremely positive - high community interest"
        );
      } else if (context.social.score < -50) {
        insights.push(
          "😰 Social sentiment very negative - community concern rising"
        );
      }
    }

    // Overall strength
    const absScore = Math.abs(context.combinedScore);
    if (absScore > 70) {
      insights.push(
        `🔥 Extreme ${context.combinedSignal.toLowerCase()} signal detected`
      );
    } else if (absScore < 15) {
      insights.push("😐 Market is neutral - wait for clearer signal");
    }

    return insights;
  }
}
