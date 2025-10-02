import { createLogger } from "@aladdin/shared/logger";
import type { Context } from "hono";

const logger = createLogger({ service: "gateway-proxy" });

const REQUEST_TIMEOUT_MS = 30_000; // 30 секунд
const SERVICE_UNAVAILABLE_CODE = 503;

type ProxyOptions = {
  targetUrl: string;
  serviceName: string;
};

/**
 * Создает middleware для проксирования запросов к микросервисам
 */
export function proxyToService({ targetUrl, serviceName }: ProxyOptions) {
  return async (c: Context) => {
    const startTime = Date.now();
    const path = c.req.path;

    // Формируем URL для проксирования
    const url = new URL(path, targetUrl);

    // Копируем query parameters
    const searchParams = new URL(c.req.url).searchParams;
    url.search = searchParams.toString();

    // Копируем headers, кроме некоторых служебных
    const headers = new Headers(c.req.raw.headers);
    headers.delete("host"); // Удаляем host header
    headers.delete("connection"); // Удаляем connection header

    // Добавляем информацию о пользователе если есть
    const user = c.get("user");
    if (user?.id) {
      headers.set("x-user-id", user.id);
    } else {
      // Fallback к test-user если не авторизован
      headers.set("x-user-id", "test-user");
    }

    try {
      logger.info("Proxying request", {
        method: c.req.method,
        path,
        targetUrl: url.toString(),
        serviceName,
        userId: user?.id,
      });

      // Проксируем запрос
      const response = await fetch(url.toString(), {
        method: c.req.method,
        headers,
        body:
          c.req.method !== "GET" && c.req.method !== "HEAD"
            ? await c.req.raw.clone().text()
            : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const duration = Date.now() - startTime;

      logger.info("Proxy response", {
        method: c.req.method,
        path,
        serviceName,
        statusCode: response.status,
        duration,
      });

      // Читаем body для правильной обработки JSON ответов
      const contentType = response.headers.get("content-type");
      const isJson = contentType?.includes("application/json");

      if (isJson) {
        // Для JSON ответов (включая ошибки) читаем и парсим body
        const data = await response.json();
        const jsonStr = JSON.stringify(data);

        // Копируем все заголовки из оригинального ответа
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("content-type", "application/json");
        responseHeaders.set(
          "content-length",
          new TextEncoder().encode(jsonStr).length.toString()
        );

        return new Response(jsonStr, {
          status: response.status,
          headers: responseHeaders,
        });
      }

      // Для не-JSON ответов проксируем как есть
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error("Proxy error", {
        method: c.req.method,
        path,
        serviceName,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Возвращаем ошибку Service Unavailable
      return c.json(
        {
          success: false,
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: `${serviceName} service is temporarily unavailable`,
          },
          timestamp: Date.now(),
        },
        SERVICE_UNAVAILABLE_CODE
      );
    }
  };
}
