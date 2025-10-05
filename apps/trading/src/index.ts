/**
 * Trading Service Entry Point
 * Минимальный bootstrap файл
 */

import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { ServerWebSocket } from "bun";
import { config } from "./config";
import { setupExecutorRoutes, setupTradingRoutes } from "./routes";
import { type ExecutorConfig, StrategyExecutor } from "./services/executor";
import { TradingService } from "./services/trading";
import { TradingWebSocketHandler } from "./websocket/handler";
import "dotenv/config";

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
  port: config.PORT,

  dependencies: {
    nats: true,
    postgres: true,
    clickhouse: false,
  },

  createService: (deps) =>
    new TradingService({
      ...deps,
      enableCache: false, // Trading service doesn't need cache for now
      enableServiceClient: true, // Enable service client for inter-service calls
    }),

  afterInit: async (_service, deps) => {
    // Initialize WebSocket handler
    if (!deps.natsClient) {
      throw new Error("NATS client is required for trading WebSocket handler");
    }

    wsHandler = new TradingWebSocketHandler(deps.natsClient, deps.logger);
    await wsHandler.initialize();

    // Initialize Strategy Executor
    const executorConfig: Partial<ExecutorConfig> = {
      mode: (process.env.EXECUTOR_MODE as "PAPER" | "LIVE") ?? "PAPER",
      maxOpenPositions: Number(process.env.MAX_OPEN_POSITIONS ?? "5"),
      userId: process.env.DEFAULT_USER_ID ?? "",
      portfolioId: process.env.DEFAULT_PORTFOLIO_ID ?? "",
      exchangeCredentialsId: process.env.DEFAULT_EXCHANGE_CREDENTIALS_ID ?? "",
      autoExecute: process.env.AUTO_EXECUTE !== "false",
    };

    executor = new StrategyExecutor(deps, executorConfig);
    deps.logger.info("Strategy executor initialized", {
      config: executorConfig,
    });
  },

  setupRoutes: (app, service) => {
    // Setup main trading routes
    setupTradingRoutes(app, service);

    // Setup executor routes
    if (executor) {
      setupExecutorRoutes(app, executor, service.getPrisma());
    }
  },

  websocket: {
    enabled: true,
    path: "/ws/trading",
    handlers: {
      open: (ws: ServerWebSocket<WebSocketData>) => {
        if (wsHandler) {
          wsHandler.onOpen(ws);
        }
      },
      message: (ws: ServerWebSocket<WebSocketData>, message: string) => {
        if (wsHandler) {
          wsHandler.onMessage(ws, message);
        }
      },
      close: (
        ws: ServerWebSocket<WebSocketData>,
        code: number,
        reason: string
      ) => {
        if (wsHandler) {
          wsHandler.onClose(ws, code, reason);
        }
      },
    },
    createWebSocketData: () => ({
      clientId: crypto.randomUUID(),
      authenticated: false,
      subscriptions: new Set<string>(),
      messageCount: 0,
      lastMessageTime: Date.now(),
      lastPingTime: Date.now(),
    }),
  },
});
