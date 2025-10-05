import type { Hono } from "hono";
import type { LSTMPredictionService } from "./services/lstm-prediction";
import type { MarketRegimeService } from "./services/market-regime";
import type { ModelPersistenceService } from "./services/model-persistence";
import type { PricePredictionService } from "./services/price-prediction";
import type { BacktestingService } from "./services/backtesting";
import {
  MarketRegimeRequestSchema,
  PredictionRequestSchema,
  BacktestConfigSchema,
  CompareModelsRequestSchema,
} from "./types";

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export function setupMLRoutes(
  app: Hono,
  predictionService: PricePredictionService,
  regimeService: MarketRegimeService,
  lstmService: LSTMPredictionService,
  persistenceService: ModelPersistenceService,
  backtestingService: BacktestingService
) {
  /**
   * POST /api/ml/predict - Предсказать цену
   */
  app.post("/api/ml/predict", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request
      const validation = PredictionRequestSchema.safeParse(body);
      if (!validation.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: validation.error.message,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const result = await predictionService.predictPrice(validation.data);

      return c.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "PREDICTION_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/ml/predict/batch - Batch predictions
   */
  app.post("/api/ml/predict/batch", async (c) => {
    try {
      const body = (await c.req.json()) as {
        symbols: string[];
        horizon: "1h" | "4h" | "1d" | "7d";
        confidence?: number;
      };

      if (!Array.isArray(body.symbols) || body.symbols.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: "symbols must be a non-empty array",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const results = await predictionService.batchPredict(
        body.symbols,
        body.horizon,
        body.confidence
      );

      return c.json({
        success: true,
        data: {
          predictions: results,
          count: results.length,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "BATCH_PREDICTION_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/ml/regime - Определить market regime
   */
  app.post("/api/ml/regime", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request
      const validation = MarketRegimeRequestSchema.safeParse(body);
      if (!validation.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: validation.error.message,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const result = await regimeService.detectRegime(validation.data);

      return c.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "REGIME_DETECTION_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/ml/predict/lstm - LSTM price prediction
   */
  app.post("/api/ml/predict/lstm", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request
      const validation = PredictionRequestSchema.safeParse(body);
      if (!validation.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: validation.error.message,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const result = await lstmService.predictPrice(validation.data);

      return c.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "LSTM_PREDICTION_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/ml/models - List all saved models
   */
  app.get("/api/ml/models", async (c) => {
    try {
      const models = await persistenceService.listModels();

      return c.json({
        success: true,
        data: {
          models,
          count: models.length,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "LIST_MODELS_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/ml/models/:symbol/stats - Get model statistics
   */
  app.get("/api/ml/models/:symbol/stats", (c) => {
    try {
      const symbol = c.req.param("symbol");
      const stats = lstmService.getModelStats();

      if (!stats[symbol]) {
        return c.json(
          {
            success: false,
            error: {
              code: "MODEL_NOT_FOUND",
              message: `No model found for ${symbol}`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      return c.json({
        success: true,
        data: {
          symbol,
          ...stats[symbol],
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "GET_MODEL_STATS_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * DELETE /api/ml/models/:symbol - Delete model
   */
  app.delete("/api/ml/models/:symbol", async (c) => {
    try {
      const symbol = c.req.param("symbol");

      // Clear from cache
      lstmService.clearCache(symbol);

      // Delete from disk
      await persistenceService.deleteModel(symbol, "LSTM");

      return c.json({
        success: true,
        data: {
          message: `Model for ${symbol} deleted`,
          symbol,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "DELETE_MODEL_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/ml/models/cleanup - Cleanup old models
   */
  app.post("/api/ml/models/cleanup", async (c) => {
    try {
      const body = (await c.req.json()) as { maxAgeDays?: number };
      const maxAgeDays = body.maxAgeDays || 30;

      const deletedCount =
        await persistenceService.cleanupOldModels(maxAgeDays);

      return c.json({
        success: true,
        data: {
          message: `Deleted ${deletedCount} old models`,
          deletedCount,
          maxAgeDays,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "CLEANUP_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/ml/backtest - Run backtest
   */
  app.post("/api/ml/backtest", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request
      const validation = BacktestConfigSchema.safeParse(body);
      if (!validation.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: validation.error.message,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const result = await backtestingService.runBacktest(validation.data);

      return c.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "BACKTEST_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/ml/backtest/compare - Compare LSTM vs Hybrid models
   */
  app.post("/api/ml/backtest/compare", async (c) => {
    try {
      const body = await c.req.json();

      // Validate request
      const validation = CompareModelsRequestSchema.safeParse(body);
      if (!validation.success) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_REQUEST",
              message: validation.error.message,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const result = await backtestingService.compareModels(validation.data);

      return c.json({
        success: true,
        data: result,
        timestamp: Date.now(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "COMPARISON_FAILED",
            message: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/ml/health - Health check
   */
  app.get("/api/ml/health", (c) =>
    c.json({
      status: "healthy",
      service: "ml-service",
      timestamp: Date.now(),
    })
  );
}
