/**
 * ClickHouse Client for Twitter data storage
 */

import type { Logger } from "@aladdin/shared/logger";
import { type ClickHouseClient, createClient } from "@clickhouse/client";
import type { Tweet } from "./types";

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://localhost:8123";

export class TwitterClickHouseClient {
  private client: ClickHouseClient;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.client = createClient({
      url: CLICKHOUSE_URL,
    });

    this.logger.info("ClickHouse client initialized", {
      url: CLICKHOUSE_URL,
    });
  }

  /**
   * Save tweets to ClickHouse
   */
  async saveTweets(tweets: Tweet[]): Promise<void> {
    if (tweets.length === 0) {
      return;
    }

    try {
      const rows = tweets.map((tweet) => ({
        tweet_id: tweet.id || "",
        username: tweet.username || "",
        display_name: tweet.displayName || "",
        text: tweet.text,
        url: tweet.url || "",
        datetime: tweet.datetime
          ? this.formatDateForClickHouse(new Date(tweet.datetime))
          : this.formatDateForClickHouse(new Date()),
        replies: tweet.replies,
        retweets: tweet.retweets,
        likes: tweet.likes,
        symbols: this.extractSymbols(tweet.text),
        sentiment_keywords: this.extractSentimentKeywords(tweet.text),
      }));

      await this.client.insert({
        table: "twitter_tweets",
        values: rows,
        format: "JSONEachRow",
      });

      this.logger.info("Saved tweets to ClickHouse", { count: rows.length });
    } catch (error) {
      this.logger.error("Failed to save tweets to ClickHouse", error);
      throw error;
    }
  }

  /**
   * Start a scraping run
   */
  async startScrapeRun(): Promise<string> {
    try {
      const runId = crypto.randomUUID();
      const now = new Date();
      const startedAt = this.formatDateForClickHouse(now);

      await this.client.insert({
        table: "twitter_scrape_runs",
        values: [
          {
            run_id: runId,
            started_at: startedAt,
            completed_at: null, // Will update later
            status: "running",
            influencers_scraped: 0,
            tweets_collected: 0,
            error_message: "",
          },
        ],
        format: "JSONEachRow",
      });

      this.logger.info("Started scrape run", { runId });
      return runId;
    } catch (error) {
      this.logger.error("Failed to start scrape run", error);
      throw error;
    }
  }

  /**
   * Complete a scraping run
   */
  async completeScrapeRun(options: {
    runId: string;
    status: "completed" | "failed";
    influencersScraped: number;
    tweetsCollected: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      const now = new Date();
      const completedAt = this.formatDateForClickHouse(now);
      const {
        runId,
        status,
        influencersScraped,
        tweetsCollected,
        errorMessage = "",
      } = options;

      await this.client.insert({
        table: "twitter_scrape_runs",
        values: [
          {
            run_id: runId,
            started_at: completedAt, // Use same time for deduplication
            completed_at: completedAt,
            status,
            influencers_scraped: influencersScraped,
            tweets_collected: tweetsCollected,
            error_message: errorMessage,
          },
        ],
        format: "JSONEachRow",
      });

      this.logger.info("Completed scrape run", {
        runId,
        status,
        influencersScraped,
        tweetsCollected,
      });
    } catch (error) {
      this.logger.error("Failed to complete scrape run", error);
    }
  }

  /**
   * Extract crypto symbols from text
   * Searches for both ticker symbols (BTC) and full names (Bitcoin)
   */
  private extractSymbols(text: string): string[] {
    const symbolMappings = [
      { symbol: "BTC", names: ["BTC", "BITCOIN", "$BTC", "#BTC"] },
      { symbol: "ETH", names: ["ETH", "ETHEREUM", "$ETH", "#ETH"] },
      { symbol: "SOL", names: ["SOL", "SOLANA", "$SOL", "#SOL"] },
      { symbol: "BNB", names: ["BNB", "BINANCE COIN", "$BNB", "#BNB"] },
      { symbol: "XRP", names: ["XRP", "RIPPLE", "$XRP", "#XRP"] },
      { symbol: "ADA", names: ["ADA", "CARDANO", "$ADA", "#ADA"] },
      { symbol: "DOGE", names: ["DOGE", "DOGECOIN", "$DOGE", "#DOGE"] },
      { symbol: "AVAX", names: ["AVAX", "AVALANCHE", "$AVAX", "#AVAX"] },
      { symbol: "DOT", names: ["DOT", "POLKADOT", "$DOT", "#DOT"] },
      { symbol: "MATIC", names: ["MATIC", "POLYGON", "$MATIC", "#MATIC"] },
      { symbol: "LINK", names: ["LINK", "CHAINLINK", "$LINK", "#LINK"] },
      { symbol: "UNI", names: ["UNI", "UNISWAP", "$UNI", "#UNI"] },
      { symbol: "ATOM", names: ["ATOM", "COSMOS", "$ATOM", "#ATOM"] },
      { symbol: "LTC", names: ["LTC", "LITECOIN", "$LTC", "#LTC"] },
      { symbol: "BCH", names: ["BCH", "BITCOIN CASH", "$BCH", "#BCH"] },
    ];

    const found = new Set<string>();
    const upperText = text.toUpperCase();

    for (const mapping of symbolMappings) {
      for (const name of mapping.names) {
        if (upperText.includes(name)) {
          found.add(mapping.symbol);
          break; // Found this symbol, move to next
        }
      }
    }

    return Array.from(found);
  }

  /**
   * Extract sentiment keywords from text
   */
  private extractSentimentKeywords(text: string): string[] {
    const keywords = {
      bullish: [
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
        "ath",
        "hodl",
        "accumulate",
        "undervalued",
        "gem",
      ],
      bearish: [
        "bearish",
        "dump",
        "sell",
        "short",
        "crash",
        "drop",
        "fall",
        "loss",
        "red",
        "atl",
        "panic",
        "scam",
        "rug",
        "overvalued",
        "bubble",
      ],
    };

    const found = new Set<string>();
    const lowerText = text.toLowerCase();

    for (const keyword of [...keywords.bullish, ...keywords.bearish]) {
      if (lowerText.includes(keyword)) {
        found.add(keyword);
      }
    }

    return Array.from(found);
  }

  /**
   * Format date for ClickHouse DateTime format
   * ClickHouse expects: YYYY-MM-DD HH:MM:SS
   */
  private formatDateForClickHouse(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}
