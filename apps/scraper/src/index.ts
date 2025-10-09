import { createSuccessResponse } from "@aladdin/http/responses";
import { initializeService } from "@aladdin/service/bootstrap";
import { SocialIntegrationsService } from "./service";
import "dotenv/config";

const DEFAULT_PORT = 3018;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

await initializeService<SocialIntegrationsService>({
  serviceName: "scraper",
  port: PORT,

  createService: (deps) =>
    new SocialIntegrationsService({
      logger: deps.logger,
      natsClient: deps.natsClient,
      clickhouse: deps.clickhouse,
      prisma: deps.prisma,
    }),

  setupRoutes: (app, service) => {
    /**
     * GET /api/social/sentiment/:symbol - Get social sentiment (Telegram + Twitter)
     * This endpoint provides backward compatibility for old sentiment UI
     */
    app.get("/api/social/sentiment/:symbol", async (c) => {
      const symbol = c.req.param("symbol");

      try {
        // Get Twitter sentiment from ClickHouse
        const sentiment = await service.analyzeSocialSentiment(symbol);

        return c.json(createSuccessResponse(sentiment));
      } catch (error) {
        service.logger.error("Failed to analyze social sentiment", {
          symbol,
          error,
        });

        // Return neutral sentiment on error
        return c.json(
          createSuccessResponse({
            symbol,
            overall: 0,
            telegram: {
              score: 0,
              bullish: 0,
              bearish: 0,
              signals: 0,
            },
            twitter: {
              score: 0,
              positive: 0,
              negative: 0,
              neutral: 0,
              tweets: 0,
            },
            reddit: {
              score: 0,
              positive: 0,
              negative: 0,
              neutral: 0,
              posts: 0,
            },
            confidence: 0,
            timestamp: new Date().toISOString(),
          })
        );
      }
    });

    /**
     * GET /api/social/sentiment/:symbol/history - Get social sentiment history
     */
    app.get("/api/social/sentiment/:symbol/history", (c) => {
      const symbol = c.req.param("symbol");
      const days = Number(c.req.query("days") || "7");

      try {
        // For now, return empty history since we don't have historical data yet
        // TODO: Implement proper historical sentiment tracking
        return c.json(
          createSuccessResponse({
            symbol,
            history: [],
            days,
            message: "Historical sentiment tracking will be implemented soon",
          })
        );
      } catch (error) {
        service.logger.error("Failed to get sentiment history", {
          symbol,
          error,
        });

        return c.json(
          {
            success: false,
            error: {
              code: "HISTORY_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    /**
     * POST /api/social/sentiment/analyze-batch - Batch social sentiment
     */
    app.post("/api/social/sentiment/analyze-batch", async (c) => {
      const body = await c.req.json();
      const symbols = body.symbols as string[];

      if (!(symbols && Array.isArray(symbols)) || symbols.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "symbols array is required and must not be empty",
            },
          },
          400
        );
      }

      // Analyze sentiment for each symbol in parallel
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            return await service.analyzeSocialSentiment(symbol);
          } catch (error) {
            service.logger.error("Failed to analyze sentiment", {
              symbol,
              error,
            });
            return {
              symbol,
              overall: 0,
              telegram: { score: 0, bullish: 0, bearish: 0, signals: 0 },
              twitter: {
                score: 0,
                positive: 0,
                negative: 0,
                neutral: 0,
                tweets: 0,
              },
              reddit: {
                score: 0,
                positive: 0,
                negative: 0,
                neutral: 0,
                posts: 0,
              },
              confidence: 0,
              timestamp: new Date().toISOString(),
            };
          }
        })
      );

      return c.json(createSuccessResponse(results));
    });

    /**
     * Telegram routes (from telega service)
     */
    app.get("/api/social/telegram/health", (c) =>
      c.json(createSuccessResponse({ status: "ok", service: "telegram" }))
    );

    /**
     * Twitter routes (from twity service)
     */
    app.get("/api/social/twitter/health", (c) =>
      c.json(createSuccessResponse({ status: "ok", service: "twitter" }))
    );

    /**
     * Reddit routes
     */
    app.get("/api/social/reddit/health", (c) =>
      c.json(createSuccessResponse({ status: "ok", service: "reddit" }))
    );

    /**
     * POST /api/social/reddit/scrape - Scrape Reddit for a symbol
     */
    app.post("/api/social/reddit/scrape", async (c) => {
      const body = await c.req.json();
      const symbol = body.symbol as string;
      const limit = (body.limit as number) || 25;

      if (!symbol) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "symbol is required",
            },
          },
          400
        );
      }

      try {
        const postsCount = await service.scrapeReddit(symbol, limit);
        return c.json(
          createSuccessResponse({
            symbol,
            postsScraped: postsCount,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        service.logger.error("Failed to scrape Reddit", { symbol, error });
        return c.json(
          {
            success: false,
            error: {
              code: "SCRAPE_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    /**
     * POST /api/social/reddit/monitor - Monitor crypto subreddits
     */
    app.post("/api/social/reddit/monitor", async (c) => {
      const body = await c.req.json();
      const limit = (body.limit as number) || 10;

      try {
        const postsCount = await service.monitorRedditSubreddits(limit);
        return c.json(
          createSuccessResponse({
            postsScraped: postsCount,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        service.logger.error("Failed to monitor Reddit", { error });
        return c.json(
          {
            success: false,
            error: {
              code: "MONITOR_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    /**
     * GET /api/social/ai/stats - Get AI sentiment analysis statistics
     */
    app.get("/api/social/ai/stats", (c) => {
      const stats = service.getAIStats();
      return c.json(createSuccessResponse(stats));
    });

    /**
     * POST /api/social/ai/cache/clear - Clear AI cache
     */
    app.post("/api/social/ai/cache/clear", (c) => {
      service.clearAICache();
      return c.json(
        createSuccessResponse({
          message: "AI cache cleared",
          timestamp: new Date().toISOString(),
        })
      );
    });

    /**
     * POST /api/social/ai/cache/cleanup - Cleanup expired AI cache entries
     */
    app.post("/api/social/ai/cache/cleanup", (c) => {
      const removed = service.cleanupAICache();
      return c.json(
        createSuccessResponse({
          removed,
          message: `Removed ${removed} expired entries`,
          timestamp: new Date().toISOString(),
        })
      );
    });

    /**
     * News routes
     */
    app.get("/api/social/news/health", (c) =>
      c.json(createSuccessResponse({ status: "ok", service: "news" }))
    );

    /**
     * POST /api/social/news/scrape - Manually trigger news scraping
     */
    app.post("/api/social/news/scrape", async (c) => {
      const body = await c.req.json().catch(() => ({}));
      const source = body.source as string | undefined;

      try {
        let articlesScraped: number;

        if (source) {
          // Scrape specific source
          articlesScraped = await service.scrapeNewsSource(source);
        } else {
          // Scrape all sources
          articlesScraped = await service.scrapeNews();
        }

        return c.json(
          createSuccessResponse({
            articlesScraped,
            source: source || "all",
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        service.logger.error("Failed to scrape news", { source, error });
        return c.json(
          {
            success: false,
            error: {
              code: "SCRAPE_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    /**
     * GET /api/social/news/latest - Get latest news articles
     */
    app.get("/api/social/news/latest", async (c) => {
      const limit = Number(c.req.query("limit") || 50);
      const source = c.req.query("source");
      const symbol = c.req.query("symbol");

      try {
        const articles = await service.getLatestNews({
          limit,
          source,
          symbol,
        });

        return c.json(
          createSuccessResponse({
            articles,
            count: articles.length,
            limit,
          })
        );
      } catch (error) {
        service.logger.error("Failed to get latest news", { error });
        return c.json(
          {
            success: false,
            error: {
              code: "FETCH_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    /**
     * GET /api/social/news/status - Get news service status
     */
    app.get("/api/social/news/status", (c) => {
      const status = service.getNewsStatus();
      return c.json(createSuccessResponse(status));
    });

    /**
     * GET /api/social/reddit/status - Get Reddit service status
     */
    app.get("/api/social/reddit/status", (c) => {
      const status = service.getRedditStatus();
      return c.json(createSuccessResponse(status));
    });

    /**
     * Queue Management Routes
     */

    /**
     * GET /api/social/queues/stats - Get all queue statistics
     */
    app.get("/api/social/queues/stats", (c) => {
      const stats = service.getQueueStats();
      return c.json(createSuccessResponse(stats));
    });

    /**
     * GET /api/social/queues/:queueName/stats - Get specific queue statistics
     */
    app.get("/api/social/queues/:queueName/stats", (c) => {
      const queueName = c.req.param("queueName");
      const stats = service.getSpecificQueueStats(`scraper.${queueName}`);

      if (!stats) {
        return c.json(
          {
            success: false,
            error: {
              code: "QUEUE_NOT_FOUND",
              message: `Queue ${queueName} not found`,
            },
          },
          404
        );
      }

      return c.json(createSuccessResponse(stats));
    });

    /**
     * POST /api/social/queues/trigger - Manually trigger a scraper job
     */
    app.post("/api/social/queues/trigger", async (c) => {
      const body = await c.req.json();
      const type = body.type as "reddit" | "news";
      const data = (body.data as Record<string, unknown>) || {};

      const validTypes = ["reddit", "news"];
      const isValidType = type && validTypes.includes(type);

      if (!isValidType) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "type is required and must be 'reddit' or 'news'",
            },
          },
          400
        );
      }

      try {
        const result = await service.triggerScraperJob(type, data);
        return c.json(createSuccessResponse(result));
      } catch (error) {
        service.logger.error("Failed to trigger scraper job", { type, error });
        return c.json(
          {
            success: false,
            error: {
              code: "TRIGGER_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    /**
     * GET /api/social/scrapers/overview - Get overview of all scrapers
     */
    app.get("/api/social/scrapers/overview", (c) => {
      const overview = {
        queues: service.getQueueStats(),
        reddit: service.getRedditStatus(),
        news: service.getNewsStatus(),
        timestamp: new Date().toISOString(),
      };

      return c.json(createSuccessResponse(overview));
    });

    /**
     * GET /api/social/feed - Get AI analyzed content feed
     */
    app.get("/api/social/feed", async (c) => {
      const limit = Number(c.req.query("limit") || 50);
      const offset = Number(c.req.query("offset") || 0);
      const contentType = c.req.query("contentType");
      const symbol = c.req.query("symbol");
      const minSentiment = c.req.query("minSentiment")
        ? Number(c.req.query("minSentiment"))
        : undefined;
      const maxSentiment = c.req.query("maxSentiment")
        ? Number(c.req.query("maxSentiment"))
        : undefined;

      try {
        const feed = await service.getAnalyzedFeed({
          limit,
          offset,
          contentType,
          symbol,
          minSentiment,
          maxSentiment,
        });

        return c.json(
          createSuccessResponse({
            items: feed,
            count: feed.length,
            limit,
            offset,
          })
        );
      } catch (error) {
        service.logger.error("Failed to get analyzed feed", { error });
        return c.json(
          {
            success: false,
            error: {
              code: "FEED_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          },
          500
        );
      }
    });

    // TODO: Full telega and twity routes will be migrated here
  },

  dependencies: {
    nats: true,
    clickhouse: true,
    postgres: false,
  },
});
