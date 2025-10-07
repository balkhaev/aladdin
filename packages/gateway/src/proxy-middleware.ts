/**
 * Proxy Middleware
 * Forwards requests to microservices with retry and circuit breaker support
 */

import { ServiceConstants } from "@aladdin/core/config";
import type { Logger } from "@aladdin/logger";
import { CircuitBreaker } from "@aladdin/resilience/circuit-breaker";
import { retryWithBackoff } from "@aladdin/resilience/retry";
import type { Context, MiddlewareHandler } from "hono";
import type { ServiceRegistry } from "./service-registry";

export type ProxyConfig = {
  serviceRegistry: ServiceRegistry;
  logger?: Logger;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  timeout?: number;
  getUserId?: (c: Context) => string | undefined;
  pathRewrite?: string; // e.g., "/api/macro/*" -> "/api/market-data/macro/*"
  skipHealthCheck?: boolean; // Skip health check and try to forward anyway (useful during dev startup)
};

export type PathRewriteRule = {
  target: string;
  rewrite: string;
};

/**
 * Create proxy middleware for a specific service
 */
export function createProxyMiddleware(
  serviceName: string,
  config: ProxyConfig
): MiddlewareHandler {
  const {
    serviceRegistry,
    logger,
    enableRetry = true,
    enableCircuitBreaker = true,
    timeout = 10_000,
    getUserId,
    pathRewrite,
    skipHealthCheck = false,
  } = config;

  // Create circuit breaker for this service
  const circuitBreaker = enableCircuitBreaker
    ? new CircuitBreaker({
        timeout: ServiceConstants.CIRCUIT_BREAKER.TIMEOUT,
        errorThresholdPercentage: 50,
        minimumRequests: 10,
        resetTimeout: ServiceConstants.CIRCUIT_BREAKER.RESET_TIMEOUT,
        successThreshold: 2,
        name: serviceName,
        logger,
      })
    : null;

  return async (c: Context) => {
    const serviceUrl = serviceRegistry.getServiceUrl(serviceName);

    if (!serviceUrl) {
      logger?.error("Service not found in registry", { service: serviceName });
      return c.json(
        {
          success: false,
          error: {
            code: "SERVICE_NOT_FOUND",
            message: `Service ${serviceName} is not registered`,
          },
          timestamp: Date.now(),
        },
        ServiceConstants.HTTP.SERVICE_UNAVAILABLE
      );
    }

    // Check service health (unless skipHealthCheck is enabled)
    // In dev mode with skipHealthCheck, we'll try to forward the request anyway
    // This helps during startup when services may not have passed health checks yet
    const shouldCheckHealth = !skipHealthCheck;
    const isServiceHealthy = serviceRegistry.isServiceHealthy(serviceName);

    if (shouldCheckHealth && !isServiceHealthy) {
      logger?.warn("Service is unhealthy", { service: serviceName });
      return c.json(
        {
          success: false,
          error: {
            code: "SERVICE_UNHEALTHY",
            message: `Service ${serviceName} is currently unavailable`,
          },
          timestamp: Date.now(),
        },
        ServiceConstants.HTTP.SERVICE_UNAVAILABLE
      );
    }

    // Build target URL with optional path rewriting
    let path = c.req.path;

    // Apply path rewrite if configured
    // Example: original pattern = "/api/macro/*" (from route config)
    //          pathRewrite = "/api/market-data/macro/*"
    //          originalPath = "/api/macro/global"
    //          result = "/api/market-data/macro/global"
    if (pathRewrite?.includes("*")) {
      const rewriteBase = pathRewrite.replace("/*", "");

      // Extract the wildcard part from original path
      // We need to figure out where the pattern ends and the wildcard begins
      // Pattern: /api/macro/* matches /api/macro/anything/here
      // So we take everything after /api/macro/ and append to rewrite base

      // Simple approach: find common ancestor in path structure
      const pathParts = path.split("/").filter(Boolean);
      const rewriteParts = rewriteBase.split("/").filter(Boolean);

      // Find where they diverge (usually after "api")
      // Example: ["api", "macro", "global"] vs ["api", "market-data", "macro"]
      // They diverge at index 1, so take pathParts from index 2 onwards
      let divergeIndex = 0;
      for (
        let i = 0;
        i < Math.min(pathParts.length, rewriteParts.length);
        i++
      ) {
        if (pathParts[i] !== rewriteParts[i]) {
          divergeIndex = i;
          break;
        }
      }

      // If no divergence found but rewrite is longer, use rewrite length as cutoff
      if (divergeIndex === 0 && rewriteParts.length > pathParts.length) {
        divergeIndex = pathParts.length;
      }

      // Take remaining path parts after divergence
      const remainingParts = pathParts.slice(divergeIndex + 1);

      // Build final path
      if (remainingParts.length > 0) {
        path = `${rewriteBase}/${remainingParts.join("/")}`;
      } else {
        path = rewriteBase;
      }

      logger?.debug("Path rewrite applied", {
        original: c.req.path,
        rewritten: path,
        pathRewrite,
        pathParts,
        rewriteParts,
        divergeIndex,
        remainingParts,
      });
    }

    const query = new URL(c.req.url).search;
    const targetUrl = `${serviceUrl}${path}${query}`;

    logger?.debug("Proxying request", {
      service: serviceName,
      method: c.req.method,
      path,
      targetUrl,
    });

    // Proxy function
    const proxyRequest = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        // Forward headers (except host)
        const headers = new Headers();
        for (const [key, value] of c.req.raw.headers) {
          if (key.toLowerCase() !== "host") {
            headers.set(key, value);
          }
        }

        // Add user ID if available
        const userId = getUserId ? getUserId(c) : undefined;
        if (userId) {
          headers.set("x-user-id", userId);
        } else {
          // Fallback to test-user if not authenticated
          headers.set("x-user-id", "test-user");
        }

        // Add gateway forwarding header
        headers.set("x-gateway-forwarded", "true");

        // Normalize Accept-Encoding to avoid Bun's zstd decompression bug
        // and prevent forwarding encodings we can't reliably stream
        const originalAcceptEncoding = headers.get("accept-encoding");
        if (originalAcceptEncoding) {
          const filteredEncodings = originalAcceptEncoding
            .split(",")
            .map((encoding) => encoding.trim())
            .filter(Boolean)
            .filter((encoding) => !encoding.toLowerCase().includes("zstd"));

          if (filteredEncodings.length > 0) {
            headers.set("accept-encoding", filteredEncodings.join(", "));
          } else {
            headers.set("accept-encoding", "identity");
          }
        } else {
          headers.set("accept-encoding", "identity");
        }

        // Get request body if present
        const body = ["POST", "PUT", "PATCH"].includes(c.req.method)
          ? await c.req.text()
          : undefined;

        const response = await fetch(targetUrl, {
          method: c.req.method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Forward response headers
        const responseHeaders = new Headers();
        for (const [key, value] of response.headers) {
          responseHeaders.set(key, value);
        }

        // Response body is already decoded by fetch(), so drop upstream encoding headers
        if (responseHeaders.has("content-encoding")) {
          responseHeaders.delete("content-encoding");
          responseHeaders.delete("content-length");
        }

        // Add CORS headers
        const origin = c.req.header("origin");
        const allowedOrigin =
          process.env.CORS_ORIGIN || "http://localhost:3001";
        if (origin === allowedOrigin) {
          responseHeaders.set("Access-Control-Allow-Origin", origin);
          responseHeaders.set("Access-Control-Allow-Credentials", "true");
          responseHeaders.set(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, PATCH, OPTIONS"
          );
          responseHeaders.set(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
          );
        }

        // Forward response
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        clearTimeout(timeoutId);

        if ((error as Error).name === "AbortError") {
          logger?.error("Request timeout", {
            service: serviceName,
            targetUrl,
          });
          return c.json(
            {
              success: false,
              error: {
                code: "TIMEOUT",
                message: "Request timeout",
              },
              timestamp: Date.now(),
            },
            ServiceConstants.HTTP.SERVICE_UNAVAILABLE
          );
        }

        logger?.error("Proxy request failed", {
          service: serviceName,
          error: error instanceof Error ? error.message : String(error),
        });

        return c.json(
          {
            success: false,
            error: {
              code: "PROXY_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            timestamp: Date.now(),
          },
          ServiceConstants.HTTP.INTERNAL_ERROR
        );
      }
    };

    // Execute with protection
    try {
      let result: Response;

      if (circuitBreaker && enableCircuitBreaker) {
        // With circuit breaker
        if (enableRetry && c.req.method === "GET") {
          // Retry only for GET requests
          result = await retryWithBackoff(
            () => circuitBreaker.execute(proxyRequest),
            {
              maxAttempts: 2, // Limited retries for proxy
              initialDelay: 500,
              maxDelay: 2000,
              multiplier: 2,
              onRetry: (error, attempt) => {
                logger?.warn("Retrying proxy request", {
                  service: serviceName,
                  attempt,
                  error: error instanceof Error ? error.message : String(error),
                });
              },
            }
          );
        } else {
          result = await circuitBreaker.execute(proxyRequest);
        }
      } else if (enableRetry && c.req.method === "GET") {
        // Retry without circuit breaker (GET only)
        result = await retryWithBackoff(proxyRequest, {
          maxAttempts: 2,
          initialDelay: 500,
          maxDelay: 2000,
          multiplier: 2,
        });
      } else {
        // No protection
        result = await proxyRequest();
      }

      return result;
    } catch (error) {
      logger?.error("Failed to proxy request", {
        service: serviceName,
        error: error instanceof Error ? error.message : String(error),
      });

      return c.json(
        {
          success: false,
          error: {
            code: "PROXY_FAILURE",
            message:
              error instanceof Error
                ? error.message
                : "Failed to proxy request",
          },
          timestamp: Date.now(),
        },
        ServiceConstants.HTTP.INTERNAL_ERROR
      );
    }
  };
}

/**
 * Create proxy middleware with path rewriting
 */
export function createProxyWithRewrite(
  config: ProxyConfig,
  rewriteRules: Record<string, PathRewriteRule>
): MiddlewareHandler {
  return async (c: Context, next) => {
    const path = c.req.path;

    // Find matching rewrite rule
    for (const [pattern, rule] of Object.entries(rewriteRules)) {
      // Simple pattern matching (supports wildcards)
      const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
      if (regex.test(path)) {
        // Rewrite path
        const newPath = path.replace(
          new RegExp(`^${pattern.replace(/\*/g, "(.*)")}`),
          rule.rewrite
        );

        // Create new request with rewritten path
        const url = new URL(c.req.url);
        url.pathname = newPath;

        // Proxy to target service
        const middleware = createProxyMiddleware(rule.target, config);
        return await middleware(
          {
            ...c,
            req: {
              ...c.req,
              path: newPath,
              url: url.toString(),
            },
          } as Context,
          next
        );
      }
    }

    // No rewrite rule matched, continue
    return await next();
  };
}
