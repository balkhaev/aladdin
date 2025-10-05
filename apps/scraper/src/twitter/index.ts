import { initializeService } from "@aladdin/service/bootstrap";
import type { Context } from "hono";
import { TwityService } from "./service";

const DEFAULT_PORT = 8000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ERROR_STATUS_CODE = 500;

await initializeService<TwityService>({
  serviceName: "twity",
  port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : DEFAULT_PORT,
  idleTimeout: 120, // 2 minutes for Twitter scraping operations

  // Twity не использует базы данных, только Puppeteer
  dependencies: {
    postgres: false,
    nats: false,
    clickhouse: false,
  },

  createService: (deps) => new TwityService(deps),

  setupRoutes: (app, service, deps) => {
    // GET /twitter/user/:username - твиты пользователя (manual scraping)
    app.get("/twitter/user/:username", async (c: Context) => {
      try {
        const username = c.req.param("username");
        const limitParam = c.req.query("limit");

        const limit = Math.min(
          Number.parseInt(limitParam || String(DEFAULT_LIMIT), 10),
          MAX_LIMIT
        );

        const tweets = await service.getUserTweets(username, limit);
        return c.json(tweets);
      } catch (error) {
        deps.logger.error("Failed to fetch user tweets", error);
        return c.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Failed to scrape user tweets",
          },
          ERROR_STATUS_CODE
        );
      }
    });

    // GET /twitter/status - scraping status
    app.get("/twitter/status", (c: Context) =>
      c.json({
        message:
          "Twitter scraper running. Data is automatically collected every 10 minutes and stored in ClickHouse.",
        influencers: 15,
        interval: "10 minutes",
      })
    );
  },
});
