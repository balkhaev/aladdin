import { createLogger } from "@aladdin/logger";
import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

const logger = createLogger({ service: "gateway-rate-limit" });

const DEFAULT_WINDOW_MS = 60_000; // 1 минута
const DEFAULT_MAX_REQUESTS = 100; // 100 запросов
const TOO_MANY_REQUESTS_CODE = 429;

/**
 * Конфигурация rate limiting из переменных окружения
 */
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.RATE_LIMIT_WINDOW_MS || DEFAULT_WINDOW_MS
);
const RATE_LIMIT_MAX_REQUESTS = Number(
  process.env.RATE_LIMIT_MAX_REQUESTS || DEFAULT_MAX_REQUESTS
);

/**
 * Middleware для ограничения частоты запросов
 */
export const rateLimitMiddleware = rateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: "draft-6", // Добавляет заголовки RateLimit-*
  keyGenerator: (c: Context) => {
    // Rate limit по пользователю или IP адресу
    const user = c.get("user");
    if (user?.id) {
      return `user:${user.id}`;
    }

    // Используем IP адрес для неавторизованных пользователей
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "anonymous";

    return `ip:${ip}`;
  },
  handler: (c: Context) => {
    const key = c.get("user")?.id || c.req.header("x-forwarded-for");

    logger.warn("Rate limit exceeded", {
      key,
      path: c.req.path,
      method: c.req.method,
    });

    return c.json(
      {
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
        },
        timestamp: Date.now(),
      },
      TOO_MANY_REQUESTS_CODE
    );
  },
});

logger.info("Rate limiter configured", {
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: RATE_LIMIT_MAX_REQUESTS,
});
