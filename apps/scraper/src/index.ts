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
            confidence: 0,
            timestamp: new Date().toISOString(),
          })
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
