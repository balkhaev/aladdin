import type { PrismaClient } from "@aladdin/database";
import { encrypt } from "@aladdin/shared/crypto";
import type { Logger } from "@aladdin/shared/logger";
import { Hono } from "hono";
import { createAuditLog, getAuditLogs } from "../utils/audit";

type ExchangeCredentialsRouterConfig = {
  prisma: PrismaClient;
  logger: Logger;
};

export function createExchangeCredentialsRouter(
  config: ExchangeCredentialsRouterConfig
) {
  const app = new Hono();
  const { prisma, logger } = config;

  /**
   * GET /api/exchange-credentials - Get user's exchange credentials
   */
  app.get("/", async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";

      const credentials = await prisma.exchangeCredentials.findMany({
        where: { userId },
        select: {
          id: true,
          exchange: true,
          label: true,
          apiKey: true,
          testnet: true,
          isActive: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          // Don't expose apiSecret
        },
        orderBy: { createdAt: "desc" },
      });

      return c.json({
        success: true,
        data: credentials,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to get exchange credentials", error);
      return c.json(
        {
          success: false,
          error: {
            code: "GET_CREDENTIALS_ERROR",
            message: "Failed to retrieve credentials",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * POST /api/exchange-credentials - Add new exchange credentials
   */
  app.post("/", async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";

      const body = await c.req.json();
      const { exchange, label, apiKey, apiSecret, testnet = false } = body;

      // Validate required fields
      if (!(exchange && label && apiKey && apiSecret)) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message:
                "Missing required fields: exchange, label, apiKey, apiSecret",
            },
            timestamp: Date.now(),
          },
          400
        );
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        logger.error(`User not found: ${userId}`);
        return c.json(
          {
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found. Please ensure you're authenticated.",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      // Encrypt API secret
      const encryptedSecret = encrypt(apiSecret);

      const credentials = await prisma.exchangeCredentials.create({
        data: {
          userId,
          exchange: exchange.toLowerCase(),
          label,
          apiKey,
          apiSecret: encryptedSecret.encrypted,
          apiSecretIv: encryptedSecret.iv,
          apiSecretAuthTag: encryptedSecret.authTag,
          testnet: testnet === true,
        },
        select: {
          id: true,
          exchange: true,
          label: true,
          apiKey: true,
          testnet: true,
          isActive: true,
          category: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info("Exchange credentials added", {
        userId,
        credentialsId: credentials.id,
        exchange: credentials.exchange,
      });

      // Create audit log
      await createAuditLog(prisma, logger, {
        userId,
        action: "CREATE",
        resource: "exchange_credentials",
        resourceId: credentials.id,
        details: {
          exchange: credentials.exchange,
          label: credentials.label,
          testnet: credentials.testnet,
        },
        ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
      });

      return c.json({
        success: true,
        data: credentials,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to add exchange credentials", error);
      return c.json(
        {
          success: false,
          error: {
            code: "ADD_CREDENTIALS_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to add credentials",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * PATCH /api/exchange-credentials/:id - Update credentials
   */
  app.patch("/:id", async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const credentialsId = c.req.param("id");

      const body = await c.req.json();
      const { label, isActive, apiSecret, category } = body;

      // Check ownership
      const existing = await prisma.exchangeCredentials.findFirst({
        where: { id: credentialsId, userId },
      });

      if (!existing) {
        return c.json(
          {
            success: false,
            error: {
              code: "CREDENTIALS_NOT_FOUND",
              message: "Credentials not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      // Prepare update data
      const updateData: {
        label?: string;
        isActive?: boolean;
        apiSecret?: string;
        apiSecretIv?: string;
        apiSecretAuthTag?: string;
        category?: string;
      } = {};

      if (label) {
        updateData.label = label;
      }

      if (typeof isActive === "boolean") {
        updateData.isActive = isActive;
      }

      if (apiSecret) {
        const encryptedSecret = encrypt(apiSecret);
        updateData.apiSecret = encryptedSecret.encrypted;
        updateData.apiSecretIv = encryptedSecret.iv;
        updateData.apiSecretAuthTag = encryptedSecret.authTag;
      }

      if (category) {
        updateData.category = category;
      }

      const credentials = await prisma.exchangeCredentials.update({
        where: { id: credentialsId },
        data: updateData,
        select: {
          id: true,
          exchange: true,
          label: true,
          apiKey: true,
          testnet: true,
          isActive: true,
          category: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info("Exchange credentials updated", {
        userId,
        credentialsId: credentials.id,
      });

      // Create audit log
      await createAuditLog(prisma, logger, {
        userId,
        action: "UPDATE",
        resource: "exchange_credentials",
        resourceId: credentials.id,
        details: {
          changes: Object.keys(updateData),
        },
        ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
      });

      return c.json({
        success: true,
        data: credentials,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to update exchange credentials", error);
      return c.json(
        {
          success: false,
          error: {
            code: "UPDATE_CREDENTIALS_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to update credentials",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * DELETE /api/exchange-credentials/:id - Delete credentials
   */
  app.delete("/:id", async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const credentialsId = c.req.param("id");

      // Check ownership
      const existing = await prisma.exchangeCredentials.findFirst({
        where: { id: credentialsId, userId },
      });

      if (!existing) {
        return c.json(
          {
            success: false,
            error: {
              code: "CREDENTIALS_NOT_FOUND",
              message: "Credentials not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      await prisma.exchangeCredentials.delete({
        where: { id: credentialsId },
      });

      logger.info("Exchange credentials deleted", {
        userId,
        credentialsId,
      });

      // Create audit log
      await createAuditLog(prisma, logger, {
        userId,
        action: "DELETE",
        resource: "exchange_credentials",
        resourceId: credentialsId,
        details: {
          exchange: existing.exchange,
          label: existing.label,
        },
        ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
        userAgent: c.req.header("user-agent"),
      });

      return c.json({
        success: true,
        data: { deleted: true },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to delete exchange credentials", error);
      return c.json(
        {
          success: false,
          error: {
            code: "DELETE_CREDENTIALS_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "Failed to delete credentials",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * GET /api/exchange-credentials/audit - Get audit logs
   */
  app.get("/audit", async (c) => {
    try {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";

      const resource = c.req.query("resource");
      const action = c.req.query("action");
      const limit = Number(c.req.query("limit")) || 50;
      const offset = Number(c.req.query("offset")) || 0;

      const result = await getAuditLogs(prisma, userId, {
        resource,
        action,
        limit,
        offset,
      });

      return c.json({
        success: true,
        data: {
          items: result.logs,
          total: result.total,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          hasNext: offset + limit < result.total,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to get audit logs", error);
      return c.json(
        {
          success: false,
          error: {
            code: "GET_AUDIT_LOGS_ERROR",
            message: "Failed to retrieve audit logs",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  return app;
}
