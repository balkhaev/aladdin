import { createSuccessResponse } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import { SocialIntegrationsService } from "./service";
import "dotenv/config";

const DEFAULT_PORT = 3018;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

await initializeService<SocialIntegrationsService>({
  serviceName: "social-integrations",
  port: PORT,

  createService: (deps) =>
    new SocialIntegrationsService({
      logger: deps.logger,
      natsClient: deps.natsClient,
      clickhouse: deps.clickhouse,
      prisma: deps.prisma,
    }),

  setupRoutes: (app) => {
    /**
     * GET /api/social/sentiment/:symbol - Get social sentiment (Telegram + Twitter)
     * This endpoint provides backward compatibility for old sentiment UI
     */
    app.get("/api/social/sentiment/:symbol", (c) => {
      const symbol = c.req.param("symbol");

      // Mock data for now - full implementation requires telega/twity integration
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
          _note:
            "Social integrations (Telegram + Twitter) are not yet fully migrated. Use /api/analytics/sentiment/:symbol for composite sentiment.",
        })
      );
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

      // Mock data for now
      const results = symbols.map((symbol) => ({
        symbol,
        overall: 0,
        telegram: { score: 0, bullish: 0, bearish: 0, signals: 0 },
        twitter: { score: 0, positive: 0, negative: 0, neutral: 0, tweets: 0 },
        confidence: 0,
        timestamp: new Date().toISOString(),
        _note: "Mock data - full social integrations pending migration",
      }));

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

    // TODO: Full telega and twity routes will be migrated here
  },

  dependencies: {
    nats: true,
    clickhouse: true,
    postgres: false,
  },
});
