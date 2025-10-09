import {
  AICacheService,
  GPTSentimentAnalyzer,
  type NewsAnalysisResult,
  NewsAnalyzer,
  type NewsInput,
  OpenAIClientWrapper,
} from "@aladdin/ai";
import { BaseService } from "@aladdin/service";
import { NewsService } from "./news/service";
import { ScraperQueueManager } from "./queue/scraper-queue-manager";
import type { ScraperJob, ScraperJobResult } from "./queue/types";
import { RedditService } from "./reddit/service";
import { SentimentAnalyzer } from "./sentiment/analyzer";
import { HybridSentimentAnalyzer } from "./sentiment/hybrid-analyzer";

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
  private hybridAnalyzer!: HybridSentimentAnalyzer;
  private redditService!: RedditService;
  private newsService!: NewsService;
  private openAIClient: OpenAIClientWrapper | null = null;
  private aiCache: AICacheService | null = null;
  private gptAnalyzer: GPTSentimentAnalyzer | null = null;
  private newsAnalyzer: NewsAnalyzer | null = null;
  private queueManager!: ScraperQueueManager;

  // Regex patterns (defined at class level for performance)
  private static readonly SYMBOL_NORMALIZE_REGEX = /USDT|BUSD|USD$/i;

  getServiceName(): string {
    return "scraper";
  }

  protected onInitialize(): Promise<void> {
    this.logger.info("Scraper Service initializing...");

    // Initialize sentiment analyzer
    this.sentimentAnalyzer = new SentimentAnalyzer(this.logger);

    // Initialize OpenAI if configured
    const openAIKey = process.env.OPENAI_API_KEY;
    // Если есть ключ, по умолчанию включаем GPT анализ
    const openAIEnabled = openAIKey
      ? process.env.OPENAI_SENTIMENT_ENABLED !== "false"
      : false;
    // Если есть ключ, по умолчанию используем AI для всех текстов
    const sentimentMode = openAIKey
      ? ((process.env.SENTIMENT_MODE || "ai") as "keyword" | "ai" | "hybrid")
      : "keyword";

    if (openAIKey && openAIEnabled) {
      this.logger.info("Initializing OpenAI GPT sentiment analysis", {
        mode: sentimentMode,
      });

      try {
        // Initialize OpenAI client
        this.openAIClient = new OpenAIClientWrapper(
          {
            apiKey: openAIKey,
            model: process.env.OPENAI_MODEL || "gpt-4o",
            maxRetries: 3,
            timeout: 60_000,
            rateLimit: {
              maxRequestsPerHour: Number(
                process.env.AI_MAX_REQUESTS_PER_HOUR || 100
              ),
              maxRequestsPerMinute: Number(
                process.env.AI_MAX_REQUESTS_PER_MINUTE || 10
              ),
            },
          },
          this.logger
        );

        // Initialize AI cache
        const cacheTTLHours = Number(process.env.AI_CACHE_TTL_HOURS || 24);
        this.aiCache = new AICacheService(this.logger, cacheTTLHours);

        // Initialize GPT sentiment analyzer
        this.gptAnalyzer = new GPTSentimentAnalyzer(
          this.openAIClient,
          this.aiCache,
          this.logger,
          {
            maxBatchSize: Number(process.env.AI_MAX_BATCH_SIZE || 10),
            cacheTTL: cacheTTLHours * 3600, // Convert to seconds
          }
        );

        // Initialize News analyzer
        this.newsAnalyzer = new NewsAnalyzer(
          this.openAIClient,
          this.aiCache,
          this.logger
        );

        this.logger.info("OpenAI GPT sentiment analysis initialized", {
          mode: sentimentMode,
          message:
            sentimentMode === "ai"
              ? "All messages will be analyzed with GPT"
              : "Hybrid mode: selective GPT usage",
        });
        this.logger.info("OpenAI News analyzer initialized");
      } catch (error) {
        this.logger.error("Failed to initialize OpenAI", { error });
        this.logger.warn("Falling back to keyword-only sentiment analysis");
      }
    } else {
      this.logger.info("OpenAI not configured, using keyword-only sentiment");
    }

    // Initialize hybrid analyzer (combines keyword and GPT)
    this.hybridAnalyzer = new HybridSentimentAnalyzer(
      this.sentimentAnalyzer,
      this.gptAnalyzer,
      this.logger,
      {
        gptEnabled: openAIEnabled && this.gptAnalyzer !== null,
        forceGPT: sentimentMode === "ai",
        highEngagementThreshold: Number(
          process.env.AI_HIGH_ENGAGEMENT_THRESHOLD || 50
        ),
        lowConfidenceThreshold: Number(
          process.env.AI_LOW_CONFIDENCE_THRESHOLD || 0.3
        ),
      }
    );

    // Initialize Reddit service
    if (this.clickhouse) {
      const redditPostsLimit = Number(process.env.REDDIT_POSTS_LIMIT || 25);
      this.redditService = new RedditService(
        this.clickhouse,
        this.sentimentAnalyzer,
        this.logger,
        redditPostsLimit
      );
    }

    // Initialize News service
    if (this.clickhouse) {
      const newsArticlesLimit = Number(process.env.NEWS_ARTICLES_LIMIT || 20);
      this.newsService = new NewsService(
        this.clickhouse,
        this.newsAnalyzer,
        this.logger,
        {
          articlesLimit: newsArticlesLimit,
        }
      );
    }

    // Initialize Queue Manager
    if (this.natsClient && this.clickhouse) {
      this.queueManager = new ScraperQueueManager(
        this.natsClient,
        this.clickhouse,
        this.logger
      );

      // Register job handlers
      this.registerJobHandlers();
    }

    this.logger.info("Scraper Service initialized successfully");
    return Promise.resolve();
  }

  protected async onStart(): Promise<void> {
    this.logger.info("Starting Scraper Service...");

    // Start queue processing
    if (this.queueManager) {
      await this.queueManager.startProcessing();
      this.logger.info("Queue processing started");

      // Schedule periodic jobs
      await this.schedulePeriodicJobs();
    } else {
      // Fallback to old method if queue manager not available
      this.logger.warn("Queue manager not available, using fallback method");

      // Start periodic Reddit monitoring
      if (this.redditService) {
        const redditInterval = Number(
          process.env.REDDIT_SCRAPE_INTERVAL || 900_000
        );
        this.redditService.startPeriodicMonitoring(redditInterval);
        this.logger.info("Reddit periodic monitoring started (fallback)", {
          intervalMinutes: redditInterval / 60_000,
        });
      }

      // Start periodic news scraping
      if (this.newsService) {
        const newsInterval = Number(
          process.env.NEWS_SCRAPE_INTERVAL || 600_000
        );
        this.newsService.startPeriodicScraping(newsInterval);
        this.logger.info("News periodic scraping started (fallback)", {
          intervalMinutes: newsInterval / 60_000,
        });
      }
    }

    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    this.logger.info("Shutting down Scraper Service");

    // Stop queue processing
    if (this.queueManager) {
      this.queueManager.stopProcessing();
    }

    // Stop periodic monitoring (fallback)
    if (this.redditService) {
      this.redditService.stopPeriodicMonitoring();
    }

    if (this.newsService) {
      this.newsService.stopPeriodicScraping();
    }

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

    const totalConfidence =
      tweetsConfidence + postsConfidence + signalsConfidence;
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

      // Analyze sentiment using hybrid analyzer
      const sentimentInputs = tweets.map((tweet) => ({
        text: tweet.text,
        weight: Math.log10(Math.max(1, tweet.likes + tweet.retweets)),
        source: "twitter" as const,
        engagement: tweet.likes + tweet.retweets,
      }));

      // Use hybrid analyzer for batch analysis
      const hybridResults =
        await this.hybridAnalyzer.analyzeBatch(sentimentInputs);

      // Aggregate results
      let totalScore = 0;
      let totalWeight = 0;
      let positive = 0;
      let negative = 0;
      let neutral = 0;

      for (let i = 0; i < hybridResults.length; i++) {
        const result = hybridResults[i];
        const weight = sentimentInputs[i].weight || 1;

        totalScore += result.sentiment.score * weight;
        totalWeight += weight;
        positive += result.sentiment.positive;
        negative += result.sentiment.negative;
        neutral += result.sentiment.neutral;
      }

      const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;

      this.logger.info("Twitter sentiment analysis completed", {
        symbol,
        tweets: tweets.length,
        score: avgScore,
        gptUsed: hybridResults.filter((r) => r.method === "gpt").length,
        keywordUsed: hybridResults.filter((r) => r.method === "keyword").length,
      });

      // Save to analyzed feed (async, don't wait)
      Promise.all(
        tweets.map(async (tweet, i) => {
          const result = hybridResults[i];
          await this.saveToAnalyzedFeed({
            id: `tweet_${tweet.datetime}_${Math.random().toString(36).substring(7)}`,
            contentType: "tweet",
            source: "twitter",
            text: tweet.text,
            author: tweet.username,
            url: tweet.url,
            symbols: this.extractSymbols(tweet.text),
            publishedAt: new Date(tweet.datetime),
            engagement: tweet.likes + tweet.retweets,
            sentiment: result.sentiment,
            method: result.method as "keyword" | "gpt" | "hybrid",
          });
        })
      ).catch((error) => {
        this.logger.error("Failed to save tweets to feed", { error });
      });

      return {
        score: avgScore,
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

  /**
   * Extract crypto symbols from text
   */
  private extractSymbols(text: string): string[] {
    const symbols = new Set<string>();
    const cryptoSymbols = [
      "BTC",
      "ETH",
      "BNB",
      "SOL",
      "XRP",
      "ADA",
      "DOGE",
      "DOT",
      "MATIC",
      "AVAX",
      "LINK",
      "UNI",
      "ATOM",
      "LTC",
      "ETC",
      "XLM",
      "NEAR",
      "ALGO",
      "FIL",
      "APT",
    ];

    const upperText = text.toUpperCase();
    for (const symbol of cryptoSymbols) {
      if (upperText.includes(symbol)) {
        symbols.add(symbol);
      }
    }

    return Array.from(symbols);
  }

  /**
   * Get AI sentiment analysis statistics
   */
  getAIStats(): {
    enabled: boolean;
    gptAvailable: boolean;
    hybridStats: ReturnType<HybridSentimentAnalyzer["getStats"]> | null;
    gptStats: ReturnType<GPTSentimentAnalyzer["getMetrics"]> | null;
    openAIStats: ReturnType<OpenAIClientWrapper["getStats"]> | null;
    cacheStats: ReturnType<AICacheService["getStats"]> | null;
  } {
    return {
      enabled: this.gptAnalyzer !== null,
      gptAvailable: this.openAIClient !== null,
      hybridStats: this.hybridAnalyzer?.getStats() || null,
      gptStats: this.gptAnalyzer?.getMetrics() || null,
      openAIStats: this.openAIClient?.getStats() || null,
      cacheStats: this.aiCache?.getStats() || null,
    };
  }

  /**
   * Clear AI cache
   */
  clearAICache(): void {
    this.aiCache?.clear();
    this.logger.info("AI cache cleared");
  }

  /**
   * Perform AI cache cleanup (remove expired entries)
   */
  cleanupAICache(): number {
    const removed = this.aiCache?.cleanup() || 0;
    this.logger.info("AI cache cleanup completed", { removed });
    return removed;
  }

  /**
   * Analyze news article with GPT (if enabled)
   */
  async analyzeNews(news: NewsInput): Promise<NewsAnalysisResult | null> {
    if (!this.newsAnalyzer) {
      this.logger.warn("News analyzer not available, OpenAI not configured");
      return null;
    }

    try {
      const result = await this.newsAnalyzer.analyze(news);
      this.logger.info("News analyzed", {
        title: news.title.substring(0, 50),
        sentiment: result.sentimentScore,
        impact: result.marketImpact,
      });
      return result;
    } catch (error) {
      this.logger.error("Failed to analyze news", { error });
      return null;
    }
  }

  /**
   * Analyze multiple news articles
   */
  async analyzeNewsBatch(
    newsItems: NewsInput[]
  ): Promise<NewsAnalysisResult[]> {
    if (!this.newsAnalyzer) {
      this.logger.warn("News analyzer not available, OpenAI not configured");
      return [];
    }

    try {
      const results = await this.newsAnalyzer.analyzeBatch(newsItems);
      this.logger.info("News batch analyzed", {
        count: newsItems.length,
        successful: results.filter((r) => r.confidence > 0).length,
      });
      return results;
    } catch (error) {
      this.logger.error("Failed to analyze news batch", { error });
      return [];
    }
  }

  /**
   * Store news article with AI analysis in ClickHouse
   */
  async storeNewsWithAnalysis(
    news: NewsInput & {
      id: string;
      source: string;
      url: string;
      publishedAt: Date;
      symbols?: string[];
      categories?: string[];
    },
    analysis: NewsAnalysisResult
  ): Promise<void> {
    if (!this.clickhouse) {
      this.logger.warn("ClickHouse not available");
      return;
    }

    try {
      const escapeString = (str: string) =>
        str.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

      const symbolsArray =
        analysis.affectedCoins.length > 0
          ? `[${analysis.affectedCoins.map((s) => `'${s}'`).join(",")}]`
          : "[]";

      const categoriesArray = news.categories
        ? `[${news.categories.map((c) => `'${escapeString(c)}'`).join(",")}]`
        : "[]";

      const keyPointsArray =
        analysis.keyPoints.length > 0
          ? `[${analysis.keyPoints.map((p) => `'${escapeString(p)}'`).join(",")}]`
          : "[]";

      const query = `
        INSERT INTO aladdin.crypto_news (
          id,
          title,
          content,
          summary,
          source,
          url,
          published_at,
          symbols,
          categories,
          ai_sentiment_score,
          ai_market_impact,
          ai_summary,
          ai_key_points,
          ai_affected_coins,
          ai_confidence,
          ai_analyzed_at
        ) VALUES (
          '${escapeString(news.id)}',
          '${escapeString(news.title)}',
          '${escapeString(news.content)}',
          '${escapeString(analysis.summary)}',
          '${escapeString(news.source)}',
          '${escapeString(news.url)}',
          '${news.publishedAt.toISOString()}',
          ${symbolsArray},
          ${categoriesArray},
          ${analysis.sentimentScore},
          '${analysis.marketImpact}',
          '${escapeString(analysis.summary)}',
          ${keyPointsArray},
          ${symbolsArray},
          ${analysis.confidence},
          now()
        )
      `;

      await this.clickhouse.execute(query);

      this.logger.info("News stored with AI analysis", {
        id: news.id,
        title: news.title.substring(0, 50),
        sentiment: analysis.sentimentScore,
      });
    } catch (error) {
      this.logger.error("Failed to store news with analysis", { error });
    }
  }

  /**
   * Get news analyzer metrics
   */
  getNewsAnalyzerMetrics(): ReturnType<NewsAnalyzer["getMetrics"]> | null {
    return this.newsAnalyzer?.getMetrics() || null;
  }

  /**
   * Scrape news from all sources
   */
  async scrapeNews(): Promise<number> {
    if (!this.newsService) {
      this.logger.warn("News service not initialized");
      return 0;
    }

    return await this.newsService.scrapeAllSources();
  }

  /**
   * Scrape news from specific source
   */
  async scrapeNewsSource(sourceName: string): Promise<number> {
    if (!this.newsService) {
      this.logger.warn("News service not initialized");
      return 0;
    }

    return await this.newsService.scrapeSource(sourceName);
  }

  /**
   * Get latest news articles
   */
  async getLatestNews(params: {
    limit?: number;
    source?: string;
    symbol?: string;
  }): Promise<ReturnType<NewsService["getLatestArticles"]>> {
    if (!this.newsService) {
      this.logger.warn("News service not initialized");
      return [];
    }

    return await this.newsService.getLatestArticles(params);
  }

  /**
   * Get news service status
   */
  getNewsStatus(): ReturnType<NewsService["getStatus"]> | null {
    return this.newsService?.getStatus() || null;
  }

  /**
   * Get Reddit service status
   */
  getRedditStatus(): ReturnType<RedditService["getStatus"]> | null {
    return this.redditService?.getStatus() || null;
  }

  /**
   * Register job handlers for queue processing
   */
  private registerJobHandlers(): void {
    if (!this.queueManager) return;

    // Reddit job handler
    this.queueManager.registerHandler(
      "scraper.reddit",
      async (job: ScraperJob): Promise<ScraperJobResult> => {
        const startTime = Date.now();
        try {
          const postsLimit = 25; // Default posts limit
          const result = await this.redditService.monitorSubreddits(postsLimit);

          return {
            jobId: job.id,
            success: true,
            itemsProcessed: result.length,
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
          };
        } catch (error) {
          return {
            jobId: job.id,
            success: false,
            itemsProcessed: 0,
            durationMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          };
        }
      }
    );

    // News job handler
    this.queueManager.registerHandler(
      "scraper.news",
      async (job: ScraperJob): Promise<ScraperJobResult> => {
        const startTime = Date.now();
        try {
          const result = await this.newsService.scrapeAllSources();

          return {
            jobId: job.id,
            success: true,
            itemsProcessed: result,
            durationMs: Date.now() - startTime,
            completedAt: new Date(),
          };
        } catch (error) {
          return {
            jobId: job.id,
            success: false,
            itemsProcessed: 0,
            durationMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          };
        }
      }
    );

    this.logger.info("Job handlers registered");
  }

  /**
   * Schedule periodic jobs for all scrapers
   */
  private async schedulePeriodicJobs(): Promise<void> {
    if (!this.queueManager) return;

    const redditInterval = Number(
      process.env.REDDIT_SCRAPE_INTERVAL || 900_000
    );
    const newsInterval = Number(process.env.NEWS_SCRAPE_INTERVAL || 600_000);

    // Schedule Reddit monitoring
    await this.queueManager.schedulePeriodicJob(
      "scraper.reddit",
      {
        type: "reddit",
        priority: 5,
        data: {},
        maxAttempts: 3,
      },
      redditInterval
    );

    // Schedule News scraping
    await this.queueManager.schedulePeriodicJob(
      "scraper.news",
      {
        type: "news",
        priority: 5,
        data: {},
        maxAttempts: 3,
      },
      newsInterval
    );

    this.logger.info("Periodic jobs scheduled", {
      redditIntervalMs: redditInterval,
      newsIntervalMs: newsInterval,
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    if (!this.queueManager) {
      return null;
    }

    return this.queueManager.getAllQueueStats();
  }

  /**
   * Get specific queue statistics
   */
  getSpecificQueueStats(queueName: string) {
    if (!this.queueManager) {
      return null;
    }

    return this.queueManager.getQueueStats(queueName);
  }

  /**
   * Manually trigger a scraper job
   */
  async triggerScraperJob(
    type: "reddit" | "news",
    data: Record<string, unknown> = {}
  ) {
    if (!this.queueManager) {
      throw new Error("Queue manager not available");
    }

    const job: ScraperJob = {
      id: `manual_${type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      priority: 10, // Higher priority for manual jobs
      data,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
    };

    await this.queueManager.addJob(`scraper.${type}`, job);

    return { jobId: job.id, queued: true };
  }

  /**
   * Save analyzed content to feed (for AI-analyzed texts)
   */
  async saveToAnalyzedFeed(params: {
    id: string;
    contentType: "tweet" | "reddit_post" | "telegram_message" | "news";
    source: string;
    title?: string;
    text: string;
    url?: string;
    author?: string;
    symbols: string[];
    publishedAt: Date;
    engagement: number;
    sentiment: {
      score: number;
      confidence: number;
      positive: number;
      negative: number;
      neutral: number;
      magnitude: number;
    };
    method: "keyword" | "gpt" | "hybrid";
    marketImpact?: string;
    summary?: string;
    keyPoints?: string[];
    affectedCoins?: string[];
  }): Promise<void> {
    if (!this.clickhouse) {
      return;
    }

    try {
      const escapeString = (str: string) =>
        str.replace(/'/g, "\\'").replace(/\\/g, "\\\\");

      const symbolsArray =
        params.symbols.length > 0
          ? `[${params.symbols.map((s) => `'${s}'`).join(",")}]`
          : "[]";

      const keyPointsArray =
        params.keyPoints && params.keyPoints.length > 0
          ? `[${params.keyPoints.map((p) => `'${escapeString(p)}'`).join(",")}]`
          : "[]";

      const affectedCoinsArray =
        params.affectedCoins && params.affectedCoins.length > 0
          ? `[${params.affectedCoins.map((c) => `'${c}'`).join(",")}]`
          : "[]";

      const title = params.title ? `'${escapeString(params.title)}'` : "NULL";
      const url = params.url ? `'${escapeString(params.url)}'` : "NULL";
      const author = params.author
        ? `'${escapeString(params.author)}'`
        : "NULL";
      const marketImpact = params.marketImpact
        ? `'${params.marketImpact}'`
        : "NULL";
      const summary = params.summary
        ? `'${escapeString(params.summary)}'`
        : "NULL";

      const query = `
        INSERT INTO aladdin.ai_analyzed_content (
          id,
          content_type,
          source,
          title,
          text,
          url,
          author,
          symbols,
          published_at,
          engagement,
          ai_sentiment_score,
          ai_confidence,
          ai_method,
          ai_positive,
          ai_negative,
          ai_neutral,
          ai_magnitude,
          ai_market_impact,
          ai_summary,
          ai_key_points,
          ai_affected_coins
        ) VALUES (
          '${escapeString(params.id)}',
          '${params.contentType}',
          '${escapeString(params.source)}',
          ${title},
          '${escapeString(params.text)}',
          ${url},
          ${author},
          ${symbolsArray},
          '${params.publishedAt.toISOString()}',
          ${params.engagement},
          ${params.sentiment.score},
          ${params.sentiment.confidence},
          '${params.method}',
          ${params.sentiment.positive},
          ${params.sentiment.negative},
          ${params.sentiment.neutral},
          ${params.sentiment.magnitude},
          ${marketImpact},
          ${summary},
          ${keyPointsArray},
          ${affectedCoinsArray}
        )
      `;

      await this.clickhouse.execute(query);

      this.logger.debug("Content saved to analyzed feed", {
        id: params.id,
        type: params.contentType,
        method: params.method,
      });
    } catch (error) {
      this.logger.error("Failed to save to analyzed feed", { error });
    }
  }

  /**
   * Get analyzed content feed
   */
  async getAnalyzedFeed(params: {
    limit?: number;
    offset?: number;
    contentType?: string;
    symbol?: string;
    minSentiment?: number;
    maxSentiment?: number;
  }): Promise<
    Array<{
      id: string;
      contentType: string;
      source: string;
      title: string | null;
      text: string;
      url: string | null;
      author: string | null;
      symbols: string[];
      publishedAt: string;
      engagement: number;
      sentiment: {
        score: number;
        confidence: number;
        positive: number;
        negative: number;
        neutral: number;
        magnitude: number;
      };
      method: string;
      marketImpact: string | null;
      summary: string | null;
      keyPoints: string[];
      affectedCoins: string[];
      analyzedAt: string;
    }>
  > {
    if (!this.clickhouse) {
      return [];
    }

    try {
      const limit = params.limit || 50;
      const offset = params.offset || 0;

      let whereClause = "WHERE 1=1";

      if (params.contentType) {
        whereClause += ` AND content_type = '${params.contentType}'`;
      }

      if (params.symbol) {
        whereClause += ` AND has(symbols, '${params.symbol}')`;
      }

      if (params.minSentiment !== undefined) {
        whereClause += ` AND ai_sentiment_score >= ${params.minSentiment}`;
      }

      if (params.maxSentiment !== undefined) {
        whereClause += ` AND ai_sentiment_score <= ${params.maxSentiment}`;
      }

      const query = `
        SELECT
          id,
          content_type as contentType,
          source,
          title,
          text,
          url,
          author,
          symbols,
          published_at as publishedAt,
          engagement,
          ai_sentiment_score as sentimentScore,
          ai_confidence as confidence,
          ai_positive as positive,
          ai_negative as negative,
          ai_neutral as neutral,
          ai_magnitude as magnitude,
          ai_method as method,
          ai_market_impact as marketImpact,
          ai_summary as summary,
          ai_key_points as keyPoints,
          ai_affected_coins as affectedCoins,
          analyzed_at as analyzedAt
        FROM aladdin.ai_analyzed_content
        ${whereClause}
        ORDER BY analyzed_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const results = await this.clickhouse.query<{
        id: string;
        contentType: string;
        source: string;
        title: string | null;
        text: string;
        url: string | null;
        author: string | null;
        symbols: string[];
        publishedAt: string;
        engagement: number;
        sentimentScore: number;
        confidence: number;
        positive: number;
        negative: number;
        neutral: number;
        magnitude: number;
        method: string;
        marketImpact: string | null;
        summary: string | null;
        keyPoints: string[];
        affectedCoins: string[];
        analyzedAt: string;
      }>(query);

      return (results || []).map((row) => ({
        id: row.id,
        contentType: row.contentType,
        source: row.source,
        title: row.title,
        text: row.text,
        url: row.url,
        author: row.author,
        symbols: row.symbols,
        publishedAt: row.publishedAt,
        engagement: row.engagement,
        sentiment: {
          score: row.sentimentScore,
          confidence: row.confidence,
          positive: row.positive,
          negative: row.negative,
          neutral: row.neutral,
          magnitude: row.magnitude,
        },
        method: row.method,
        marketImpact: row.marketImpact,
        summary: row.summary,
        keyPoints: row.keyPoints,
        affectedCoins: row.affectedCoins,
        analyzedAt: row.analyzedAt,
      }));
    } catch (error) {
      this.logger.error("Failed to get analyzed feed", { error });
      return [];
    }
  }
}
