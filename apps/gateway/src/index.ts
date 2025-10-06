/**
 * API Gateway Service
 * Unified gateway using BaseGatewayService from @aladdin/gateway-service
 */

import "dotenv/config";
import { BaseGatewayService } from "@aladdin/gateway-service";
import { createLogger, Logger } from "@aladdin/logger";
import {
  initializeService,
  type ServiceDependencies,
} from "@aladdin/service/bootstrap";
import type { Context } from "hono";
import { logger as honoLogger } from "hono/logger";
import db from "./db";
import { auth } from "./lib/auth";
import { adminMiddleware } from "./middleware/admin";
import { authMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { createAdminUsersRouter } from "./routers/admin-users";
import { createExchangeCredentialsRouter } from "./routers/exchange-credentials";
import { websocketHandlers } from "./websocket/proxy";

type WebSocketData = {
  clientId: string;
  userId?: string;
  connections: {
    marketData?: WebSocket;
    trading?: WebSocket;
    portfolio?: WebSocket;
    risk?: WebSocket;
  };
};

// Service configuration
const SERVICES = {
  "market-data": process.env.MARKET_DATA_URL || "http://localhost:3010",
  trading: process.env.TRADING_URL || "http://localhost:3011",
  portfolio: process.env.PORTFOLIO_URL || "http://localhost:3012",
  analytics: process.env.ANALYTICS_URL || "http://localhost:3014",
  screener: process.env.SCREENER_URL || "http://localhost:3017",
  // Register scraper as "social" to automatically create /api/social/* proxy route
  social:
    process.env.SOCIAL_URL ||
    process.env.SCRAPER_URL ||
    "http://localhost:3018",
  ml: process.env.ML_SERVICE_URL || "http://localhost:8000",
};

// Path rewrites for backward compatibility
const PATH_REWRITES = {
  "/api/macro/*": {
    target: "market-data",
    rewrite: "/api/market-data/macro/*",
  },
  "/api/on-chain/*": {
    target: "market-data",
    rewrite: "/api/market-data/on-chain/*",
  },
  "/api/sentiment/*": {
    target: "analytics",
    rewrite: "/api/analytics/sentiment/*",
  },
  // Note: /api/social/* is handled by direct proxy to scraper service
  // No rewrite needed since scraper already has /api/social/* routes
};

// Initialize Gateway service
const service = await initializeService<BaseGatewayService, WebSocketData>({
  serviceName: "gateway",
  port: Number(process.env.PORT) || 3000,

  // Create Gateway service
  createService: (deps: ServiceDependencies) =>
    new BaseGatewayService({
      ...deps,
      services: SERVICES,
      pathRewrites: PATH_REWRITES,
      healthCheckInterval: 30_000, // 30 seconds
      getUserId: (c: Context) => {
        // Extract user ID from auth middleware
        const user = c.get("user") as { id?: string } | undefined;
        return user?.id;
      },
      enableCache: false,
      enableServiceClient: false,
    }),

  // Wait for services to be ready after initialization
  afterInit: async (gateway) => {
    // In dev mode, wait for services to become ready
    // This handles the case where services start in random order
    if (process.env.NODE_ENV !== "production") {
      await gateway.waitForServicesReady(15_000, 2000); // 45 seconds timeout, check every 2 seconds
    }
  },

  // Setup routes
  setupRoutes: (app, gateway) => {
    // ====== Global Middleware ======

    // Request logging
    app.use(honoLogger());

    // ====== Combined CORS and Auth Middleware ======
    app.use("/*", async (c, next) => {
      const origin = c.req.header("origin");
      const allowedOrigin = process.env.CORS_ORIGIN || "http://localhost:3001";

      // Special handling for /api/auth/* routes
      if (c.req.path.startsWith("/api/auth/")) {
        // For OPTIONS, return CORS directly WITHOUT calling better-auth
        if (c.req.method === "OPTIONS" && origin === allowedOrigin) {
          return c.body(null, 204, {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods":
              "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          });
        }

        // For other methods, call better-auth
        const response = await auth.handler(c.req.raw);

        // ALWAYS set correct CORS headers for auth routes
        if (origin === allowedOrigin) {
          const headers = new Headers(response.headers);
          headers.delete("Access-Control-Allow-Origin");
          headers.delete("Vary");
          headers.set("Access-Control-Allow-Origin", origin);
          headers.set("Access-Control-Allow-Credentials", "true");

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }

        return response;
      }

      // Standard CORS for all other routes
      if (origin === allowedOrigin) {
        c.header("Access-Control-Allow-Origin", origin);
        c.header("Access-Control-Allow-Credentials", "true");
        c.header(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        );
        c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      }

      // Handle OPTIONS preflight
      if (c.req.method === "OPTIONS") {
        return c.body(null, 204);
      }

      await next();
    });

    // ====== Public Endpoints ======

    // Gateway health
    app.get("/health", (c) =>
      c.json({
        status: "ok",
        service: "api-gateway",
        timestamp: Date.now(),
      })
    );

    // All services health
    app.get("/health/services", (c) => {
      const health = gateway.getAggregatedHealth();
      const allHealth = gateway.getRegistry().getAllServicesHealth();

      return c.json(
        {
          gateway: "ok",
          services: allHealth,
          summary: {
            healthy: allHealth.filter((s) => s.healthy).length,
            total: allHealth.length,
            allHealthy: health.allHealthy,
          },
          timestamp: Date.now(),
        },
        health.allHealthy ? 200 : 503
      );
    });

    // Root endpoint
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
          analytics: "/api/analytics/*",
          onChain: "/api/on-chain/*",
          screener: "/api/screener/*",
          macroData: "/api/macro/*",
          ml: "/api/ml/*",
          websocket: "ws://localhost:3000/ws",
        },
      })
    );

    // Authentication via Better-Auth
    // Handled by app.all("/api/auth/*") above

    // ====== Protected API Endpoints ======

    // Apply auth middleware to all /api/* requests (except /api/auth/*)
    app.use("/api/*", authMiddleware);

    // Apply rate limiting in production
    if (process.env.NODE_ENV === "production") {
      app.use("/api/*", rateLimitMiddleware);
    }

    // Exchange credentials router (Gateway-specific)
    // Create logger instance for exchange router
    const winstonLogger = createLogger({ service: "gateway-exchange" });
    const exchangeRouter = createExchangeCredentialsRouter({
      prisma: db,
      logger: new Logger(winstonLogger),
    });
    app.route("/api/exchange-credentials", exchangeRouter);

    // Admin users router (Gateway-specific, admin only)
    const adminLogger = createLogger({ service: "gateway-admin" });
    const adminUsersRouter = createAdminUsersRouter({
      prisma: db,
      logger: new Logger(adminLogger),
    });
    // Apply admin middleware to admin routes
    app.use("/api/admin/*", adminMiddleware);
    app.route("/api/admin/users", adminUsersRouter);

    // ====== Proxy Routes ======

    // Setup proxy routes for all registered services
    gateway.setupProxyRoutes(app);
  },

  // Dependencies
  dependencies: {
    nats: true,
    postgres: true,
    clickhouse: false,
  },

  // WebSocket configuration
  websocket: {
    enabled: true,
    path: "/ws",
    handlers: {
      open: (ws) => websocketHandlers.open(ws),
      message: (ws, message) => websocketHandlers.message(ws, message),
      close: (ws, code, reason) => websocketHandlers.close(ws, code, reason),
    },
  },
});

export default service;
