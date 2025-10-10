import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { SentimentAnalyzer } from "../sentiment/analyzer";
import { scrapeRedditBySearch, scrapeRedditSubreddit } from "./scraper";
import type { RedditPost, RedditSubredditConfig } from "./types";

/**
 * Reddit subreddits to monitor for crypto content
 */
const CRYPTO_SUBREDDITS: RedditSubredditConfig[] = [
  { name: "CryptoCurrency", enabled: true, cryptoRelevance: 1.0, weight: 1.5 },
  { name: "Bitcoin", enabled: true, cryptoRelevance: 1.0, weight: 1.3 },
  { name: "ethereum", enabled: true, cryptoRelevance: 1.0, weight: 1.2 },
  { name: "CryptoMarkets", enabled: true, cryptoRelevance: 1.0, weight: 1.2 },
  { name: "altcoin", enabled: true, cryptoRelevance: 1.0, weight: 1.0 },
  { name: "binance", enabled: true, cryptoRelevance: 0.9, weight: 0.9 },
  {
    name: "SatoshiStreetBets",
    enabled: true,
    cryptoRelevance: 0.8,
    weight: 0.8,
  },
  { name: "CryptoMoonShots", enabled: true, cryptoRelevance: 0.7, weight: 0.6 },
];

const DEFAULT_SCRAPE_INTERVAL_MS = 900_000; // 15 minutes
const DEFAULT_POSTS_LIMIT = 25;
const MS_PER_MINUTE = 60_000;

