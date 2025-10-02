import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import { CorrelationAnalysisService } from "./services/correlation-analysis";
import { PositionMonitor } from "./services/position-monitor";
import { PositionSizer } from "./services/position-sizer";
import { RiskService } from "./services/risk";
import "dotenv/config";

const DEFAULT_PORT = 3013;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
const PERCENT_MULTIPLIER = 100;

// Global instances
let positionMonitor: PositionMonitor;
let positionSizer: PositionSizer;
let correlationAnalysis: CorrelationAnalysisService;

await initializeService<RiskService>({
  serviceName: "risk",
  port: PORT,

  createService: (deps) => {
    const service = new RiskService(deps);

    // Initialize position monitor and sizer
    if (deps.prisma && deps.nats) {
      positionMonitor = new PositionMonitor(
        deps.prisma,
        deps.nats,
        deps.logger
      );
      positionSizer = new PositionSizer(deps.prisma, deps.logger);
    }

    // Initialize correlation analysis
    if (deps.clickhouse) {
      correlationAnalysis = new CorrelationAnalysisService(
        deps.clickhouse,
        deps.logger
      );
    }

    return service;
  },

  setupRoutes: (app, service) => {
    /**
     * GET /api/risk/var - Calculate VaR for a portfolio (query params)
     * Also supports /api/risk/var/:portfolioId for backwards compatibility
     */
    app.get("/api/risk/var", async (c) => {
      const portfolioId = c.req.query("portfolioId");
      if (!portfolioId) {
        return c.json(
          {
            success: false,
            error: {
              code: "MISSING_PORTFOLIO_ID",
              message: "portfolioId query parameter is required",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const confidenceLevel = c.req.query("confidenceLevel");
      // Support both 0.95 and 95 formats
      let confidence = 95;
      if (confidenceLevel) {
        const parsed = Number(confidenceLevel);
        confidence =
          parsed < 1 ? Math.round(parsed * PERCENT_MULTIPLIER) : parsed;
      }
      const days = Number(c.req.query("days") ?? "30");

      try {
        const varResult = await service.calculateVaR(
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
     * GET /api/risk/var/:portfolioId - Calculate VaR (path param, backwards compatibility)
     */
    app.get("/api/risk/var/:portfolioId", async (c) => {
      const { portfolioId } = c.req.param();
      const confidence = Number(c.req.query("confidence") ?? "95");
      const days = Number(c.req.query("days") ?? "30");

      try {
        const varResult = await service.calculateVaR(
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
     * GET /api/risk/portfolio/:portfolioId/exposure - Calculate portfolio exposure (frontend format)
     */
    app.get("/api/risk/portfolio/:portfolioId/exposure", async (c) => {
      const { portfolioId } = c.req.param();

      try {
        const exposure = await service.calculateExposure(portfolioId);
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
     * GET /api/risk/exposure/:portfolioId - Calculate portfolio exposure (backwards compatibility)
     */
    app.get("/api/risk/exposure/:portfolioId", async (c) => {
      const { portfolioId } = c.req.param();

      try {
        const exposure = await service.calculateExposure(portfolioId);
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
     * GET /api/risk/portfolio/:portfolioId/correlations - Get portfolio asset correlations
     */
    app.get("/api/risk/portfolio/:portfolioId/correlations", async (c) => {
      const { portfolioId } = c.req.param();
      const window = (c.req.query("window") ?? "30d") as
        | "7d"
        | "30d"
        | "90d"
        | "1y";

      if (!correlationAnalysis) {
        return c.json(
          {
            success: false,
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Correlation analysis service not available",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        // Get portfolio positions to extract symbols
        if (!service.prisma) {
          throw new Error("Database not available");
        }

        const portfolio = await service.prisma.portfolio.findUnique({
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

        const correlations =
          await correlationAnalysis.calculateCorrelationMatrix({
            symbols,
            window,
          });

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
     * GET /api/risk/limits - Get risk limits (query params)
     */
    app.get("/api/risk/limits", async (c) => {
      // For now, use a default userId from query or header
      // In production, this should come from auth middleware
      const userId =
        c.req.query("userId") ?? c.req.header("x-user-id") ?? "default-user";
      const portfolioId = c.req.query("portfolioId");

      try {
        const limits = await service.getRiskLimits(userId, portfolioId);
        return c.json(
          createSuccessResponse({
            limits,
            count: limits.length,
          })
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "FETCH_LIMITS_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/risk/limits/:userId - Get risk limits for user (backwards compatibility)
     */
    app.get("/api/risk/limits/:userId", async (c) => {
      const { userId } = c.req.param();
      const portfolioId = c.req.query("portfolioId");

      try {
        const limits = await service.getRiskLimits(userId, portfolioId);
        return c.json(
          createSuccessResponse({
            limits,
            count: limits.length,
          })
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "FETCH_LIMITS_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/risk/limits - Create a new risk limit
     */
    app.post("/api/risk/limits", async (c) => {
      try {
        const body = await c.req.json<{
          userId: string;
          type: string;
          value: number;
          portfolioId?: string;
          enabled?: boolean;
        }>();

        const limit = await service.createRiskLimit(body);
        return c.json(createSuccessResponse(limit), HTTP_STATUS.CREATED);
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "CREATE_LIMIT_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * PATCH /api/risk/limits/:limitId - Update a risk limit
     */
    app.patch("/api/risk/limits/:limitId", async (c) => {
      const { limitId } = c.req.param();

      try {
        const body = await c.req.json<{
          value?: number;
          enabled?: boolean;
        }>();

        const limit = await service.updateRiskLimit(limitId, body);
        return c.json(createSuccessResponse(limit));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "UPDATE_LIMIT_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/risk/check-order - Check if order violates risk limits
     */
    app.post("/api/risk/check-order", async (c) => {
      try {
        const body = await c.req.json<{
          portfolioId: string;
          symbol: string;
          side: "BUY" | "SELL";
          quantity: number;
          price: number;
        }>();

        const result = await service.checkOrderRisk(body);
        return c.json(createSuccessResponse(result));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "ORDER_CHECK_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/risk/positions/:positionId/monitor - Start monitoring a position
     */
    app.post("/api/risk/positions/:positionId/monitor", async (c) => {
      const { positionId } = c.req.param();

      try {
        const body = await c.req.json<{
          stopLoss?: number;
          takeProfit?: number;
          trailingStopPercent?: number;
          autoCloseEnabled: boolean;
        }>();

        await positionMonitor.startMonitoring({
          positionId,
          ...body,
        });

        return c.json(
          createSuccessResponse({
            positionId,
            monitoring: true,
            config: body,
          })
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "START_MONITORING_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * DELETE /api/risk/positions/:positionId/monitor - Stop monitoring a position
     */
    app.delete("/api/risk/positions/:positionId/monitor", async (c) => {
      const { positionId } = c.req.param();

      try {
        await positionMonitor.stopMonitoring(positionId);

        return c.json(
          createSuccessResponse({
            positionId,
            monitoring: false,
          })
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "STOP_MONITORING_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/risk/positions/:positionId/monitor - Get monitoring status
     */
    app.get("/api/risk/positions/:positionId/monitor", (c) => {
      const { positionId } = c.req.param();

      const status = positionMonitor.getMonitoringStatus(positionId);

      return c.json(
        createSuccessResponse({
          positionId,
          ...status,
        })
      );
    });

    /**
     * GET /api/risk/positions/monitored - Get all monitored positions
     */
    app.get("/api/risk/positions/monitored", (c) => {
      const monitored = positionMonitor.getAllMonitored();

      return c.json(
        createSuccessResponse({
          positions: monitored,
          count: monitored.length,
        })
      );
    });

    /**
     * POST /api/risk/position-size - Calculate recommended position size
     */
    app.post("/api/risk/position-size", async (c) => {
      try {
        const body = await c.req.json<{
          userId: string;
          balance: number;
          price: number;
          stopLossPrice?: number;
          atr?: number;
          defaultRiskPercent?: number;
        }>();

        const result = await positionSizer.calculateRecommendedSize(body);

        return c.json(createSuccessResponse(result));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "POSITION_SIZE_CALCULATION_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/risk/trading-stats/:userId - Get historical trading statistics
     */
    app.get("/api/risk/trading-stats/:userId", async (c) => {
      const { userId } = c.req.param();
      const days = Number(c.req.query("days") ?? "30");

      try {
        const stats = await positionSizer.getHistoricalStats(userId, days);

        return c.json(createSuccessResponse(stats));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "FETCH_STATS_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/risk/cvar/:portfolioId - Calculate CVaR for a portfolio
     */
    app.get("/api/risk/cvar/:portfolioId", async (c) => {
      const { portfolioId } = c.req.param();
      const confidence = Number(c.req.query("confidence") ?? "95");

      // Validate confidence level
      const CONFIDENCE_95 = 95;
      const CONFIDENCE_99 = 99;
      if (confidence !== CONFIDENCE_95 && confidence !== CONFIDENCE_99) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_CONFIDENCE",
              message: "Confidence level must be 95 or 99",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      try {
        const cvarResult = await service.calculateCVaR(
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
     * POST /api/risk/stress-test/:portfolioId - Run stress test on portfolio
     */
    app.post("/api/risk/stress-test/:portfolioId", async (c) => {
      const { portfolioId } = c.req.param();

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

        // Convert scenarios if provided
        const scenarios = body.scenarios?.map((s) =>
          service.createCustomStressScenario(s)
        );

        const result = await service.runStressTest({
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
     * GET /api/risk/stress-test/scenarios - Get predefined stress test scenarios
     */
    app.get("/api/risk/stress-test/scenarios", (c) => {
      const scenarios = service.getStressTestScenarios();

      // Convert Map to object for JSON serialization
      const serializedScenarios = scenarios.map((s) => ({
        name: s.name,
        description: s.description,
        priceShocks: Object.fromEntries(s.priceShocks),
        volumeShock: s.volumeShock,
        spreadShock: s.spreadShock,
        liquidityShock: s.liquidityShock,
        correlationShock: s.correlationShock,
      }));

      return c.json(createSuccessResponse(serializedScenarios));
    });

    /**
     * GET /api/risk/beta/:portfolioId - Calculate portfolio beta
     */
    app.get("/api/risk/beta/:portfolioId", async (c) => {
      const { portfolioId } = c.req.param();
      const days = Number(c.req.query("days") ?? "30");
      const marketSymbol = c.req.query("market") ?? "BTCUSDT";

      try {
        const beta = await service.calculatePortfolioBeta({
          portfolioId,
          days,
          marketSymbol,
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
     * GET /api/risk/beta/:portfolioId/multi-market - Calculate multi-market beta
     */
    app.get("/api/risk/beta/:portfolioId/multi-market", async (c) => {
      const { portfolioId } = c.req.param();
      const days = Number(c.req.query("days") ?? "30");

      try {
        const multiMarketBeta = await service.calculateMultiMarketBeta(
          portfolioId,
          days
        );

        return c.json(createSuccessResponse(multiMarketBeta));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "MULTI_MARKET_BETA_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * GET /api/risk/beta/:portfolioId/rolling - Calculate rolling beta
     */
    app.get("/api/risk/beta/:portfolioId/rolling", async (c) => {
      const { portfolioId } = c.req.param();
      const totalDays = Number(c.req.query("totalDays") ?? "90");
      const windowDays = Number(c.req.query("windowDays") ?? "30");
      const marketSymbol = c.req.query("market") ?? "BTCUSDT";

      try {
        const rollingBeta = await service.calculateRollingBeta({
          portfolioId,
          totalDays,
          windowDays,
          marketSymbol,
        });

        return c.json(createSuccessResponse(rollingBeta));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "ROLLING_BETA_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });
  },

  dependencies: {
    nats: true,
    postgres: true,
    clickhouse: true,
  },
});
