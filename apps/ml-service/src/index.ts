import { createClickHouseClient } from "@aladdin/shared/clickhouse";
import { createLogger } from "@aladdin/shared/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { setupMLRoutes } from "./routes";
import { BacktestingService } from "./services/backtesting";
import { FeatureEngineeringService } from "./services/feature-engineering";
import { LSTMPredictionService } from "./services/lstm-prediction";
import { MarketRegimeService } from "./services/market-regime";
import { ModelPersistenceService } from "./services/model-persistence";
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
    const lstmService = new LSTMPredictionService(
      clickhouse,
      featureService,
      logger
    );
    const persistenceService = new ModelPersistenceService(logger);
    const backtestingService = new BacktestingService(
      clickhouse,
      lstmService,
      predictionService,
      featureService,
      logger
    );

    // Setup routes
    setupMLRoutes(
      app,
      predictionService,
      regimeService,
      lstmService,
      persistenceService,
      backtestingService
    );

    logger.info("ML Service initialized successfully");

    return {
      featureService,
      regimeService,
      predictionService,
      lstmService,
      persistenceService,
    };
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
    logger.info("  POST /api/ml/predict - Price prediction (Hybrid)");
    logger.info("  POST /api/ml/predict/lstm - Price prediction (LSTM)");
    logger.info("  POST /api/ml/predict/batch - Batch predictions");
    logger.info("  POST /api/ml/regime - Market regime detection");
    logger.info("  POST /api/ml/backtest - Run backtest");
    logger.info("  POST /api/ml/backtest/compare - Compare models");
    logger.info("  GET /api/ml/models - List saved models");
    logger.info("  GET /api/ml/models/:symbol/stats - Model statistics");
    logger.info("  DELETE /api/ml/models/:symbol - Delete model");
    logger.info("  POST /api/ml/models/cleanup - Cleanup old models");
    logger.info("  GET /api/ml/health - Health check");
  } catch (error) {
    logger.error("Failed to start ML Service", error);
    process.exit(1);
  }
}

start();
