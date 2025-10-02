import { createLogger } from "@aladdin/shared/logger";
import { createMiddleware } from "hono/factory";
import { auth } from "../lib/auth";

const logger = createLogger({ service: "gateway-auth" });

const UNAUTHORIZED_CODE = 401;
const INTERNAL_ERROR_CODE = 500;

/**
 * Публичные эндпоинты, которые не требуют аутентификации
 */
const PUBLIC_PATHS = [
  "/api/auth/sign-in",
  "/api/auth/sign-up",
  "/api/auth/sign-out",
  "/api/market-data", // Market data доступна публично
  "/api/on-chain", // On-chain metrics доступны публично
  "/api/macro", // Macro data доступна публично
  "/api/trading", // Временно для тестирования
  "/api/portfolio", // Временно для тестирования
  "/api/risk", // Временно для тестирования
  "/api/analytics", // Временно для тестирования
  "/api/exchange-credentials", // Временно для тестирования
  "/health",
  "/health/services",
];

/**
 * Middleware для проверки аутентификации
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  const path = c.req.path;

  // Проверяем, является ли путь публичным
  const isPublicPath = PUBLIC_PATHS.some((publicPath) =>
    path.startsWith(publicPath)
  );

  if (isPublicPath) {
    return await next();
  }

  try {
    // Проверяем сессию через Better-Auth
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      logger.warn("Unauthorized request", {
        path,
        method: c.req.method,
        ip: c.req.header("x-forwarded-for"),
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
        UNAUTHORIZED_CODE
      );
    }

    // Добавляем user в context для использования в других middleware
    c.set("user", session.user);

    logger.debug("Authenticated request", {
      path,
      method: c.req.method,
      userId: session.user.id,
    });

    await next();
  } catch (error) {
    logger.error("Auth middleware error", {
      path,
      error: error instanceof Error ? error.message : String(error),
    });

    return c.json(
      {
        success: false,
        error: {
          code: "AUTH_ERROR",
          message: "Authentication check failed",
        },
        timestamp: Date.now(),
      },
      INTERNAL_ERROR_CODE
    );
  }
});
