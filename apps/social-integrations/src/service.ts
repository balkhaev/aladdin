import { BaseService } from "@aladdin/shared/base-service";

type SocialSentiment = {
  symbol: string;
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
  timestamp: string;
};

/**
 * Social Integrations Service
 * Combines Telegram (telega) and Twitter (twity) integrations
 */
export class SocialIntegrationsService extends BaseService {
  // Bullish keywords
  private readonly BULLISH_KEYWORDS = [
    "bullish",
    "bull",
    "moon",
    "pump",
    "buy",
    "long",
    "calls",
    "🚀",
    "📈",
    "💎",
    "🔥",
    "breakout",
    "rally",
    "surge",
    "soar",
    "gains",
    "profit",
    "winning",
    "strong",
    "growth",
    "rise",
  ];

  // Bearish keywords
  private readonly BEARISH_KEYWORDS = [
    "bearish",
    "bear",
    "dump",
    "sell",
    "short",
    "puts",
    "crash",
    "📉",
    "⚠️",
    "😰",
    "drop",
    "fall",
    "decline",
    "down",
    "loss",
    "losing",
    "weak",
    "resistance",
    "correction",
    "pullback",
  ];

  getServiceName(): string {
    return "social-integrations";
  }

  protected onInitialize(): Promise<void> {
    this.logger.info("Social Integrations Service initialized");
    // Future: Initialize telega and twity services here
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    this.logger.info("Shutting down Social Integrations Service");
    // Future: Cleanup telega and twity services here
    return Promise.resolve();
  }

  /**
   * Analyze social sentiment for a symbol from Telegram and Twitter
   */
  async analyzeSocialSentiment(symbol: string): Promise<SocialSentiment> {
    this.logger.info("Analyzing social sentiment", { symbol });

    // Get Twitter sentiment from ClickHouse
    const twitterSentiment = await this.analyzeTwitterSentiment(symbol);

    // Telegram sentiment (placeholder for now)
    const telegramSentiment = {
      score: 0,
      bullish: 0,
      bearish: 0,
      signals: 0,
    };

    // Calculate overall sentiment
    const twitterWeight = Math.min(twitterSentiment.tweets / 50, 1); // Max weight at 50 tweets
    const telegramWeight = Math.min(telegramSentiment.signals / 10, 1); // Max weight at 10 signals

    const totalWeight = twitterWeight + telegramWeight;
    const overall =
      totalWeight > 0
        ? (twitterSentiment.score * twitterWeight +
            telegramSentiment.score * telegramWeight) /
          totalWeight
        : 0;

    // Calculate confidence based on data volume
    const tweetsConfidence = Math.min(twitterSentiment.tweets / 20, 1);
    const signalsConfidence = Math.min(telegramSentiment.signals / 5, 1);
    const confidence = (tweetsConfidence + signalsConfidence) / 2;

    return {
      symbol,
      overall,
      telegram: telegramSentiment,
      twitter: twitterSentiment,
      confidence,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze Twitter sentiment from ClickHouse
   */
  private async analyzeTwitterSentiment(symbol: string): Promise<{
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    tweets: number;
  }> {
    if (!this.clickhouse) {
      return {
        score: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        tweets: 0,
      };
    }

    try {
      // Normalize symbol (remove USDT suffix for search)
      const baseSymbol = symbol.replace("USDT", "").replace("BUSD", "");

      // Query tweets from last 24 hours
      const query = `
        SELECT 
          text,
          sentiment_keywords,
          likes,
          retweets,
          datetime
        FROM aladdin.twitter_tweets
        WHERE 
          (has(symbols, '${baseSymbol}') OR has(symbols, '${symbol}'))
          AND datetime >= now() - INTERVAL 24 HOUR
        ORDER BY datetime DESC
        LIMIT 100
      `;

      const tweets = await this.clickhouse.query<{
        text: string;
        sentiment_keywords: string[];
        likes: number;
        retweets: number;
        datetime: string;
      }>(query);

      if (!Array.isArray(tweets) || tweets.length === 0) {
        return {
          score: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          tweets: 0,
        };
      }

      // Analyze sentiment for each tweet
      let positive = 0;
      let negative = 0;
      let neutral = 0;

      for (const tweet of tweets) {
        const text = (tweet.text as string).toLowerCase();
        const bullishCount = this.BULLISH_KEYWORDS.filter((kw) =>
          text.includes(kw.toLowerCase())
        ).length;
        const bearishCount = this.BEARISH_KEYWORDS.filter((kw) =>
          text.includes(kw.toLowerCase())
        ).length;

        if (bullishCount > bearishCount) {
          positive++;
        } else if (bearishCount > bullishCount) {
          negative++;
        } else {
          neutral++;
        }
      }

      // Calculate sentiment score (-1 to 1)
      const totalAnalyzed = positive + negative + neutral;
      const score =
        totalAnalyzed > 0 ? (positive - negative) / totalAnalyzed : 0;

      return {
        score,
        positive,
        negative,
        neutral,
        tweets: tweets.length,
      };
    } catch (error) {
      this.logger.error("Failed to analyze Twitter sentiment", {
        symbol,
        error,
      });

      return {
        score: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        tweets: 0,
      };
    }
  }
}
