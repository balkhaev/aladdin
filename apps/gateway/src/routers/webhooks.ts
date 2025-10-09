import type { PrismaClient } from "@aladdin/database";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Logger } from "@aladdin/logger";
import { Hono } from "hono";

type CreateWebhookInput = {
  name: string;
};

type UpdateWebhookInput = {
  isActive?: boolean;
  name?: string;
};

export function createWebhooksRouter({
  prisma,
  logger,
}: {
  prisma: PrismaClient;
  logger: Logger;
}) {
  const app = new Hono();

  /**
   * GET /api/admin/webhooks - Список всех вебхуков
   */
  app.get("/", async (c) => {
    try {
      const webhooks = await prisma.webhook.findMany({
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return c.json(createSuccessResponse(webhooks));
    } catch (error) {
      logger.error("Failed to fetch webhooks", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "FETCH_WEBHOOKS_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * POST /api/admin/webhooks - Создать вебхук
   */
  app.post("/", async (c) => {
    try {
      const user = c.get("user") as { id: string };
      const body = await c.req.json<CreateWebhookInput>();

      // Валидация
      if (!body.name || body.name.trim().length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: "INVALID_INPUT",
              message: "Webhook name is required",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Генерировать секретный токен
      const secret = crypto.randomUUID();

      const webhook = await prisma.webhook.create({
        data: {
          name: body.name.trim(),
          secret,
          createdById: user.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logger.info("Webhook created", {
        webhookId: webhook.id,
        name: webhook.name,
        createdBy: user.id,
      });

      return c.json(createSuccessResponse(webhook), HTTP_STATUS.CREATED);
    } catch (error) {
      logger.error("Failed to create webhook", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "CREATE_WEBHOOK_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * PATCH /api/admin/webhooks/:id - Обновить вебхук
   */
  app.patch("/:id", async (c) => {
    try {
      const id = c.req.param("id");
      const body = await c.req.json<UpdateWebhookInput>();

      // Проверить существование
      const existing = await prisma.webhook.findUnique({
        where: { id },
      });

      if (!existing) {
        return c.json(
          {
            success: false,
            error: {
              code: "WEBHOOK_NOT_FOUND",
              message: "Webhook not found",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      // Обновить
      const webhook = await prisma.webhook.update({
        where: { id },
        data: {
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(body.name && { name: body.name.trim() }),
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      logger.info("Webhook updated", {
        webhookId: id,
        changes: body,
      });

      return c.json(createSuccessResponse(webhook));
    } catch (error) {
      logger.error("Failed to update webhook", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "UPDATE_WEBHOOK_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * DELETE /api/admin/webhooks/:id - Удалить вебхук
   */
  app.delete("/:id", async (c) => {
    try {
      const id = c.req.param("id");

      // Проверить существование
      const existing = await prisma.webhook.findUnique({
        where: { id },
      });

      if (!existing) {
        return c.json(
          {
            success: false,
            error: {
              code: "WEBHOOK_NOT_FOUND",
              message: "Webhook not found",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      await prisma.webhook.delete({ where: { id } });

      logger.info("Webhook deleted", {
        webhookId: id,
      });

      return c.json(
        createSuccessResponse({
          message: "Webhook deleted",
        })
      );
    } catch (error) {
      logger.error("Failed to delete webhook", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "DELETE_WEBHOOK_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  return app;
}
