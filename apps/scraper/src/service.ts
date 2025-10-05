import { BaseService } from "@aladdin/shared/base-service";
import { RedditService } from "./reddit/service";
import { SentimentAnalyzer } from "./sentiment/analyzer";

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
  reddit: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    posts: number;
  };
  confidence: number; // 0 to 1
  timestamp: string;
};

/**
 * Social Integrations Service (Scraper)
 * Combines Telegram, Twitter, and Reddit sentiment analysis
 */
export class SocialIntegrationsService extends BaseService {
  private sentimentAnalyzer!: SentimentAnalyzer;
  private redditService!: RedditService;

  // Regex patterns (defined at class level for performance)
  private static readonly SYMBOL_NORMALIZE_REGEX = /USDT|BUSD|USD$/i;

  getServiceName(): string {
    return "scraper";
  }

  protected onInitialize(): Promise<void> {
    this.logger.info("Scraper Service initializing...");

    // Initialize sentiment analyzer
    this.sentimentAnalyzer = new SentimentAnalyzer(this.logger);

    // Initialize Reddit service
    if (this.clickhouse) {
      this.redditService = new RedditService(
        this.clickhouse,
        this.sentimentAnalyzer,
        this.logger
      );
    }

    this.logger.info("Scraper Service initialized successfully");
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    this.logger.info("Shutting down Scraper Service");
    return Promise.resolve();
  }

  /**
   * Analyze social sentiment for a symbol from all sources
   */
  async analyzeSocialSentiment(symbol: string): Promise<SocialSentiment> {
    this.logger.info("Analyzing social sentiment", { symbol });

    // Get sentiment from all sources in parallel
    const [twitterSentiment, redditSentiment] = await Promise.all([
      this.analyzeTwitterSentiment(symbol),
      this.analyzeRedditSentiment(symbol),
    ]);

    // Telegram sentiment (placeholder for now)
    const telegramSentiment = {
      score: 0,
      bullish: 0,
      bearish: 0,
      signals: 0,
    };

    // Calculate weights based on data volume
    const twitterWeight = Math.min(twitterSentiment.tweets / 50, 1); // Max weight at 50 tweets
    const redditWeight = Math.min(redditSentiment.posts / 25, 1); // Max weight at 25 posts
    const telegramWeight = Math.min(telegramSentiment.signals / 10, 1); // Max weight at 10 signals

    const totalWeight = twitterWeight + redditWeight + telegramWeight;
    const overall =
      totalWeight > 0
        ? (twitterSentiment.score * twitterWeight +
            redditSentiment.score * redditWeight +
            telegramSentiment.score * telegramWeight) /
          totalWeight
        : 0;

    // Calculate confidence based on data volume
    const tweetsConfidence = Math.min(twitterSentiment.tweets / 20, 1);
    const postsConfidence = Math.min(redditSentiment.posts / 15, 1);
    const signalsConfidence = Math.min(telegramSentiment.signals / 5, 1);

    const totalConfidence = tweetsConfidence + postsConfidence + signalsConfidence;
    const confidence = totalConfidence > 0 ? totalConfidence / 3 : 0;

    return {
      symbol,
      overall,
      telegram: telegramSentiment,
      twitter: twitterSentiment,
      reddit: redditSentiment,
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
      const baseSymbol = symbol.replace(
        SocialIntegrationsService.SYMBOL_NORMALIZE_REGEX,
        ""
      );

      // Query tweets from last 24 hours
      const query = `
        SELECT 
          text,
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

      // Analyze sentiment using the new analyzer
      const sentimentInputs = tweets.map((tweet) => ({
        text: tweet.text,
        weight: Math.log10(Math.max(1, tweet.likes + tweet.retweets)),
        source: "twitter",
      }));

      const sentiment = this.sentimentAnalyzer.analyzeMultiple(sentimentInputs);

      return {
        score: sentiment.score,
        positive: sentiment.positive,
        negative: sentiment.negative,
        neutral: sentiment.neutral,
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

  /**
   * Analyze Reddit sentiment
   */
  private analyzeRedditSentiment(symbol: string): Promise<{
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    posts: number;
  }> {
    if (!this.redditService) {
      return Promise.resolve({
        score: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        posts: 0,
      });
    }

    return this.redditService.analyzeSentiment(symbol);
  }

  /**
   * Scrape Reddit for a symbol
   */
  async scrapeReddit(symbol: string, limit = 25): Promise<number> {
    if (!this.redditService) {
      this.logger.warn("Reddit service not initialized");
      return 0;
    }

    const posts = await this.redditService.searchSymbol(symbol, limit);
    return posts.length;
  }

  /**
   * Monitor Reddit crypto subreddits
   */
  async monitorRedditSubreddits(limit = 10): Promise<number> {
    if (!this.redditService) {
      this.logger.warn("Reddit service not initialized");
      return 0;
    }

    const posts = await this.redditService.monitorSubreddits(limit);
    return posts.length;
  }
}
