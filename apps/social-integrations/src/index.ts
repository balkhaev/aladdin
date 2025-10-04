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

    // Additional routes from telega and twity would be integrated here
    // This is a simplified version for the refactoring
  },

  dependencies: {
    nats: true,
    clickhouse: true,
    postgres: false,
  },
});
