/**
 * Analytics Service Entry Point
 * Минимальный bootstrap файл
 */

import { initializeService } from "@aladdin/shared/service-bootstrap";
import { config } from "./config";
import { setupAnalyticsRoutes } from "./routes";
import { AnalyticsService } from "./services/analytics";
import { CombinedSentimentService } from "./services/sentiment/combined-sentiment";
import { SentimentAnalysisService } from "./services/sentiment/sentiment-analysis";
import "dotenv/config";

// Services будут инициализированы в beforeInit
let sentimentService: SentimentAnalysisService | undefined;
let combinedSentimentService: CombinedSentimentService | undefined;

await initializeService({
  serviceName: "analytics",
  port: config.PORT,

  dependencies: {
    clickhouse: true,
    nats: false,
    postgres: false,
  },

  createService: (deps) =>
    new AnalyticsService({
      ...deps,
      enableCache: true, // Enable cache через BaseService
      enableServiceClient: true, // Enable service client через BaseService
    }),

  beforeInit: (deps) => {
    // Initialize Sentiment Analysis service
    if (deps.clickhouse) {
      sentimentService = new SentimentAnalysisService(
        deps.clickhouse,
        deps.logger
      );
      deps.logger.info("Sentiment Analysis service initialized");

      // Initialize Combined Sentiment service
      combinedSentimentService = new CombinedSentimentService(
        deps.logger,
        `http://localhost:${config.PORT}`, // Analytics base URL (self)
        config.MARKET_DATA_BASE_URL,
        config.SCRAPER_URL
      );

      // Inject SentimentAnalysisService to avoid circular dependency
      if (sentimentService) {
        combinedSentimentService.setSentimentService(sentimentService);
      }

      deps.logger.info("Combined Sentiment service initialized");
    }
  },

  setupRoutes: (app, service) => {
    // Get cache service from BaseService
    const cache = service.hasCacheService()
      ? service.getCache("analytics:", 60)
      : undefined;

    // Setup all routes through route modules
    setupAnalyticsRoutes(
      app,
      service,
      sentimentService,
      combinedSentimentService,
      cache
    );
  },

  afterInit: (_service, deps) => {
    deps.logger.info("✅ Analytics service fully initialized");
    deps.logger.info("Available endpoints:");
    deps.logger.info("  - GET  /api/analytics/indicators/:symbol");
    deps.logger.info("  - GET  /api/analytics/statistics");
    deps.logger.info("  - GET  /api/analytics/market-overview");
    deps.logger.info("  - GET  /api/analytics/portfolio/:id/advanced-metrics");
    deps.logger.info("  - GET  /api/analytics/portfolio/:id/summary");
    deps.logger.info("  - GET  /api/analytics/sentiment/:symbol");
    deps.logger.info("  - GET  /api/analytics/sentiment/batch");
    deps.logger.info("  - GET  /api/analytics/sentiment/:symbol/combined");
    deps.logger.info("  - GET  /api/analytics/sentiment/batch/combined");
    deps.logger.info("  - GET  /api/analytics/social-sentiment/:symbol");
    deps.logger.info("  - POST /api/analytics/sentiment/analyze-batch");
    deps.logger.info("  - POST /api/analytics/backtest");
    deps.logger.info("  - GET  /api/analytics/reports");
    deps.logger.info("  - GET  /api/analytics/cache/stats");
    deps.logger.info("  - POST /api/analytics/cache/flush");
  },
});
