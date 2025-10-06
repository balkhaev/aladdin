/**
 * Service bootstrap utility
 * Provides standardized service initialization and lifecycle management
 */

import {
  type ClickHouseClient,
  createClickHouseClient,
} from "@aladdin/clickhouse";
import type { PrismaClient } from "@aladdin/database";
import { AppError } from "@aladdin/http/errors";
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
  HTTP_STATUS,
} from "@aladdin/http/responses";
import { createLogger, Logger } from "@aladdin/logger";
import { createNatsClient, type NatsClient } from "@aladdin/messaging";
import { TelemetryService, tracingMiddleware } from "@aladdin/telemetry";
import type { ServerWebSocket } from "bun";
import type { Context } from "hono";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import type { BaseService } from "./base-service";

const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

/**
 * Service bootstrap configuration
 */
export type ServiceBootstrapConfig<
  TService extends BaseService,
  TWebSocketData = unknown,
> = {
  // Service info
  serviceName: string;
  port?: number;
  idleTimeout?: number; // Timeout in seconds for idle connections (default: 10s)

  // Service factory
  createService: (deps: ServiceDependencies) => TService;

  // Optional: Setup routes
  setupRoutes?: (
    app: Hono,
    service: TService,
    deps: ServiceDependencies
  ) => void;

  // Optional: WebSocket configuration
  websocket?: {
    enabled: boolean;
    path?: string;
    handlers: {
      open?: (ws: ServerWebSocket<TWebSocketData>, service: TService) => void;
      message?: (
        ws: ServerWebSocket<TWebSocketData>,
        message: string,
        service: TService
      ) => void;
      close?: (
        ws: ServerWebSocket<TWebSocketData>,
        code: number,
        reason: string,
        service: TService
      ) => void;
    };
    createWebSocketData?: () => TWebSocketData;
  };

  // Optional: Dependencies configuration
  dependencies?: {
    nats?: boolean;
    postgres?: boolean;
    clickhouse?: boolean;
  };

  // Optional: Telemetry configuration
  telemetry?: {
    enabled?: boolean;
    enableTracing?: boolean;
    enableMetrics?: boolean;
    metricsPort?: number;
  };

  // Optional: Custom initialization
  beforeInit?: (deps: ServiceDependencies) => Promise<void>;
  afterInit?: (
    service: TService,
    deps: ServiceDependencies
  ) => Promise<void> | void;
};

/**
 * Service dependencies
 */
export type ServiceDependencies = {
  logger: Logger;
  natsClient?: NatsClient;
  prisma?: PrismaClient;
  clickhouse?: ClickHouseClient;
  telemetry?: TelemetryService;
};

/**
 * Initialize and start a service
 */
export async function initializeService<
  TService extends BaseService,
  TWebSocketData = unknown,
