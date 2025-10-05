/**
 * Risk Management Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import type { Hono } from "hono";
import type { CorrelationAnalysisService } from "../services/correlation-analysis";
import type { RiskService } from "../services/risk";

export function setupRiskRoutes(
  app: Hono,
  riskService: RiskService,
  correlationAnalysis?: CorrelationAnalysisService
): void {
  /**
   * GET /api/portfolio/:id/risk/var - Calculate VaR for portfolio
   */
  app.get("/api/portfolio/:id/risk/var", async (c) => {
    const { id: portfolioId } = c.req.param();
    const confidence = Number(c.req.query("confidence") ?? "95");
    const days = Number(c.req.query("days") ?? "30");

    try {
      const varResult = await riskService.calculateVaR(
        portfolioId,
        confidence,
        days
      );
      return c.json(createSuccessResponse(varResult));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "VAR_CALCULATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/portfolio/:id/risk/cvar - Calculate CVaR for portfolio
   */
  app.get("/api/portfolio/:id/risk/cvar", async (c) => {
    const { id: portfolioId } = c.req.param();
    const confidence = Number(c.req.query("confidence") ?? "95");

    try {
      const cvarResult = await riskService.calculateCVaR(
        portfolioId,
        confidence as 95 | 99
      );
      return c.json(createSuccessResponse(cvarResult));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "CVAR_CALCULATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/portfolio/:id/risk/exposure - Calculate portfolio exposure
   */
  app.get("/api/portfolio/:id/risk/exposure", async (c) => {
    const { id: portfolioId } = c.req.param();

    try {
      const exposure = await riskService.calculateExposure(portfolioId);
      return c.json(createSuccessResponse(exposure));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "EXPOSURE_CALCULATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/portfolio/:id/risk/correlations - Get portfolio correlations
   */
  app.get("/api/portfolio/:id/risk/correlations", async (c) => {
    const { id: portfolioId } = c.req.param();
    const window = (c.req.query("window") ?? "30d") as
      | "7d"
      | "30d"
      | "90d"
      | "1y";

    try {
      if (!riskService.prisma) {
        throw new Error("Database not available");
      }

      if (!correlationAnalysis) {
        throw new Error("Correlation analysis service not available");
      }

      const portfolio = await riskService.prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: { positions: true },
      });

      if (!portfolio) {
        return c.json(
          {
            success: false,
            error: {
              code: "PORTFOLIO_NOT_FOUND",
              message: `Portfolio ${portfolioId} not found`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      const symbols = portfolio.positions.map((p) => p.symbol);

      if (symbols.length < 2) {
        return c.json(
          createSuccessResponse({
            symbols: [],
            matrix: [],
            timestamp: new Date(),
            avgCorrelation: 0,
            maxCorrelation: 0,
            minCorrelation: 0,
            diversificationScore: 100,
            highlyCorrelated: [],
            uncorrelated: [],
          })
        );
      }

      const correlations = await correlationAnalysis.calculateCorrelationMatrix(
        {
          symbols,
          window,
        }
      );

      return c.json(createSuccessResponse(correlations));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "CORRELATIONS_CALCULATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * POST /api/portfolio/:id/risk/stress-test - Run stress test
   */
  app.post("/api/portfolio/:id/risk/stress-test", async (c) => {
    const { id: portfolioId } = c.req.param();

    try {
      const body = await c.req.json<{
        scenarios?: Array<{
          name: string;
          description: string;
          priceShocks: Record<string, number>;
          volumeShock?: number;
          spreadShock?: number;
          liquidityShock?: number;
        }>;
      }>();

      const scenarios = body.scenarios?.map((s) =>
        riskService.createCustomStressScenario(s)
      );

      const result = await riskService.runStressTest({
        portfolioId,
        scenarios,
      });

      return c.json(createSuccessResponse(result));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "STRESS_TEST_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/portfolio/:id/risk/beta - Calculate portfolio beta
   */
  app.get("/api/portfolio/:id/risk/beta", async (c) => {
    const { id: portfolioId } = c.req.param();
    const benchmark = c.req.query("benchmark") ?? "BTC";
    const days = Number(c.req.query("days") ?? "30");

    try {
      const beta = await riskService.calculateBeta({
        portfolioId,
        benchmark,
        days,
      });

      return c.json(createSuccessResponse(beta));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "BETA_CALCULATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/portfolio/risk/scenarios - Get stress test scenarios
   */
  app.get("/api/portfolio/risk/scenarios", (c) => {
    try {
      const scenarios = riskService.getStressTestScenarios();
      return c.json(createSuccessResponse(scenarios));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "SCENARIOS_FETCH_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * GET /api/portfolio/risk/limits - Get risk limits
   */
  app.get("/api/portfolio/risk/limits", async (c) => {
    const userId = c.req.header("x-user-id") ?? "test-user";
    const portfolioId = c.req.query("portfolioId");
    const enabledParam = c.req.query("enabled");
    const enabled = enabledParam ? enabledParam === "true" : undefined;

    try {
      const limits = await riskService.getRiskLimits(
        userId,
        portfolioId,
        enabled
      );
      return c.json(createSuccessResponse(limits));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "LIMITS_FETCH_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * POST /api/portfolio/risk/limits - Create risk limit
   */
  app.post("/api/portfolio/risk/limits", async (c) => {
    const userId = c.req.header("x-user-id") ?? "test-user";

    try {
      const body = await c.req.json<{
        portfolioId?: string;
        type: string;
        value: number;
        enabled?: boolean;
      }>();

      const limit = await riskService.createRiskLimit({
        userId,
        portfolioId: body.portfolioId,
        type: body.type as
          | "MAX_LEVERAGE"
          | "MAX_POSITION_SIZE"
          | "MAX_DAILY_LOSS"
          | "MIN_MARGIN",
        value: body.value,
        enabled: body.enabled ?? true,
      });

      return c.json(createSuccessResponse(limit));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "LIMIT_CREATE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * PATCH /api/portfolio/risk/limits/:limitId - Update risk limit
   */
  app.patch("/api/portfolio/risk/limits/:limitId", async (c) => {
    const { limitId } = c.req.param();

    try {
      const body = await c.req.json<{
        value?: number;
        enabled?: boolean;
      }>();

      const limit = await riskService.updateRiskLimit(limitId, body);
      return c.json(createSuccessResponse(limit));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "LIMIT_UPDATE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * DELETE /api/portfolio/risk/limits/:limitId - Delete risk limit
   */
  app.delete("/api/portfolio/risk/limits/:limitId", async (c) => {
    const { limitId } = c.req.param();

    try {
      if (!riskService.prisma) {
        throw new Error("Database not available");
      }

      await riskService.prisma.riskLimit.delete({
        where: { id: limitId },
      });

      return c.json(createSuccessResponse({ success: true }));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "LIMIT_DELETE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });
}
