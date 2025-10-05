import { createClickHouseClient } from "@aladdin/shared/clickhouse";
import { createLogger } from "@aladdin/shared/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { setupMLRoutes } from "./routes";
import { FeatureEngineeringService } from "./services/feature-engineering";
import { MarketRegimeService } from "./services/market-regime";
import { PricePredictionService } from "./services/price-prediction";

const PORT = Number.parseInt(process.env.PORT || "3019", 10);
const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || "http://localhost:8123";

const app = new Hono();
const logger = createLogger({
  service: "ml-service",
  logFile: "logs/ml-service.log",
  errorLogFile: "logs/ml-service-error.log",
});

// Middleware
app.use("*", cors());
app.use("*", honoLogger());

// Initialize services
function initializeServices() {
  try {
    logger.info("Initializing ML Service...");

    // ClickHouse client
    const clickhouse = createClickHouseClient({
      url: CLICKHOUSE_URL,
      database: "crypto",
    });

    // Create service instances
    const featureService = new FeatureEngineeringService(clickhouse, logger);
    const regimeService = new MarketRegimeService(clickhouse, logger);
    const predictionService = new PricePredictionService(
      clickhouse,
      featureService,
      regimeService,
      logger
    );

    // Setup routes
    setupMLRoutes(app, predictionService, regimeService);

    logger.info("ML Service initialized successfully");

    return { featureService, regimeService, predictionService };
  } catch (error) {
    logger.error("Failed to initialize ML Service", error);
    throw error;
  }
}

// Start server
function start() {
  try {
    initializeServices();

    const server = Bun.serve<never>({
      port: PORT,
      fetch: app.fetch,
    });

    logger.info(`🤖 ML Service running on port ${server.port}`);
    logger.info("Available endpoints:");
    logger.info("  POST /api/ml/predict - Price prediction");
    logger.info("  POST /api/ml/predict/batch - Batch predictions");
    logger.info("  POST /api/ml/regime - Market regime detection");
    logger.info("  GET /api/ml/health - Health check");
  } catch (error) {
    logger.error("Failed to start ML Service", error);
    process.exit(1);
  }
}

start();
