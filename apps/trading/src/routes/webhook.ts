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

    try {
      const body = await c.req.json<WebhookSignal>();

      // Валидация базовых полей
      const validationError = validateSignalSide(body);
      if (validationError) {
        return c.json(validationError.response, validationError.status);
      }

      // Преобразовать в ProcessedSignal
      const signal: ProcessedSignal = {
        symbol: body.symbol || "BTCUSDT", // Default symbol
        recommendation: body.side === "buy" ? "BUY" : "SELL",
        confidence: 0.8, // High confidence for webhook signals
        shouldExecute: true,
        source: "webhook" as const,
        timestamp: new Date(),
        positionSize: 0.02, // 2% position size
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

      return c.json(
        createSuccessResponse({
          strategy: webhook.name,
          webhookId,
          result,
        })
      );
    } catch (error) {
      logger.error("Webhook processing error", {
        webhookId,
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "WEBHOOK_PROCESSING_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });
}