>(config: ServiceBootstrapConfig<TService, TWebSocketData>): Promise<void> {
  const {
    serviceName,
    port = 3000,
    idleTimeout = 10,
    createService,
    setupRoutes,
    websocket,
    dependencies = {},
    beforeInit,
    afterInit,
  } = config;

  // Create logger
  const winstonLogger = createLogger({
    service: serviceName,
    level: process.env.LOG_LEVEL ?? "info",
  });
  const logger = new Logger(winstonLogger);

  logger.info(`Starting ${serviceName} service...`);

  try {
    // Initialize dependencies
    const deps: ServiceDependencies = { logger };

    // Connect to NATS if needed
    if (dependencies.nats !== false) {
      try {
        deps.natsClient = await createNatsClient({
          servers: NATS_URL,
          logger,
        });
        logger.info("Connected to NATS");
      } catch (error) {
        logger.error(`Failed to connect to NATS ${NATS_URL}`, error);
        if (dependencies.nats === true) {
          throw error;
        }
      }
    }

    // Connect to PostgreSQL if needed
    if (dependencies.postgres) {
      try {
        const { PrismaClient: PostgresClient } = await import(
          "@aladdin/database"
        );
        deps.prisma = new PostgresClient();
        await deps.prisma.$connect();
        logger.info("Connected to PostgreSQL");
      } catch (error) {
        logger.error("Failed to connect to PostgreSQL", error);
        throw error;
      }
    }

    // Connect to ClickHouse if needed
    if (dependencies.clickhouse) {
      try {
        deps.clickhouse = createClickHouseClient({ logger });
        const isConnected = await deps.clickhouse.ping();
        if (isConnected) {
          logger.info("Connected to ClickHouse");
        } else {
          logger.warn("ClickHouse connection check failed");
        }
      } catch (error) {
        logger.error("Failed to connect to ClickHouse", error);
        // Don't throw - ClickHouse might not be critical
      }
    }

    // Initialize OpenTelemetry if enabled
    const telemetryConfig = config.telemetry ?? { enabled: true };
    if (telemetryConfig.enabled !== false) {
      try {
        deps.telemetry = new TelemetryService(
          {
            serviceName,
            enableTracing: telemetryConfig.enableTracing ?? true,
            enableMetrics: telemetryConfig.enableMetrics ?? true,
            metricsPort: telemetryConfig.metricsPort,
          },
          logger
        );
        await deps.telemetry.initialize();
      } catch (error) {
        logger.error("Failed to initialize OpenTelemetry", error);
        // Don't throw - telemetry is not critical
      }
    }

    // Run custom before init
    if (beforeInit) {
      await beforeInit(deps);
    }

    // Create service instance
    const service = createService(deps);

    // Initialize service
    await service.initialize();

    // Run custom after init
    if (afterInit) {
      await afterInit(service, deps);
    }

    // Create Hono app
    const app = new Hono();

    // Add global middleware
    // NOTE: CORS is handled in setupRoutes for each service
    app.use("*", honoLogger());

    // Add telemetry middleware if enabled
    if (deps.telemetry) {
      app.use("*", tracingMiddleware(deps.telemetry));
    }

    // Global error handler - must be set on app.onError, not as middleware
    app.onError((err, c) => {
      const isAppError = err instanceof AppError;
      const isDevelopment = process.env.NODE_ENV === "development";

      let details: unknown;
      if (isAppError) {
        details = err.details;
      } else if (isDevelopment) {
        details = err.stack;
      }

      const normalized = {
        code: isAppError ? err.code : ErrorCode.INTERNAL_ERROR,
        message: err.message || "An unexpected error occurred",
        statusCode: isAppError ? err.statusCode : HTTP_STATUS.INTERNAL_ERROR,
        details,
      };

      // Log error
      if (normalized.statusCode >= HTTP_STATUS.INTERNAL_ERROR) {
        logger.error(normalized.message, err, {
          code: normalized.code,
          path: c.req.path,
          method: c.req.method,
          details: normalized.details,
        });
      } else {
        logger.warn(normalized.message, {
          code: normalized.code,
          path: c.req.path,
          method: c.req.method,
          statusCode: normalized.statusCode,
        });
      }

      // Return error response
      const response = createErrorResponse(
        normalized.code,
        normalized.message,
        normalized.details
      );

      return c.json(response, normalized.statusCode as typeof HTTP_STATUS.OK);
    });

    // Health check endpoint
    app.get("/health", async (c) => {
      const health = await service.getHealth();
      const statusCode =
        health.status === "running" || health.status === "ready"
          ? HTTP_STATUS.OK
          : HTTP_STATUS.SERVICE_UNAVAILABLE;

      return c.json(health, statusCode);
    });

    // Setup service-specific routes
    if (setupRoutes) {
      setupRoutes(app, service, deps);
    }

    // Setup graceful shutdown
    const shutdown = async () => {
      logger.info("Shutdown signal received");
      try {
        await service.stop();

        if (deps.telemetry) {
          await deps.telemetry.shutdown();
          logger.info("OpenTelemetry shut down");
        }

        if (deps.prisma) {
          await deps.prisma.$disconnect();
          logger.info("Disconnected from PostgreSQL");
        }

        if (deps.natsClient) {
          await deps.natsClient.close();
          logger.info("Disconnected from NATS");
        }

        logger.info(`${serviceName} service stopped`);
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    // Start HTTP server
    if (websocket?.enabled) {
      // Server with WebSocket support
      const wsPath = websocket.path ?? "/ws";

      Bun.serve({
        port,
        idleTimeout,
        fetch(req, server) {
          const url = new URL(req.url);

          // WebSocket upgrade
          if (url.pathname === wsPath) {
            const success = server.upgrade(req, {
              data: websocket.createWebSocketData
                ? websocket.createWebSocketData()
                : {},
            });

            if (success) {
              return; // WebSocket upgraded
            }

            return new Response("WebSocket upgrade failed", {
              status: HTTP_STATUS.BAD_REQUEST,
            });
          }

          // HTTP routes through Hono
          return app.fetch(req);
        },
        websocket: {
          open(ws: ServerWebSocket<TWebSocketData>) {
            websocket.handlers.open?.(ws, service);
          },
          message(
            ws: ServerWebSocket<TWebSocketData>,
            message: string | Buffer
          ) {
            const messageStr =
              typeof message === "string" ? message : message.toString();
            websocket.handlers.message?.(ws, messageStr, service);
          },
          close(
            ws: ServerWebSocket<TWebSocketData>,
            code: number,
            reason: string
          ) {
            websocket.handlers.close?.(ws, code, reason, service);
          },
        },
      });

      logger.info(
        `${serviceName} service listening on http://localhost:${port}`
      );
      logger.info(
        `WebSocket server listening on ws://localhost:${port}${wsPath}`
      );
    } else {
      // Simple HTTP server
      Bun.serve({
        port,
        idleTimeout,
        fetch: app.fetch,
      });

      logger.info(
        `${serviceName} service listening on http://localhost:${port}`
      );
    }

    // Start service
    await service.start();
  } catch (error) {
    logger.error(`Failed to start ${serviceName} service`, error);
    process.exit(1);
  }
}

/**
 * Create a simple health check handler
 */
export function createHealthHandler(
  serviceName: string
): (c: Context) => Response | Promise<Response> {
  return (c: Context) =>
    c.json(
      createSuccessResponse({
        status: "ok",
        service: serviceName,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      })
    );
}
