import { createSuccessResponse } from "@aladdin/http/responses";
import { initializeService } from "@aladdin/service/bootstrap";
import { setupMLRoutes } from "./routes";
import { MLService } from "./services/ml-service";
import "dotenv/config";

const DEFAULT_PORT = 3019;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

await initializeService<MLService>({
  serviceName: "ml-service",
  port: PORT,

  dependencies: {
    clickhouse: true,
    nats: false,
  },

  createService: (deps) => new MLService(deps),

  setupRoutes: (app, service) => {
    // Настраиваем маршруты ML Service
    setupMLRoutes(
      app,
      service.predictionService,
      service.regimeService,
      service.lstmService,
      service.persistenceService,
      service.backtestingService,
      service.hpoService,
      service.anomalyService,
      service.ensembleService
    );

    // Health check endpoint
    app.get("/api/ml/health", (c) =>
      c.json(
        createSuccessResponse({
          status: "healthy",
          service: "ml-service",
          components: {
            featureEngineering: true,
            marketRegime: true,
            pricePrediction: true,
            lstm: true,
            modelPersistence: true,
            backtesting: true,
            hyperparameterOptimization: true,
            anomalyDetection: true,
            ensemble: true,
          },
        })
      )
    );
  },

  afterInit: (_service, deps) => {
    deps.logger.info("🤖 ML Service initialized successfully");
    deps.logger.info("Available endpoints:");
    deps.logger.info(
      "  POST /api/ml/predict - Price prediction (Hybrid) [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/predict/lstm - Price prediction (LSTM) [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/predict/ensemble - Ensemble prediction [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/predict/batch - Batch predictions [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/regime - Market regime detection [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/backtest - Run backtest [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/backtest/compare - Compare models [includeSentiment]"
    );
    deps.logger.info(
      "  POST /api/ml/optimize - Hyperparameter optimization [includeSentiment]"
    );
    deps.logger.info(
      "  GET /api/ml/optimize/recommendations - HPO recommendations"
    );
    deps.logger.info("  POST /api/ml/anomalies/detect - Detect anomalies");
    deps.logger.info("  GET /api/ml/models - List saved models");
    deps.logger.info("  GET /api/ml/models/:symbol/stats - Model statistics");
    deps.logger.info("  DELETE /api/ml/models/:symbol - Delete model");
    deps.logger.info("  POST /api/ml/models/cleanup - Cleanup old models");
    deps.logger.info("  GET /api/ml/health - Health check");
    deps.logger.info("");
    deps.logger.info(
      "💡 All prediction endpoints support 'includeSentiment' query param (default: true)"
    );
  },
});
