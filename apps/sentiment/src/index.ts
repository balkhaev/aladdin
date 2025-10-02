import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import { SentimentAggregator } from "./services/sentiment-aggregator";
import "dotenv/config";

const DEFAULT_PORT = 3018;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

await initializeService<SentimentAggregator>({
  serviceName: "sentiment",
  port: PORT,

  createService: (deps) => new SentimentAggregator(deps),

  setupRoutes: (app, service) => {
    /**
     * GET /api/sentiment/debug - Debug info about internal state
     * ВАЖНО: должен быть ДО роута с :symbol параметром
     */
    app.get("/api/sentiment/debug", async (c) => {
      const debugInfo = service.getDebugInfo();
      return c.json(createSuccessResponse(debugInfo));
    });

    /**
     * POST /api/sentiment/reload-history - Reload Telegram history manually
     */
    app.post("/api/sentiment/reload-history", async (c) => {
      try {
        const result = await service.reloadTelegramHistory();
        return c.json(createSuccessResponse(result));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "RELOAD_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/sentiment/:symbol - Get sentiment analysis for a symbol
     */
    app.get("/api/sentiment/:symbol", async (c) => {
      const { symbol } = c.req.param();

      try {
        const analysis = await service.analyzeSentiment(symbol.toUpperCase());

        return c.json(createSuccessResponse(analysis));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "SENTIMENT_ANALYSIS_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/sentiment/:symbol/history - Get sentiment history for a symbol
     */
    app.get("/api/sentiment/:symbol/history", async (c) => {
      const { symbol } = c.req.param();

      const history = service.getSentimentHistory(symbol.toUpperCase());

      return c.json(
        createSuccessResponse({
          symbol: symbol.toUpperCase(),
          history,
          count: history.length,
        })
      );
    });

    /**
     * GET /api/sentiment/services/health - Check health of external services
     */
    app.get("/api/sentiment/services/health", async (c) => {
      const health = await service.checkExternalServices();

      return c.json(
        createSuccessResponse({
          services: health,
          allHealthy: health.telegram && health.twitter,
        })
      );
    });

    /**
     * POST /api/sentiment/analyze-batch - Analyze sentiment for multiple symbols
     */
    app.post("/api/sentiment/analyze-batch", async (c) => {
      try {
        const body = await c.req.json<{ symbols: string[] }>();

        if (!(body.symbols && Array.isArray(body.symbols))) {
          return c.json(
            {
              success: false,
              error: {
                code: "INVALID_REQUEST",
                message: "symbols array is required",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.BAD_REQUEST
          );
        }

        // Limit to 10 symbols per request
        const symbols = body.symbols.slice(0, 10);

        const analyses = await Promise.all(
          symbols.map((symbol) =>
            service.analyzeSentiment(symbol.toUpperCase())
          )
        );

        return c.json(
          createSuccessResponse({
            analyses,
            count: analyses.length,
          })
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "BATCH_ANALYSIS_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });
  },

  dependencies: {
    nats: true,
    postgres: false,
    clickhouse: false,
  },
});
