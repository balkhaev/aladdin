import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import { ScreenerService } from "./services/screener";
import "dotenv/config";

// Server configuration
const DEFAULT_PORT = 3017;
const DEFAULT_RESULTS_LIMIT = 100;
const DEFAULT_SIGNALS_LIMIT = 20;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const VALID_RECOMMENDATIONS = [
  "STRONG_BUY",
  "BUY",
  "SELL",
  "STRONG_SELL",
] as const;

await initializeService<ScreenerService>({
  serviceName: "screener",
  port: PORT,

  createService: (deps) =>
    new ScreenerService({ ...deps, redisUrl: REDIS_URL }),

  setupRoutes: (app, service) => {
    /**
     * POST /api/screener/run - Run screening manually
     */
    app.post("/api/screener/run", async (c) => {
      const body = await c.req.json<{ timeframe?: string }>();
      const timeframe = body.timeframe ?? "15m";

      const result = await service.runScreening(timeframe);

      return c.json(createSuccessResponse(result));
    });

    /**
     * GET /api/screener/results - Get screening results
     */
    app.get("/api/screener/results", async (c) => {
      const limit = Number(
        c.req.query("limit") ?? String(DEFAULT_RESULTS_LIMIT)
      );
      const results = await service.getResults(limit);

      return c.json(
        createSuccessResponse({
          results,
          count: results.length,
        })
      );
    });

    /**
     * GET /api/screener/signals/:recommendation - Get top signals
     */
    app.get("/api/screener/signals/:recommendation", async (c) => {
      const { recommendation } = c.req.param();
      const limit = Number(
        c.req.query("limit") ?? String(DEFAULT_SIGNALS_LIMIT)
      );

      if (
        !VALID_RECOMMENDATIONS.includes(
          recommendation as (typeof VALID_RECOMMENDATIONS)[number]
        )
      ) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_RECOMMENDATION",
              message: `Recommendation must be one of: ${VALID_RECOMMENDATIONS.join(", ")}`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const results = await service.getTopSignals(
        recommendation as "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL",
        limit
      );

      return c.json(
        createSuccessResponse({
          recommendation,
          results,
          count: results.length,
        })
      );
    });

    /**
     * GET /api/screener/stats - Get queue statistics
     */
    app.get("/api/screener/stats", async (c) => {
      const stats = await service.getStats();

      return c.json(createSuccessResponse(stats));
    });

    /**
     * DELETE /api/screener/queue - Clear queue
     */
    app.delete("/api/screener/queue", async (c) => {
      await service.clearQueue();

      return c.json(createSuccessResponse({ message: "Queue cleared" }));
    });
  },

  dependencies: {
    nats: false,
    postgres: false,
    clickhouse: false,
  },
});
