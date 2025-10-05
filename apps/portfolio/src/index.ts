/**
 * Portfolio Service Entry Point
 * Минимальный bootstrap файл
 */

import { initializeService } from "@aladdin/service/bootstrap";
import type { ServerWebSocket } from "bun";
import { config } from "./config";
import { setupAllPortfolioRoutes } from "./routes";
import { CorrelationAnalysisService } from "./services/correlation-analysis";
import { PortfolioService } from "./services/portfolio";
import { RiskService } from "./services/risk";
import { PortfolioWebSocketHandler } from "./websocket/handler";
import "dotenv/config";

type WebSocketData = {
  clientId: string;
  userId?: string;
  subscribedPortfolios: Set<string>;
};

let wsHandler: PortfolioWebSocketHandler;
let riskService: RiskService;
let correlationAnalysis: CorrelationAnalysisService | undefined;

await initializeService<PortfolioService, WebSocketData>({
  serviceName: "portfolio",
  port: config.PORT,

  dependencies: {
    nats: true,
    postgres: true,
    clickhouse: true,
  },

  createService: (deps) =>
    new PortfolioService({
      ...deps,
      enableCache: true,
      enableServiceClient: true,
    }),

  afterInit: async (_service, deps) => {
    // Initialize WebSocket handler
    if (!deps.natsClient) {
      throw new Error("NATS client is required for Portfolio WebSocket");
    }

    wsHandler = new PortfolioWebSocketHandler(deps.natsClient, deps.logger);
    await wsHandler.initialize();

    // Initialize Risk services
    riskService = new RiskService(deps);

    if (deps.clickhouse) {
      correlationAnalysis = new CorrelationAnalysisService(
        deps.clickhouse,
        deps.logger
      );
    }

    deps.logger.info("Risk services initialized in portfolio service");
  },

  setupRoutes: (app, service) => {
    // Setup all portfolio routes
    setupAllPortfolioRoutes(app, service, riskService, correlationAnalysis);
  },

  websocket: {
    enabled: true,
    path: "/ws/portfolio",
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
      subscribedPortfolios: new Set<string>(),
    }),
  },
});

