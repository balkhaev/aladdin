import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import {
  validateBody,
  validateQuery,
} from "@aladdin/shared/middleware/validation";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { ServerWebSocket } from "bun";
import { PortfolioService } from "./services/portfolio";
import {
  type CreatePortfolioBody,
  type CreatePositionBody,
  createPortfolioSchema,
  createPositionSchema,
  type GetPerformanceQuery,
  type GetPortfoliosBySymbolQuery,
  type GetTransactionsQuery,
  getPerformanceQuerySchema,
  getPortfoliosBySymbolSchema,
  getTransactionsQuerySchema,
  type ImportPositionsBody,
  importPositionsSchema,
  type UpdatePortfolioBody,
  type UpdatePositionBody,
  updatePortfolioSchema,
  updatePositionSchema,
} from "./validation/schemas";
import { PortfolioWebSocketHandler } from "./websocket/handler";
import { RiskService } from "./services/risk";
import { CorrelationAnalysisService } from "./services/correlation-analysis";
import { PositionMonitor } from "./services/position-monitor";
import { PositionSizer } from "./services/position-sizer";
import "dotenv/config";

const DEFAULT_PORT = 3012;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

type WebSocketData = {
  clientId: string;
  userId?: string;
  subscribedPortfolios: Set<string>;
};

let wsHandler: PortfolioWebSocketHandler;
let riskService: RiskService;
let positionMonitor: PositionMonitor;
let positionSizer: PositionSizer;
let correlationAnalysis: CorrelationAnalysisService;

