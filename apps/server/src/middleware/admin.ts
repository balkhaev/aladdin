import { createLogger } from "@aladdin/logger";
import { createMiddleware } from "hono/factory";
import db from "../db";

const logger = createLogger({ service: "gateway-admin" });

const FORBIDDEN_CODE = 403;
const INTERNAL_ERROR_CODE = 500;

/**
 * Middleware для проверки роли администратора
 */
export const adminMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;

  try {
    // Получаем user из context (установлен auth middleware)
    const user = c.get("user") as { id: string; email: string } | undefined;

    if (!user) {
      logger.warn("Admin middleware called without authenticated user", {
        path,
        method: c.req.method,
      });

      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
          timestamp: Date.now(),
        },
        401
      );
    }

    // Проверяем роль пользователя в базе
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser || dbUser.role !== "admin") {
      logger.warn("Access denied: user is not an admin", {
        path,
        method: c.req.method,
        userId: user.id,
        userEmail: user.email,
        userRole: dbUser?.role,
      });

      return c.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Admin access required",
          },
          timestamp: Date.now(),
        },
        FORBIDDEN_CODE
      );
    }

    logger.debug("Admin request authorized", {
      path,
      method: c.req.method,
      userId: user.id,
    });

    await next();
  } catch (error) {
    logger.error("Admin middleware error", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Admin check failed",
        },
        timestamp: Date.now(),
      },
      INTERNAL_ERROR_CODE
    );
  }
});
