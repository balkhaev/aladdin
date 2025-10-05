import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import {
  validateBody,
  validateQuery,
} from "@aladdin/shared/middleware/validation";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { OrderStatus } from "@aladdin/shared/types";
import type { ServerWebSocket } from "bun";
import { setupExecutorRoutes } from "./routes/executor";
import { type ExecutorConfig, StrategyExecutor } from "./services/executor";
import { TradingService } from "./services/trading";
import {
  type CreateOrderInput,
  createOrderSchema,
  type GetOrdersQuery,
  getOrdersQuerySchema,
} from "./validation/schemas";
import { TradingWebSocketHandler } from "./websocket/handler";
import "dotenv/config";

const DEFAULT_PORT = 3011;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;

type WebSocketData = {
  clientId: string;
  userId?: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  messageCount: number;
  lastMessageTime: number;
  lastPingTime: number;
};

let wsHandler: TradingWebSocketHandler;
let executor: StrategyExecutor | undefined;

await initializeService<TradingService, WebSocketData>({
  serviceName: "trading",
  port: PORT,

  createService: (deps) => new TradingService(deps),

  afterInit: async (_service, deps) => {
    // Initialize WebSocket handler once
    if (!deps.natsClient) {
      throw new Error("NATS client is required for trading WebSocket handler");
    }
    wsHandler = new TradingWebSocketHandler(deps.natsClient, deps.logger);
    await wsHandler.initialize();

    // Initialize Strategy Executor
    const executorConfig: Partial<ExecutorConfig> = {
      mode: (process.env.EXECUTOR_MODE as "PAPER" | "LIVE") || "PAPER",
      maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS || "5"),
      userId: process.env.DEFAULT_USER_ID || "",
      portfolioId: process.env.DEFAULT_PORTFOLIO_ID || "",
      exchangeCredentialsId: process.env.DEFAULT_EXCHANGE_CREDENTIALS_ID || "",
      autoExecute: process.env.AUTO_EXECUTE !== "false",
    };

    executor = new StrategyExecutor(deps, executorConfig);
    deps.logger.info("Strategy executor initialized", {
      config: executorConfig,
    });
  },

  setupRoutes: (app, service) => {
    app.post(
      "/api/trading/orders",
      validateBody(createOrderSchema),
      async (c) => {
        // TODO: Get userId from auth middleware
        const userId = c.req.header("x-user-id") ?? "test-user";

        const validatedData = c.get("validatedBody") as CreateOrderInput;

        const order = await service.createOrder({
          userId,
          portfolioId: validatedData.portfolioId,
          symbol: validatedData.symbol,
          type: validatedData.type,
          side: validatedData.side,
          quantity: validatedData.quantity,
          price: validatedData.price,
          stopPrice: validatedData.stopPrice,
          exchange: validatedData.exchange,
          exchangeCredentialsId: validatedData.exchangeCredentialsId,
        });

        return c.json(createSuccessResponse(order), HTTP_STATUS.CREATED);
      }
    );

    app.delete("/api/trading/orders/:id", async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const orderId = c.req.param("id");

      const order = await service.cancelOrder(orderId, userId);

      return c.json(createSuccessResponse(order));
    });

    app.get("/api/trading/balances", async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const exchangeCredentialsId = c.req.query("exchangeCredentialsId");

      if (!exchangeCredentialsId) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "exchangeCredentialsId is required",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const balances = await service.getExchangeBalances(
        exchangeCredentialsId,
        userId
      );

      return c.json(createSuccessResponse(balances));
    });

    app.get(
      "/api/trading/orders",
      validateQuery(getOrdersQuerySchema),
      async (c) => {
        // TODO: Get userId from auth middleware
        const userId = c.req.header("x-user-id") ?? "test-user";

        const validatedQuery = c.get("validatedQuery") as GetOrdersQuery;
        const portfolioId = c.req.query("portfolioId");

        const result = await service.getOrders({
          userId,
          portfolioId,
          symbol: validatedQuery.symbol,
          status: validatedQuery.status as OrderStatus | undefined,
          exchange: validatedQuery.exchange,
          limit: validatedQuery.limit,
          offset: validatedQuery.offset,
        });

        return c.json(
          createSuccessResponse({
            orders: result.orders,
            total: result.total,
          })
        );
      }
    );

    app.get("/api/trading/positions", async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const exchange = c.req.query("exchange") ?? "bybit";
      const symbol = c.req.query("symbol");

      try {
        // Get connector
        const connector = await service.getExchangeConnector(userId, exchange);

        if (!connector.getPositions) {
          return c.json(
            {
              success: false,
              error: {
                code: "NOT_SUPPORTED",
                message: "Positions not supported for this exchange",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.BAD_REQUEST
          );
        }

        const positions = await connector.getPositions({ symbol });

        return c.json(createSuccessResponse(positions));
      } catch (error) {
        // If error is "Exchange credentials not found", return 404
        if (
          error instanceof Error &&
          error.message.includes("Exchange credentials")
        ) {
          return c.json(
            {
              success: false,
              error: {
                code: "NOT_FOUND",
                message: error.message,
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.NOT_FOUND
          );
        }

        // For other errors, return 500
        throw error;
      }
    });

    app.get("/api/trading/orders/:id", async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const orderId = c.req.param("id");

      const order = await service.getOrder(orderId, userId);

      if (!order) {
        return c.json(
          {
            success: false,
            error: {
              code: "ORDER_NOT_FOUND",
              message: "Order not found",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      return c.json(createSuccessResponse(order));
    });

    app.post("/api/trading/orders/:id/sync", async (c) => {
      // TODO: Get userId from auth middleware and validate order ownership
      const orderId = c.req.param("id");

      const order = await service.syncOrderStatus(orderId);

      return c.json(createSuccessResponse(order));
    });

    /**
     * POST /api/trading/market-impact - Calculate market impact for an order
     */
    app.post("/api/trading/market-impact", async (c) => {
      try {
        const body = await c.req.json<{
          symbol: string;
          orderSize: number;
          side: "BUY" | "SELL";
          urgency?: "low" | "medium" | "high";
          currentPrice: number;
          dailyVolume: number;
          spread: number;
          volatility?: number;
        }>();

        const impact = service.calculateMarketImpact(body);

        return c.json(createSuccessResponse(impact));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "MARKET_IMPACT_CALCULATION_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/trading/order-splitting - Generate order splitting strategy
     */
    app.post("/api/trading/order-splitting", async (c) => {
      try {
        const body = await c.req.json<{
          impact: {
            temporaryImpact: number;
            permanentImpact: number;
            expectedSlippage: number;
            estimatedCost: number;
            participationRate: number;
            priceImpactBps: number;
            recommendation: {
              shouldSplit: boolean;
              optimalChunks: number;
              timeHorizon: number;
              reason: string;
            };
          };
          orderSize: number;
          volatility?: number;
        }>();

        const strategy = service.generateSplittingStrategy(body);

        return c.json(createSuccessResponse(strategy));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "ORDER_SPLITTING_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/trading/implementation-shortfall - Calculate implementation shortfall
     */
    app.post("/api/trading/implementation-shortfall", async (c) => {
      try {
        const body = await c.req.json<{
          decisionPrice: number;
          actualFillPrice: number;
          orderSize: number;
          side: "BUY" | "SELL";
        }>();

        const shortfall = service.calculateImplementationShortfall(body);

        return c.json(createSuccessResponse(shortfall));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "SHORTFALL_CALCULATION_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/trading/smart-routing - Find optimal route for order
     */
    app.post("/api/trading/smart-routing", async (c) => {
      try {
        const body = await c.req.json<{
          params: {
            symbol: string;
            side: "BUY" | "SELL";
            quantity: number;
            orderType: "MARKET" | "LIMIT";
            strategy?:
              | "best-price"
              | "best-execution"
              | "fastest"
              | "split"
              | "smart";
            maxSlippage?: number;
            urgency?: "low" | "medium" | "high";
            allowedExchanges?: Array<"binance" | "bybit" | "okx" | "kraken">;
          };
          quotes: Array<{
            exchange: "binance" | "bybit" | "okx" | "kraken";
            price: number;
            availableLiquidity: number;
            estimatedFee: number;
            latency: number;
            timestamp: number;
          }>;
        }>();

        const route = service.findOptimalRoute(body.params, body.quotes);

        return c.json(createSuccessResponse(route));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "ROUTING_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    /**
     * POST /api/trading/compare-prices - Compare prices across exchanges
     */
    app.post("/api/trading/compare-prices", async (c) => {
      try {
        const body = await c.req.json<{
          symbol: string;
          side: "BUY" | "SELL";
          quotes: Array<{
            exchange: "binance" | "bybit" | "okx" | "kraken";
            price: number;
            availableLiquidity: number;
            estimatedFee: number;
            latency: number;
            timestamp: number;
          }>;
        }>();

        const comparison = service.comparePrices(
          body.symbol,
          body.side,
          body.quotes
        );

        return c.json(createSuccessResponse(comparison));
      } catch (error) {
        return c.json(
          {
            success: false,
            error: {
              code: "PRICE_COMPARISON_FAILED",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    });

    // Setup Strategy Executor routes
    setupExecutorRoutes(app, executor, service.getPrisma());
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
    clickhouse: false,
  },
});
