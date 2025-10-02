import type { Logger } from "@aladdin/shared/logger";
import { type ClickHouseClient, createClient } from "@clickhouse/client";

export type Tweet = {
  id: string;
  text: string;
  author?: string;
  timestamp?: number;
  likes?: number;
  retweets?: number;
};

const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Twitter Client - интеграция с twity сервисом и ClickHouse
 */
export class TwitterClient {
  private twityUrl: string;
  private clickhouse: ClickHouseClient;
  private clickhouseDatabase: string;

  constructor(
    twityUrl: string,
    private logger: Logger
  ) {
    this.twityUrl = twityUrl.replace(/\/$/, "");

    // Инициализация ClickHouse клиента
    const host = process.env.CLICKHOUSE_HOST || "http://localhost";
    const port = Number(process.env.CLICKHOUSE_PORT) || 8123;
    this.clickhouseDatabase = process.env.CLICKHOUSE_DATABASE || "default";
    const username = process.env.CLICKHOUSE_USER || "default";
    const password = process.env.CLICKHOUSE_PASSWORD || "";

    this.clickhouse = createClient({
      url: `${host}:${port}`,
      username,
      password,
      database: this.clickhouseDatabase,
      clickhouse_settings: {
        date_time_input_format: "best_effort",
      },
    });

    this.logger.info("ClickHouse client initialized for Twitter", {
      url: `${host}:${port}`,
      database: this.clickhouseDatabase,
    });
  }

  /**
   * Search tweets by symbol from ClickHouse
   */
  async searchTweetsBySymbol(symbol: string, limit = 50): Promise<Tweet[]> {
    try {
      const baseSymbol = symbol.replace("USDT", "");

      const query = `
        SELECT 
          tweet_id as id,
          text,
          username as author,
          toUnixTimestamp(datetime) * 1000 as timestamp,
          likes,
          retweets
        FROM twitter_tweets
        WHERE has(symbols, '${baseSymbol}')
          AND datetime >= now() - INTERVAL 24 HOUR
        ORDER BY datetime DESC
        LIMIT ${limit}
      `;

      const result = await this.chClient.query({
        query,
        format: "JSONEachRow",
      });

      const tweets = await result.json<Tweet[]>();
      this.logger.info("Fetched tweets from ClickHouse", {
        count: tweets.length,
        symbol: baseSymbol,
      });

      return tweets;
    } catch (error) {
      this.logger.error("Failed to fetch tweets from ClickHouse", {
        error,
        symbol,
      });
      return [];
    }
  }

  /**
   * Get recent tweets from all influencers
   */
  async getRecentTweets(limit = 100): Promise<Tweet[]> {
    try {
      const query = `
        SELECT 
          tweet_id as id,
          text,
          username as author,
          toUnixTimestamp(datetime) * 1000 as timestamp,
          likes,
          retweets
        FROM twitter_tweets
        WHERE datetime >= now() - INTERVAL 24 HOUR
        ORDER BY datetime DESC
        LIMIT ${limit}
      `;

      const result = await this.chClient.query({
        query,
        format: "JSONEachRow",
      });

      const tweets = await result.json<Tweet[]>();
      this.logger.info("Fetched recent tweets from ClickHouse", {
        count: tweets.length,
      });

      return tweets;
    } catch (error) {
      this.logger.error("Failed to fetch recent tweets", error);
      return [];
    }
  }

  /**
   * Check health of twity service
   */
  async checkHealth(): Promise<boolean> {
    try {
      const url = `${this.twityUrl}/health`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      return response.ok;
    } catch (error) {
      this.logger.error("Twitter service health check failed", error);
      return false;
    }
  }

  /**
   * Analyze sentiment from tweets using simple keyword matching
   * Returns a score from -1 (very negative) to 1 (very positive)
   */
  analyzeSentiment(tweets: Tweet[]): {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    total: number;
  } {
    if (tweets.length === 0) {
      return { score: 0, positive: 0, negative: 0, neutral: 0, total: 0 };
    }

    // Keyword lists for sentiment analysis
    const bullishKeywords = [
      "bullish",
      "moon",
      "pump",
      "buy",
      "long",
      "breakout",
      "rally",
      "surge",
      "gain",
      "profit",
      "win",
      "green",
      "ath", // all-time high
      "hodl",
      "accumulate",
      "undervalued",
      "gem",
    ];

    const bearishKeywords = [
      "bearish",
      "dump",
      "sell",
      "short",
      "crash",
      "drop",
      "fall",
      "loss",
      "red",
      "atl", // all-time low
      "panic",
      "scam",
      "rug",
      "overvalued",
      "bubble",
    ];

    let positive = 0;
    let negative = 0;
    let neutral = 0;

    for (const tweet of tweets) {
      const text = tweet.text.toLowerCase();

      const bullishCount = bullishKeywords.filter((kw) =>
        text.includes(kw)
      ).length;
      const bearishCount = bearishKeywords.filter((kw) =>
        text.includes(kw)
      ).length;

      if (bullishCount > bearishCount) {
        positive++;
      } else if (bearishCount > bullishCount) {
        negative++;
      } else {
        neutral++;
      }
    }

    const total = tweets.length;
    const score = total > 0 ? (positive - negative) / total : 0;

    return { score, positive, negative, neutral, total };
  }
}
