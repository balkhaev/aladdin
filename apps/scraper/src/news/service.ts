import type { NewsAnalysisResult, NewsAnalyzer } from "@aladdin/ai";
import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import { CoinDeskSource } from "./sources/coindesk";
import type { NewsArticle, NewsSource } from "./types";

const DEFAULT_SCRAPE_INTERVAL_MS = 600_000; // 10 minutes
const DEFAULT_ARTICLES_LIMIT = 20;
const MS_PER_MINUTE = 60_000;

/**
 * News Service
 * Manages periodic scraping of crypto news from multiple sources
 */
export class NewsService {
  private scrapeInterval: NodeJS.Timeout | null = null;
  private sources: Map<string, NewsSource>;
  private articlesLimit: number;
  private isRunning = false;

  constructor(
    private readonly clickhouse: ClickHouseClient,
    private readonly newsAnalyzer: NewsAnalyzer | null,
    private readonly logger: Logger,
    options?: {
      articlesLimit?: number;
    }
  ) {
    this.articlesLimit = options?.articlesLimit || DEFAULT_ARTICLES_LIMIT;
    this.sources = new Map();

    // Initialize sources
    this.registerSource(new CoinDeskSource(logger));

    this.logger.info("NewsService initialized", {
      sources: Array.from(this.sources.keys()),
      articlesLimit: this.articlesLimit,
    });
  }

  /**
   * Register a news source
   */
  registerSource(source: NewsSource): void {
    this.sources.set(source.name, source);
    this.logger.info("News source registered", {
      source: source.name,
      enabled: source.enabled,
    });
  }

  /**
   * Start periodic scraping of all sources
   */
  startPeriodicScraping(intervalMs?: number): void {
    const interval = intervalMs || DEFAULT_SCRAPE_INTERVAL_MS;

    if (this.scrapeInterval) {
      this.logger.warn("Periodic scraping already running");
      return;
    }

    this.logger.info("Starting periodic news scraping", {
      intervalMinutes: interval / MS_PER_MINUTE,
      sources: Array.from(this.sources.keys()),
    });

    // Run immediately
    this.scrapeAllSources().catch((error) => {
      this.logger.error("Initial news scrape failed", { error });
    });

    // Then run periodically
    this.scrapeInterval = setInterval(() => {
      this.scrapeAllSources().catch((error) => {
        this.logger.error("Periodic news scrape failed", { error });
      });
    }, interval);

    this.isRunning = true;
  }

  /**
   * Stop periodic scraping
   */
  stopPeriodicScraping(): void {
    if (this.scrapeInterval) {
      clearInterval(this.scrapeInterval);
      this.scrapeInterval = null;
      this.isRunning = false;
      this.logger.info("Periodic news scraping stopped");
    }
  }

  /**
   * Scrape all enabled sources
   */
  async scrapeAllSources(): Promise<number> {
    this.logger.info("Scraping all news sources", {
      sources: Array.from(this.sources.keys()),
    });

    let totalArticles = 0;

    for (const [sourceName, source] of this.sources) {
      if (!source.enabled) {
        this.logger.debug("Skipping disabled source", { source: sourceName });
        continue;
      }

      try {
        const count = await this.scrapeSource(sourceName);
        totalArticles += count;
      } catch (error) {
        this.logger.error("Failed to scrape source", {
          source: sourceName,
          error,
        });
      }
    }

    this.logger.info("Completed scraping all sources", {
      totalArticles,
    });

    return totalArticles;
  }

  /**
   * Scrape specific news source
   */
  async scrapeSource(sourceName: string): Promise<number> {
    const source = this.sources.get(sourceName);
    if (!source) {
      this.logger.error("News source not found", { source: sourceName });
      return 0;
    }

    this.logger.info("Scraping news source", {
      source: sourceName,
      limit: this.articlesLimit,
    });

    try {
      const articles = await source.scrape(this.articlesLimit);

      this.logger.info("News source scraped successfully", {
        source: sourceName,
        articles: articles.length,
      });

      // Store articles in ClickHouse
      if (articles.length > 0) {
        await this.storeArticles(articles);
      }

      // Analyze articles with AI if available
      if (this.newsAnalyzer && articles.length > 0) {
        await this.analyzeArticles(articles);
      }

      return articles.length;
    } catch (error) {
      this.logger.error("Failed to scrape news source", {
        source: sourceName,
        error,
      });
      return 0;
    }
  }

