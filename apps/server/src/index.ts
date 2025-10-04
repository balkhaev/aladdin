import "dotenv/config";
import { createLogger, Logger } from "@aladdin/shared/logger";
import { initNatsClient } from "@aladdin/shared/nats";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import db from "./db";
import { auth } from "./lib/auth";
import { authMiddleware } from "./middleware/auth";
import { proxyToService } from "./middleware/proxy";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { createExchangeCredentialsRouter } from "./routers/exchange-credentials";
import {
  areAllServicesHealthy,
  checkAllServices,
  getHealthyServicesCount,
} from "./utils/health";
import { handleWebSocketUpgrade, websocketHandlers } from "./websocket/proxy";

const winstonLogger = createLogger({ service: "gateway" });
const logger = new Logger(winstonLogger);

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;
const DEFAULT_PORT = 3000;

const app = new Hono();

// ====== Глобальные Middleware ======

// Логирование всех запросов
app.use(honoLogger());

// CORS для фронтенда (ВАЖНО: должен быть ДО монтирования роутеров!)
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Global error handler
app.onError((err, c) => {
  const statusCode =
    err instanceof Error && "statusCode" in err
      ? (err.statusCode as number)
      : HTTP_SERVICE_UNAVAILABLE;

  // Log error
  if (statusCode >= HTTP_SERVICE_UNAVAILABLE) {
    logger.error(err.message, err, {
      path: c.req.path,
      method: c.req.method,
    });
  } else {
    logger.warn(err.message, {
      path: c.req.path,
      method: c.req.method,
      statusCode,
    });
  }

  // Return error response
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: err.message || "An unexpected error occurred",
        details: process.env.NODE_ENV === "development" ? err.stack : undefined,
      },
      timestamp: Date.now(),
    },
    statusCode
  );
});

// Mount exchange credentials router
const exchangeCredentialsRouter = createExchangeCredentialsRouter({
  prisma: db,
  logger,
});
app.route("/api/exchange-credentials", exchangeCredentialsRouter);

// ====== Публичные эндпоинты ======

// Health check для Gateway
app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "api-gateway",
    timestamp: Date.now(),
  })
);

// Health check всех микросервисов
app.get("/health/services", async (c) => {
  const services = await checkAllServices();
  const allHealthy = areAllServicesHealthy(services);
  const { healthy, total } = getHealthyServicesCount(services);

  return c.json(
    {
      gateway: "ok",
      services,
      summary: {
        healthy,
        total,
        allHealthy,
      },
      timestamp: Date.now(),
    },
    allHealthy ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE
  );
});

// Корневой эндпоинт
app.get("/", (c) =>
  c.json({
    name: "Aladdin API Gateway",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      healthServices: "/health/services",
      auth: "/api/auth/*",
      exchangeCredentials: "/api/exchange-credentials",
      marketData: "/api/market-data/*",
      trading: "/api/trading/*",
      portfolio: "/api/portfolio/*",
      risk: "/api/risk/*",
      analytics: "/api/analytics/*",
      onChain: "/api/on-chain/*",
      screener: "/api/screener/*",
      macroData: "/api/macro/*",
      websocket: "ws://localhost:3000/ws",
    },
  })
);

// Аутентификация через Better-Auth
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ====== Защищенные API эндпоинты ======

// Применяем auth middleware ко всем /api/* запросам (кроме /api/auth/*)
app.use("/api/*", authMiddleware);

// Применяем rate limiting ко всем /api/* запросам
app.use("/api/*", rateLimitMiddleware);

// ====== Proxy к микросервисам ======

// Market Data Service
app.use(
  "/api/market-data/*",
  proxyToService({
    targetUrl: process.env.MARKET_DATA_URL || "http://localhost:3010",
    serviceName: "market-data",
  })
);

// Trading Service
app.use(
  "/api/trading/*",
  proxyToService({
    targetUrl: process.env.TRADING_URL || "http://localhost:3011",
    serviceName: "trading",
  })
);

// Portfolio Service
app.use(
  "/api/portfolio/*",
  proxyToService({
    targetUrl: process.env.PORTFOLIO_URL || "http://localhost:3012",
    serviceName: "portfolio",
  })
);

// Risk Service
app.use(
  "/api/risk/*",
  proxyToService({
    targetUrl: process.env.RISK_URL || "http://localhost:3013",
    serviceName: "risk",
  })
);

// Analytics Service
app.use(
  "/api/analytics/*",
  proxyToService({
    targetUrl: process.env.ANALYTICS_URL || "http://localhost:3014",
    serviceName: "analytics",
  })
);

// Screener Service
app.use(
  "/api/screener/*",
  proxyToService({
    targetUrl: process.env.SCREENER_URL || "http://localhost:3017",
    serviceName: "screener",
  })
);

// Social Integrations Service (NEW - combines telega + twity)
app.use(
  "/api/social/*",
  proxyToService({
    targetUrl: process.env.SOCIAL_URL || "http://localhost:3018",
    serviceName: "social-integrations",
  })
);

// ====== Запуск сервера с WebSocket ======

const PORT = Number(process.env.PORT) || DEFAULT_PORT;

logger.info("Starting API Gateway", {
  port: PORT,
  environment: process.env.NODE_ENV || "development",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3001",
});

// Инициализация NATS клиента
try {
  await initNatsClient({
    servers: process.env.NATS_URL || "nats://localhost:4222",
    logger,
  });
  logger.info("NATS client initialized successfully");
} catch (error) {
  logger.error("Failed to initialize NATS client", error);
  throw error;
}

export default {
  port: PORT,
  fetch(
    req: Request,
    server: { upgrade: (req: Request, options: { data: unknown }) => boolean }
  ) {
    // Обрабатываем WebSocket upgrade
    const wsResponse = handleWebSocketUpgrade(req, server);
    if (wsResponse !== null) {
      return wsResponse;
    }

    // Обрабатываем обычные HTTP запросы через Hono
    return app.fetch(req);
  },
  websocket: websocketHandlers,
};
