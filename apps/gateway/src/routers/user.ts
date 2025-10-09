import type { PrismaClient } from "@aladdin/database";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Logger } from "@aladdin/logger";
import { Hono } from "hono";

type UpdateActiveExchangeInput = {
  activeExchangeCredentialsId: string | null;
};

export function createUserRouter({
  prisma,
  logger,
}: {
  prisma: PrismaClient;
  logger: Logger;
}) {
  const app = new Hono();

  /**
   * GET /api/user/active-exchange - Получить активный ключ
   */
  app.get("/active-exchange", async (c) => {
    try {
      const user = c.get("user") as { id: string };

      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          activeExchangeCredentialsId: true,
          activeExchangeCredentials: {
            select: {
              id: true,
              exchange: true,
              label: true,
              testnet: true,
            },
          },
        },
      });

      if (!userData) {
        return c.json(
          {
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      return c.json(createSuccessResponse(userData));
    } catch (error) {
      logger.error("Failed to fetch active exchange credentials", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "FETCH_ACTIVE_EXCHANGE_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * PATCH /api/user/active-exchange - Обновить активный ключ
   */
  app.patch("/active-exchange", async (c) => {
    try {
      const user = c.get("user") as { id: string };
      const body = await c.req.json<UpdateActiveExchangeInput>();

      // Если устанавливается ключ (не null), проверить что он принадлежит пользователю
      if (body.activeExchangeCredentialsId) {
        const credentials = await prisma.exchangeCredentials.findUnique({
          where: { id: body.activeExchangeCredentialsId },
        });

        if (!credentials) {
          return c.json(
            {
              success: false,
              error: {
                code: "CREDENTIALS_NOT_FOUND",
                message: "Exchange credentials not found",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.BAD_REQUEST
          );
        }

        if (credentials.userId !== user.id) {
          return c.json(
            {
              success: false,
              error: {
                code: "ACCESS_DENIED",
                message: "You do not have access to these credentials",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.FORBIDDEN
          );
        }

        if (!credentials.isActive) {
          return c.json(
            {
              success: false,
              error: {
                code: "CREDENTIALS_DISABLED",
                message: "These credentials are disabled",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.BAD_REQUEST
          );
        }
      }

      // Обновить активный ключ
      await prisma.user.update({
        where: { id: user.id },
        data: {
          activeExchangeCredentialsId: body.activeExchangeCredentialsId,
        },
      });

      logger.info("Active exchange credentials updated", {
        userId: user.id,
        credentialsId: body.activeExchangeCredentialsId,
      });

      return c.json(
        createSuccessResponse({
          message: "Active exchange credentials updated",
          activeExchangeCredentialsId: body.activeExchangeCredentialsId,
        })
      );
    } catch (error) {
      logger.error("Failed to update active exchange credentials", {
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "UPDATE_ACTIVE_EXCHANGE_FAILED",
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