  /**
   * Store articles in ClickHouse
   */
  private async storeArticles(articles: NewsArticle[]): Promise<void> {
    try {
      const escapeString = (str: string) =>
        str
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r");

      const values = articles.map((article) => {
        const symbolsArray =
          article.symbols.length > 0
            ? `[${article.symbols.map((s) => `'${s}'`).join(",")}]`
            : "[]";

        const categoriesArray =
          article.categories.length > 0
            ? `[${article.categories.map((c) => `'${escapeString(c)}'`).join(",")}]`
            : "[]";

        const author = article.author
          ? `'${escapeString(article.author)}'`
          : "NULL";
        const summary = article.summary
          ? `'${escapeString(article.summary)}'`
          : "NULL";

        return `(
          '${escapeString(article.id)}',
          '${escapeString(article.title)}',
          '${escapeString(article.content)}',
          ${summary},
          '${escapeString(article.source)}',
          ${author},
          '${escapeString(article.url)}',
          '${article.publishedAt.toISOString()}',
          ${symbolsArray},
          ${categoriesArray}
        )`;
      });

      const query = `
        INSERT INTO aladdin.crypto_news (
          id,
          title,
          content,
          summary,
          source,
          author,
          url,
          published_at,
          symbols,
          categories
        ) VALUES ${values.join(",")}
      `;

      await this.clickhouse.execute(query);

      this.logger.info("Stored articles in ClickHouse", {
        count: articles.length,
      });
    } catch (error) {
      this.logger.error("Failed to store articles", { error });
      throw error;
    }
  }

  /**
   * Analyze articles with AI
   */
  private async analyzeArticles(articles: NewsArticle[]): Promise<void> {
    if (!this.newsAnalyzer) {
      return;
    }

    this.logger.info("Analyzing articles with AI", {
      count: articles.length,
    });

    let analyzed = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        const analysis = await this.newsAnalyzer.analyze({
          title: article.title,
          content: article.content,
          source: article.source,
          publishedAt: article.publishedAt,
        });

        // Update article in ClickHouse with AI analysis
        await this.updateArticleWithAnalysis(article, analysis);
        analyzed++;

        this.logger.debug("Article analyzed", {
          title: article.title.substring(0, 50),
          sentiment: analysis.sentimentScore,
          impact: analysis.marketImpact,
        });
      } catch (error) {
        failed++;
        this.logger.error("Failed to analyze article", {
          title: article.title.substring(0, 50),
          error,
        });
      }
    }

    this.logger.info("Article analysis completed", {
      analyzed,
      failed,
      total: articles.length,
    });
  }

  /**
   * Update article with AI analysis results
   */
  private async updateArticleWithAnalysis(
    article: NewsArticle,
    analysis: NewsAnalysisResult
  ): Promise<void> {
    try {
      const escapeString = (str: string) =>
        str
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r");

      const keyPointsArray =
        analysis.keyPoints.length > 0
          ? `[${analysis.keyPoints.map((p) => `'${escapeString(p)}'`).join(",")}]`
          : "[]";

      const affectedCoinsArray =
        analysis.affectedCoins.length > 0
          ? `[${analysis.affectedCoins.map((c) => `'${c}'`).join(",")}]`
          : "[]";

      const query = `
        ALTER TABLE aladdin.crypto_news
        UPDATE
          ai_sentiment_score = ${analysis.sentimentScore},
          ai_market_impact = '${analysis.marketImpact}',
          ai_summary = '${escapeString(analysis.summary)}',
          ai_key_points = ${keyPointsArray},
          ai_affected_coins = ${affectedCoinsArray},
          ai_confidence = ${analysis.confidence},
          ai_analyzed_at = now()
        WHERE id = '${escapeString(article.id)}'
      `;

      await this.clickhouse.execute(query);
    } catch (error) {
      this.logger.error("Failed to update article with analysis", {
        id: article.id,
        error,
      });
    }
  }

  /**
   * Get latest articles from ClickHouse
   */
  async getLatestArticles(params: {
    limit?: number;
    source?: string;
    symbol?: string;
  }): Promise<NewsArticle[]> {
    const limit = params.limit || 50;
    let whereClause = "WHERE 1=1";

    if (params.source) {
      whereClause += ` AND source = '${params.source}'`;
    }

    if (params.symbol) {
      whereClause += ` AND has(symbols, '${params.symbol}')`;
    }

    const query = `
      SELECT
        id,
        title,
        content,
        summary,
        source,
        author,
        url,
        published_at as publishedAt,
        scraped_at as scrapedAt,
        symbols,
        categories
      FROM aladdin.crypto_news
      ${whereClause}
      ORDER BY published_at DESC
      LIMIT ${limit}
    `;

    const results = await this.clickhouse.query<{
      id: string;
      title: string;
      content: string;
      summary: string | null;
      source: string;
      author: string | null;
      url: string;
      publishedAt: string;
      scrapedAt: string;
      symbols: string[];
      categories: string[];
    }>(query);

    return (results || []).map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      summary: row.summary || undefined,
      source: row.source,
      author: row.author || undefined,
      url: row.url,
      publishedAt: new Date(row.publishedAt),
      scrapedAt: new Date(row.scrapedAt),
      symbols: row.symbols,
      categories: row.categories,
    }));
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    sources: Array<{ name: string; enabled: boolean }>;
    articlesLimit: number;
  } {
    return {
      running: this.isRunning,
      sources: Array.from(this.sources.values()).map((source) => ({
        name: source.name,
        enabled: source.enabled,
      })),
      articlesLimit: this.articlesLimit,
    };
  }
}
