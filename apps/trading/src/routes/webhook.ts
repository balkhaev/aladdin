import type { PrismaClient } from "@aladdin/database";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Logger } from "@aladdin/logger";
import type { Hono } from "hono";
import type { StrategyExecutor } from "../services/executor";
import type { ProcessedSignal } from "../services/signal-processor";

type WebhookSignal = {
  side: "buy" | "sell";
  entry?: number;
  tp?: number[] | Array<{ size: number; price: number }>;
  sl?: number;
  symbol?: string;
};

/**
 * Helper: Extract first take profit price from tp array
 */
function extractTakeProfitPrice(
  tp?: number[] | Array<{ size: number; price: number }>
): number | null {
  if (!Array.isArray(tp) || tp.length === 0) {
    return null;
  }

  const first = tp[0];
  if (typeof first === "number") {
    return first;
  }

  return first?.price || null;
}

/**
 * Helper: Validate webhook signal side
 */
function isValidSide(side: string): side is "buy" | "sell" {
  return side === "buy" || side === "sell";
}

/**
 * Helper: Create error response
 */
function createErrorResponse(code: string, message: string, status: number) {
  return {
    response: {
      success: false,
      error: { code, message },
      timestamp: Date.now(),
    },
    status,
  };
}

/**
 * Helper: Validate signal side field
 */
function validateSignalSide(body: WebhookSignal) {
  if (!body.side) {
    return createErrorResponse(
      "INVALID_SIGNAL",
      "Invalid side, must be 'buy' or 'sell'",
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (!isValidSide(body.side)) {
    return createErrorResponse(
      "INVALID_SIGNAL",
      "Invalid side, must be 'buy' or 'sell'",
      HTTP_STATUS.BAD_REQUEST
    );
  }

  return null;
}

/**
 * Helper: Validate webhook and return webhook data or error
 */
async function validateWebhook(
  webhookId: string,
  secret: string,
  prisma: PrismaClient,
  logger: Logger
) {
  const webhook = await prisma.webhook.findUnique({
    where: { id: webhookId },
    include: { createdBy: true },
  });

  if (!webhook) {
    return {
      error: createErrorResponse(
        "WEBHOOK_NOT_FOUND",
        "Webhook not found",
        HTTP_STATUS.NOT_FOUND
      ),
    };
  }

  if (webhook.secret !== secret) {
    logger.warn("Invalid webhook token", { webhookId });
    return {
      error: createErrorResponse(
        "INVALID_TOKEN",
        "Invalid token",
        HTTP_STATUS.UNAUTHORIZED
      ),
    };
  }

  if (!webhook.isActive) {
    return {
      error: createErrorResponse(
        "WEBHOOK_DISABLED",
        "Webhook is disabled",
        HTTP_STATUS.FORBIDDEN
      ),
    };
  }

  return { webhook };
}

export function setupWebhookRoutes(
  app: Hono,
  executor: StrategyExecutor | undefined,
  prisma: PrismaClient,
  logger: Logger
) {
  /**
   * POST /api/trading/webhook/:webhookId - Прием вебхука
   * Публичный эндпоинт для получения торговых сигналов от внешних источников
   */
  app.post("/api/trading/webhook/:webhookId", async (c) => {
    const webhookId = c.req.param("webhookId");
    const secret = c.req.query("token");

    if (!secret) {
      return c.json(
        {
          success: false,
          error: { code: "MISSING_TOKEN", message: "Token required" },
          timestamp: Date.now(),
        },
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    // Валидация webhook
    const validation = await validateWebhook(webhookId, secret, prisma, logger);

    if (validation.error) {
      return c.json(validation.error.response, validation.error.status);
    }

    const { webhook } = validation;

    if (!webhook) {
      return c.json(
        {
          success: false,
          error: { code: "WEBHOOK_ERROR", message: "Unexpected error" },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const startTime = Date.now();
    const ipAddress =
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
    const logData: {
      success: boolean;
      statusCode: number;
      signal: string | null;
      response: string | null;
      error: string | null;
    } = {
      success: false,
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      signal: null,
      response: null,
      error: null,
    };

    try {
      const body = await c.req.json<WebhookSignal>();
      logData.signal = JSON.stringify(body);

      // Валидация базовых полей
      const validationError = validateSignalSide(body);
      if (validationError) {
        logData.statusCode = validationError.status;
        logData.error = validationError.response.error.message;

        await prisma.webhookLog.create({
          data: {
            webhookId,
            ...logData,
            duration: Date.now() - startTime,
            ipAddress,
          },
        });

        return c.json(validationError.response, validationError.status);
      }

      // Преобразовать в ProcessedSignal
      const signal: ProcessedSignal = {
        symbol: body.symbol || "BTCUSDT",
        recommendation: body.side === "buy" ? "BUY" : "SELL",
        confidence: 0.8,
        shouldExecute: true,
        source: "webhook" as const,
        timestamp: new Date(),
        positionSize: 0.02,
        stopLoss: body.sl,
        takeProfit: extractTakeProfitPrice(body.tp),
      };

      // Обновить статистику
      await prisma.webhook.update({
        where: { id: webhookId },
        data: {
          totalCalls: { increment: 1 },
          lastCalledAt: new Date(),
        },
      });

      logger.info("Webhook signal received", {
        webhookId,
        webhookName: webhook.name,
        userId: webhook.createdById,
        signal: body,
      });

      if (!executor) {
        logData.statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
        logData.error = "Executor not initialized";

        await prisma.webhookLog.create({
          data: {
            webhookId,
            ...logData,
            duration: Date.now() - startTime,
            ipAddress,
          },
        });

        return c.json(
          {
            success: false,
            error: {
              code: "EXECUTOR_NOT_READY",
              message: "Executor not initialized",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      // Выполнить сигнал
      const result = await executor.manualExecute(signal);

      const responseData = {
        strategy: webhook.name,
        webhookId,
        result,
      };

      logData.success = true;
      logData.statusCode = HTTP_STATUS.OK;
      logData.response = JSON.stringify(responseData);

      await prisma.webhookLog.create({
        data: {
          webhookId,
          ...logData,
          duration: Date.now() - startTime,
          ipAddress,
        },
      });

      return c.json(createSuccessResponse(responseData));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Webhook processing error", {
        webhookId,
        error: errorMessage,
      });

      logData.statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      logData.error = errorMessage;

      await prisma.webhookLog.create({
        data: {
          webhookId,
          ...logData,
          duration: Date.now() - startTime,
          ipAddress,
        },
      });

      return c.json(
        {
          success: false,
          error: {
            code: "WEBHOOK_PROCESSING_ERROR",
            message: errorMessage,
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });
}