export class RedditService {
  private scrapeInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly clickhouse: ClickHouseClient,
    private readonly sentimentAnalyzer: SentimentAnalyzer,
    private readonly logger: Logger,
    private readonly postsLimit: number = DEFAULT_POSTS_LIMIT
  ) {}

  // Regex patterns (defined at class level for performance)
  private static readonly SYMBOL_NORMALIZE_REGEX = /USDT|BUSD|USD$/i;
  private static readonly DOLLAR_SYMBOL_REGEX = /\$([A-Z]{2,10})/g;

  /**
   * Search Reddit for posts about a symbol
   */
  async searchSymbol(symbol: string, limit = 25): Promise<RedditPost[]> {
    try {
      // Normalize symbol (remove USDT suffix for search)
      const baseSymbol = symbol.replace(
        RedditService.SYMBOL_NORMALIZE_REGEX,
        ""
      );

      // Search Reddit
      const searchQuery = `${baseSymbol} crypto`;
      const result = await scrapeRedditBySearch(
        searchQuery,
        limit,
        "relevance"
      );

      this.logger.info("Reddit search completed", {
        symbol,
        found: result.posts.length,
      });

      // Store in ClickHouse
      await this.storePosts(result.posts, symbol);

      return result.posts;
    } catch (error) {
      this.logger.error("Failed to search Reddit", { symbol, error });
      return [];
    }
  }

  /**
   * Monitor crypto subreddits for posts
   */
  async monitorSubreddits(limit = 10): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];

    for (const subreddit of CRYPTO_SUBREDDITS) {
      if (!subreddit.enabled) continue;

      try {
        const posts = await scrapeRedditSubreddit(subreddit.name, limit, "hot");

        this.logger.info("Scraped subreddit", {
          subreddit: subreddit.name,
          posts: posts.length,
        });

        allPosts.push(...posts);
      } catch (error) {
        this.logger.error("Failed to scrape subreddit", {
          subreddit: subreddit.name,
          error,
        });
      }
    }

    // Store in ClickHouse
    await this.storePosts(allPosts);

    return allPosts;
  }

  /**
   * Analyze sentiment for a symbol from Reddit
   */
  async analyzeSentiment(symbol: string): Promise<{
    score: number; // -1 to 1
    confidence: number;
    posts: number;
    positive: number;
    negative: number;
    neutral: number;
  }> {
    try {
      // Query posts from ClickHouse (last 24 hours)
      const baseSymbol = symbol.replace(
        RedditService.SYMBOL_NORMALIZE_REGEX,
        ""
      );

      const query = `
        SELECT 
          title,
          text,
          score,
          datetime
        FROM aladdin.reddit_posts
        WHERE 
          (positionCaseInsensitive(title, '${baseSymbol}') > 0 
           OR positionCaseInsensitive(text, '${baseSymbol}') > 0)
          AND datetime >= now() - INTERVAL 24 HOUR
        ORDER BY datetime DESC
        LIMIT 100
      `;

      const posts = await this.clickhouse.query<{
        title: string;
        text: string;
        score: number;
        datetime: string;
      }>(query);

      if (!Array.isArray(posts) || posts.length === 0) {
        return {
          score: 0,
          confidence: 0,
          posts: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
        };
      }

      // Analyze sentiment
      const sentimentInputs = posts.map((post) => ({
        text: `${post.title} ${post.text}`,
        weight: Math.log10(Math.max(1, post.score)), // Weight by upvotes (log scale)
        source: "reddit",
      }));

      const sentiment = this.sentimentAnalyzer.analyzeMultiple(sentimentInputs);

      this.logger.info("Reddit sentiment analyzed", {
        symbol,
        score: sentiment.score,
        posts: posts.length,
      });

      return {
        score: sentiment.score,
        confidence: sentiment.confidence,
        posts: posts.length,
        positive: sentiment.positive,
        negative: sentiment.negative,
        neutral: sentiment.neutral,
      };
    } catch (error) {
      this.logger.error("Failed to analyze Reddit sentiment", {
        symbol,
        error,
      });
      return {
        score: 0,
        confidence: 0,
        posts: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
      };
    }
  }

  /**
   * Store posts in ClickHouse
   */
  private async storePosts(
    posts: RedditPost[],
    symbol?: string
  ): Promise<void> {
    if (posts.length === 0) return;

    try {
      // Extract symbols from posts
      const postsWithSymbols = posts.map((post) => ({
        ...post,
        symbols: this.extractSymbols(`${post.title} ${post.text}`),
        analyzedSymbol: symbol,
      }));

      const query = `
        INSERT INTO aladdin.reddit_posts (
          id,
          title,
          text,
          author,
          subreddit,
          score,
          upvote_ratio,
          num_comments,
          datetime,
          url,
          flair,
          is_stickied,
          is_locked,
          symbols,
          analyzed_symbol
        ) VALUES
      `;

      const values = postsWithSymbols.map((post) => {
        const symbols = post.symbols
          .map((s) => `'${this.escapeString(s)}'`)
          .join(",");
        const flair = post.flair
          ? `'${this.escapeString(post.flair)}'`
          : "NULL";
        const analyzedSymbol = post.analyzedSymbol
          ? `'${this.escapeString(post.analyzedSymbol)}'`
          : "NULL";
        const stickied = post.isStickied ? 1 : 0;
        const locked = post.isLocked ? 1 : 0;

        return `(
          '${this.escapeString(post.id)}',
          '${this.escapeString(post.title)}',
          '${this.escapeString(post.text)}',
          '${this.escapeString(post.author)}',
          '${this.escapeString(post.subreddit)}',
          ${post.score},
          ${post.upvoteRatio},
          ${post.numComments},
          toDateTime(${post.created}),
          '${this.escapeString(post.url)}',
          ${flair},
          ${stickied},
          ${locked},
          [${symbols}],
          ${analyzedSymbol}
        )`;
      });

      await this.clickhouse.query(query + values.join(","));

      this.logger.info("Stored Reddit posts", { count: posts.length });
    } catch (error) {
      this.logger.error("Failed to store Reddit posts", { error });
    }
  }

  /**
   * Extract crypto symbols from text
   */
  private extractSymbols(text: string): string[] {
    const symbols = new Set<string>();
    const upperText = text.toUpperCase();

    // Common crypto symbols
    const knownSymbols = [
      "BTC",
      "ETH",
      "BNB",
      "SOL",
      "ADA",
      "XRP",
      "DOT",
      "DOGE",
      "AVAX",
      "MATIC",
      "LINK",
      "UNI",
      "ATOM",
      "LTC",
      "ETC",
      "XLM",
      "ALGO",
      "VET",
      "ICP",
      "FIL",
    ];

    for (const symbol of knownSymbols) {
      if (upperText.includes(symbol)) {
        symbols.add(symbol);
      }
    }

    // Look for $SYMBOL patterns
    const matches = text.match(RedditService.DOLLAR_SYMBOL_REGEX);
    if (matches) {
      for (const match of matches) {
        symbols.add(match.slice(1)); // Remove $
      }
    }

    return Array.from(symbols);
  }

  /**
   * Escape string for ClickHouse
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  }

  /**
   * Start periodic monitoring of crypto subreddits
   */
  startPeriodicMonitoring(intervalMs?: number): void {
    const interval = intervalMs || DEFAULT_SCRAPE_INTERVAL_MS;

    if (this.scrapeInterval) {
      this.logger.warn("Periodic Reddit monitoring already running");
      return;
    }

    this.logger.info("Starting periodic Reddit monitoring", {
      intervalMinutes: interval / MS_PER_MINUTE,
      postsLimit: this.postsLimit,
      subreddits: CRYPTO_SUBREDDITS.length,
    });

    // Run immediately
    this.monitorSubreddits(this.postsLimit).catch((error) => {
      this.logger.error("Initial Reddit monitoring failed", { error });
    });

    // Then run periodically
    this.scrapeInterval = setInterval(() => {
      this.monitorSubreddits(this.postsLimit).catch((error) => {
        this.logger.error("Periodic Reddit monitoring failed", { error });
      });
    }, interval);

    this.isRunning = true;
  }

  /**
   * Stop periodic monitoring
   */
  stopPeriodicMonitoring(): void {
    if (this.scrapeInterval) {
      clearInterval(this.scrapeInterval);
      this.scrapeInterval = null;
      this.isRunning = false;
      this.logger.info("Periodic Reddit monitoring stopped");
    }
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    running: boolean;
    postsLimit: number;
    subreddits: number;
  } {
    return {
      running: this.isRunning,
      postsLimit: this.postsLimit,
      subreddits: CRYPTO_SUBREDDITS.filter((s) => s.enabled).length,
    };
  }
}
