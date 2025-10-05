import type { Hono } from "hono";
import type { MarketRegimeService } from "./services/market-regime";
import type { PricePredictionService } from "./services/price-prediction";
import { MarketRegimeRequestSchema, PredictionRequestSchema } from "./types";

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};

export function setupMLRoutes(
  app: Hono,
  predictionService: PricePredictionService,
  regimeService: MarketRegimeService
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