await initializeService<PortfolioService, WebSocketData>({
  serviceName: "portfolio",
  port: PORT,

  createService: (deps) => new PortfolioService(deps),

  afterInit: async (_service, deps) => {
    // Initialize WebSocket handler once
    if (!deps.natsClient) {
      throw new Error("NATS client is required for Portfolio WebSocket");
    }
    wsHandler = new PortfolioWebSocketHandler(deps.natsClient, deps.logger);
    await wsHandler.initialize();

    // Initialize Risk services
    riskService = new RiskService(deps);
    if (deps.prisma && deps.natsClient) {
      positionMonitor = new PositionMonitor(deps.prisma, deps.natsClient, deps.logger);
      positionSizer = new PositionSizer(deps.prisma, deps.logger);
    }
    if (deps.clickhouse) {
      correlationAnalysis = new CorrelationAnalysisService(deps.clickhouse, deps.logger);
    }
    deps.logger.info("Risk services initialized in portfolio service");
  },

  setupRoutes: (app, service) => {
    /**
     * POST /api/portfolio - Create portfolio
     */
    app.post(
      "/api/portfolio",
      validateBody(createPortfolioSchema),
      async (c) => {
        const userId = c.req.header("x-user-id") ?? "test-user";
        const body = c.get("validatedBody") as CreatePortfolioBody;

        const portfolio = await service.createPortfolio({
          userId,
          name: body.name,
          currency: body.currency,
          initialBalance: body.initialBalance,
        });

        return c.json(createSuccessResponse(portfolio), HTTP_STATUS.CREATED);
      }
    );

    /**
     * GET /api/portfolio - Get user portfolios
     */
    app.get("/api/portfolio", async (c) => {
      const userId = c.req.header("x-user-id") ?? "test-user";
      const portfolios = await service.getPortfolios(userId);

      return c.json(createSuccessResponse(portfolios));
    });

    /**
     * GET /api/portfolio/symbols - Get all unique symbols
     */
    app.get("/api/portfolio/symbols", async (c) => {
      const symbols = await service.getAllSymbols();

      return c.json(createSuccessResponse(symbols));
    });

    /**
     * GET /api/portfolio/by-symbol/:symbol - Get portfolios by symbol
     */
    app.get(
      "/api/portfolio/by-symbol/:symbol",
      validateQuery(getPortfoliosBySymbolSchema),
      async (c) => {
        const { symbol } = c.req.param();
        const query = c.get("validatedQuery") as GetPortfoliosBySymbolQuery;

        const portfolios = await service.getPortfoliosBySymbol(
          symbol,
          query.userId
        );

        return c.json(createSuccessResponse(portfolios));
      }
    );

    /**
     * GET /api/portfolio/:id - Get portfolio by ID
     */
    app.get("/api/portfolio/:id", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      const portfolio = await service.getPortfolio(id, userId);

      if (!portfolio) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Portfolio not found",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      return c.json(createSuccessResponse(portfolio));
    });

    /**
     * PATCH /api/portfolio/:id - Update portfolio
     */
    app.patch(
      "/api/portfolio/:id",
      validateBody(updatePortfolioSchema),
      async (c) => {
        const { id } = c.req.param();
        const body = c.get("validatedBody") as UpdatePortfolioBody;

        const portfolio = await service.updatePortfolio(id, body);

        return c.json(createSuccessResponse(portfolio));
      }
    );

    /**
     * DELETE /api/portfolio/:id - Delete portfolio
     */
    app.delete("/api/portfolio/:id", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      await service.deletePortfolio(id, userId);

      return c.json(createSuccessResponse({ message: "Portfolio deleted" }));
    });

    /**
     * GET /api/portfolio/:id/performance - Get portfolio performance
     */
    app.get(
      "/api/portfolio/:id/performance",
      validateQuery(getPerformanceQuerySchema),
      async (c) => {
        const { id } = c.req.param();
        const userId = c.req.header("x-user-id") ?? "test-user";
        const query = c.get("validatedQuery") as GetPerformanceQuery;

        const performance = await service.getPerformance(
          id,
          userId,
          query.days
        );

        return c.json(createSuccessResponse(performance));
      }
    );

    /**
     * POST /api/portfolio/:id/snapshot - Take portfolio snapshot
     */
    app.post("/api/portfolio/:id/snapshot", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      await service.takeSnapshot(id, userId);

      return c.json(createSuccessResponse({ message: "Snapshot taken" }));
    });

    /**
     * POST /api/portfolio/:id/import - Import positions to portfolio
     */
    app.post(
      "/api/portfolio/:id/import",
      validateBody(importPositionsSchema),
      async (c) => {
        const { id } = c.req.param();
        const userId = c.req.header("x-user-id") ?? "test-user";
        const body = c.get("validatedBody") as ImportPositionsBody;

        const positions = await service.importPositions({
          portfolioId: id,
          userId,
          assets: body.assets,
          exchange: body.exchange,
          exchangeCredentialsId: body.exchangeCredentialsId,
        });

        return c.json(createSuccessResponse(positions), HTTP_STATUS.CREATED);
      }
    );

    /**
     * POST /api/portfolio/:id/update-prices - Queue async price update for portfolio
     */
    app.post("/api/portfolio/:id/update-prices", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      // Add job to queue (async)
      const jobId = await service.queuePriceUpdate(id, userId);

      return c.json(
        createSuccessResponse({
          message: "Price update queued",
          jobId,
          portfolioId: id,
          statusUrl: `/api/portfolio/${id}/update-prices/${jobId}`,
        }),
        HTTP_STATUS.ACCEPTED
      );
    });

    /**
     * GET /api/portfolio/:id/update-prices/:jobId - Get price update job status
     */
    app.get("/api/portfolio/:id/update-prices/:jobId", async (c) => {
      const { jobId } = c.req.param();

      const status = await service.getPriceUpdateStatus(jobId);

      if (!status) {
        return c.json(
          {
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Job not found",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      return c.json(createSuccessResponse(status));
    });

    /**
     * GET /api/portfolio/queue/stats - Get queue statistics
     */
    app.get("/api/portfolio/queue/stats", async (c) => {
      const stats = await service.getQueueStats();
      return c.json(createSuccessResponse(stats));
    });

    /**
     * GET /api/portfolio/:id/transactions - Get portfolio transactions
     */
    app.get(
      "/api/portfolio/:id/transactions",
      validateQuery(getTransactionsQuerySchema),
      async (c) => {
        const { id } = c.req.param();
        const userId = c.req.header("x-user-id") ?? "test-user";
        const query = c.get("validatedQuery") as GetTransactionsQuery;

        const transactions = await service.getTransactions(id, userId, {
          from: query.from,
          to: query.to,
          limit: query.limit,
        });

        return c.json(createSuccessResponse(transactions));
      }
    );

    /**
     * POST /api/portfolio/:id/positions - Create position manually
     */
    app.post(
      "/api/portfolio/:id/positions",
      validateBody(createPositionSchema),
      async (c) => {
        const { id } = c.req.param();
        const userId = c.req.header("x-user-id") ?? "test-user";
        const body = c.get("validatedBody") as CreatePositionBody;

        const position = await service.createPosition({
          portfolioId: id,
          userId,
          symbol: body.symbol,
          quantity: body.quantity,
          entryPrice: body.entryPrice,
          side: body.side,
        });

        return c.json(createSuccessResponse(position), HTTP_STATUS.CREATED);
      }
    );

    /**
     * PATCH /api/portfolio/:id/positions/:positionId - Update position
     */
    app.patch(
      "/api/portfolio/:id/positions/:positionId",
      validateBody(updatePositionSchema),
      async (c) => {
        const { id, positionId } = c.req.param();
        const userId = c.req.header("x-user-id") ?? "test-user";
        const body = c.get("validatedBody") as UpdatePositionBody;

        const position = await service.updatePositionManual(
          positionId,
          id,
          userId,
          body
        );

        return c.json(createSuccessResponse(position));
      }
    );

    /**
     * DELETE /api/portfolio/:id/positions/:positionId - Delete position
     */
    app.delete("/api/portfolio/:id/positions/:positionId", async (c) => {
      const { id, positionId } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      await service.deletePosition(positionId, id, userId);

      return c.json(createSuccessResponse({ message: "Position deleted" }));
    });

    /**
     * POST /api/portfolio/:id/optimize - Optimize portfolio weights
     */
    app.post("/api/portfolio/:id/optimize", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      try {
        const body = await c.req.json<{
          assets: string[];
          days?: number;
          constraints?: {
            minWeight?: number;
            maxWeight?: number;
            targetReturn?: number;
            maxRisk?: number;
            allowShorts?: boolean;
          };
        }>();

        const optimized = await service.optimizePortfolio({
          portfolioId: id,
          userId,
          assets: body.assets,
          days: body.days,
          constraints: body.constraints,
        });

        return c.json(createSuccessResponse(optimized));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "OPTIMIZATION_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/portfolio/:id/rebalancing/analyze - Analyze rebalancing needs
     */
    app.post("/api/portfolio/:id/rebalancing/analyze", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      try {
        const body = await c.req.json<{
          targetWeights: Record<string, number>;
          config: {
            strategy: "periodic" | "threshold" | "opportunistic" | "hybrid";
            frequency?: "daily" | "weekly" | "monthly" | "quarterly";
            thresholdPercent?: number;
            minTradeSize?: number;
            maxTransactionCost?: number;
            allowPartialRebalance?: boolean;
          };
        }>();

        const plan = await service.analyzeRebalancing({
          portfolioId: id,
          userId,
          targetWeights: body.targetWeights,
          config: body.config,
        });

        return c.json(createSuccessResponse(plan));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "REBALANCING_ANALYSIS_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/portfolio/:id/rebalancing/execute - Execute rebalancing
     */
    app.post("/api/portfolio/:id/rebalancing/execute", async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";

      try {
        const body = await c.req.json<{
          plan: {
            needsRebalancing: boolean;
            reason: string;
            totalValue: number;
            actions: Array<{
              symbol: string;
              action: "buy" | "sell" | "hold";
              currentWeight: number;
              targetWeight: number;
              currentValue: number;
              targetValue: number;
              deltaValue: number;
              deltaQuantity: number;
              estimatedCost: number;
            }>;
            totalTransactionCost: number;
            estimatedSlippage: number;
            netBenefit: number;
            priority: "low" | "medium" | "high";
          };
          dryRun?: boolean;
        }>();

        const orders = await service.executeRebalancing({
          portfolioId: id,
          userId,
          plan: body.plan,
          dryRun: body.dryRun ?? true,
        });

        return c.json(
          createSuccessResponse({ orders, dryRun: body.dryRun ?? true })
        );
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "REBALANCING_EXECUTION_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    // Risk Management endpoints (from risk service)
    
    /**
     * GET /api/portfolio/:id/risk/var - Calculate VaR for portfolio
     */
    app.get("/api/portfolio/:id/risk/var", async (c) => {
      const { id: portfolioId } = c.req.param();
      const confidence = Number(c.req.query("confidence") ?? "95");
      const days = Number(c.req.query("days") ?? "30");

      try {
        const varResult = await riskService.calculateVaR(portfolioId, confidence, days);
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
        const cvarResult = await riskService.calculateCVaR(portfolioId, confidence as 95 | 99);
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
      const window = (c.req.query("window") ?? "30d") as "7d" | "30d" | "90d" | "1y";

      try {
        if (!riskService.prisma) {
          throw new Error("Database not available");
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

        const correlations = await correlationAnalysis.calculateCorrelationMatrix({
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

        const scenarios = body.scenarios?.map((s) => riskService.createCustomStressScenario(s));

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
      const days = Number(c.req.query("days") ?? "30");
      const marketSymbol = c.req.query("market") ?? "BTCUSDT";

      try {
        const beta = await riskService.calculatePortfolioBeta({
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
  },

  websocket: {
    fetch: (req, server) => {
      if (server.upgrade(req, { data: { clientId: crypto.randomUUID() } })) {
        return;
      }
      return new Response("Not a websocket upgrade request", {
        status: HTTP_STATUS.BAD_REQUEST,
      });
    },
    open: (ws: ServerWebSocket<WebSocketData>) => {
      wsHandler.onOpen(ws);
    },
    message: (ws: ServerWebSocket<WebSocketData>, message: string | Buffer) => {
      const messageStr =
        typeof message === "string" ? message : message.toString();
      wsHandler.onMessage(ws, messageStr);
    },
    close: (ws: ServerWebSocket<WebSocketData>) => {
      wsHandler.onClose(ws);
    },
  },

  dependencies: {
    nats: true,
    postgres: true,
    clickhouse: true,
  },
});
