import type { Logger } from "@aladdin/logger";
import type { SentimentData, SentimentFeatures } from "../types";

/**
 * Sentiment Integration Service
 * Fetches and processes sentiment data from scraper service
 */
export class SentimentIntegrationService {
  private readonly SCRAPER_URL =
    process.env.SCRAPER_URL ||
    process.env.SOCIAL_INTEGRATIONS_URL ||
    "http://localhost:3018";

  // Cache для sentiment данных (1 минута TTL)
  private cache = new Map<string, { data: SentimentData; timestamp: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(private readonly logger: Logger) {}

  /**
   * Получить sentiment данные из scraper service (с кешированием)
   */
  async fetchSentimentData(symbol: string): Promise<SentimentData | null> {
    try {
      // Check cache first
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug("Using cached sentiment data", { symbol });
        return cached.data;
      }

      const response = await fetch(
        `${this.SCRAPER_URL}/api/social/sentiment/${symbol}`
      );

      if (!response.ok) {
        throw new Error(`Scraper API error: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error("Invalid response from scraper service");
      }

      if (!result.data) {
        throw new Error("No data in response from scraper service");
      }

      const sentimentData = result.data as SentimentData;

      // Update cache
      this.cache.set(symbol, {
        data: sentimentData,
        timestamp: Date.now(),
      });

      return sentimentData;
    } catch (error) {
      this.logger.error("Failed to fetch sentiment data", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Вычислить sentiment features из raw данных
   */
  calculateSentimentFeatures(data: SentimentData): SentimentFeatures {
    const totalTweets = data.twitter.tweets;
    const totalPosts = data.reddit.posts;
    const totalSignals = data.telegram.signals;
    const socialVolume = totalTweets + totalPosts + totalSignals;

    // Calculate bullish/bearish ratios
    const totalPositive =
      data.twitter.positive + data.reddit.positive + data.telegram.bullish;
    const totalNegative =
      data.twitter.negative + data.reddit.negative + data.telegram.bearish;
    const totalSentimentItems = totalPositive + totalNegative;

    const bullishRatio =
      totalSentimentItems > 0 ? totalPositive / totalSentimentItems : 0.5;
    const bearishRatio =
      totalSentimentItems > 0 ? totalNegative / totalSentimentItems : 0.5;

    return {
      overall: data.overall,
      twitterScore: data.twitter.score,
      redditScore: data.reddit.score,
      telegramScore: data.telegram.score,
      socialVolume,
      socialConfidence: data.confidence,
      bullishRatio,
      bearishRatio,
    };
  }

  /**
   * Получить sentiment-adjusted multiplier для predictions
   * Возвращает multiplier от 0.9 до 1.1 в зависимости от sentiment
   */
  getSentimentMultiplier(sentimentData: SentimentData | null): number {
    if (!sentimentData || sentimentData.confidence < 0.3) {
      return 1.0; // Neutral if no data or low confidence
    }

    // Sentiment от -1 to 1, конвертируем в multiplier 0.9 to 1.1
    // Strong bearish (-1) = 0.9x
    // Neutral (0) = 1.0x
    // Strong bullish (1) = 1.1x

    const sentimentImpact = sentimentData.overall * 0.1; // Max ±10%
    const confidenceAdjusted = sentimentImpact * sentimentData.confidence;

    return 1.0 + confidenceAdjusted;
  }

  /**
   * Определить sentiment-based bias для market regime
   */
  getSentimentRegimeBias(
    sentimentData: SentimentData | null
  ): "BULLISH" | "BEARISH" | "NEUTRAL" {
    if (!sentimentData || sentimentData.confidence < 0.5) {
      return "NEUTRAL";
    }

    if (sentimentData.overall > 0.3) {
      return "BULLISH";
    }

    if (sentimentData.overall < -0.3) {
      return "BEARISH";
    }

    return "NEUTRAL";
  }

  /**
   * Clear cache (для тестов)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
