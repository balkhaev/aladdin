/**
 * Service Client для inter-service communication
 *
 * Предоставляет type-safe HTTP client с:
 * - Автоматическим retry logic
 * - Circuit breaker pattern
 * - Service discovery
 * - Централизованной обработкой ошибок
 */

import {
  ServiceConstants,
  ServicePorts,
  ServiceUrlResolver,
} from "@aladdin/core/config";
import type { Logger } from "@aladdin/logger";
import { CircuitBreaker } from "@aladdin/resilience/circuit-breaker";
import { retryWithBackoff } from "@aladdin/resilience/retry";
import { AppError, ErrorCode } from "./errors";

/**
 * Стандартный формат ответа от сервисов
 */
export type ServiceResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: number;
};

/**
 * Опции для Service Client
 */
export type ServiceClientOptions = {
  logger?: Logger;
  urlResolver?: ServiceUrlResolver;
  timeout?: number;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
};

/**
 * Опции для HTTP запроса
 */
export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retryable?: boolean;
};

/**
 * Service Client для межсервисного взаимодействия
 */
export class ServiceClient {
  private logger?: Logger;
  private urlResolver: ServiceUrlResolver;
  private timeout: number;
  private enableRetry: boolean;
  private enableCircuitBreaker: boolean;
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(options: ServiceClientOptions = {}) {
    this.logger = options.logger;
    this.urlResolver =
      options.urlResolver ??
      new ServiceUrlResolver({
        SERVICE_DISCOVERY: "local",
        NODE_ENV:
          (process.env.NODE_ENV as
            | "development"
            | "production"
            | "staging"
            | "test") ?? "development",
        LOG_LEVEL:
          (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error") ??
          "info",
        NATS_URL: process.env.NATS_URL ?? "nats://localhost:4222",
        CLICKHOUSE_HOST: process.env.CLICKHOUSE_HOST ?? "localhost",
        CLICKHOUSE_PORT: Number(process.env.CLICKHOUSE_PORT ?? 8123),
        CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE ?? "aladdin",
        CLICKHOUSE_USER: process.env.CLICKHOUSE_USER ?? "default",
        CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD ?? "",
        REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
      });
    this.timeout = options.timeout ?? ServiceConstants.CIRCUIT_BREAKER.TIMEOUT;
    this.enableRetry = options.enableRetry ?? true;
    this.enableCircuitBreaker = options.enableCircuitBreaker ?? true;
  }

  /**
   * Получить или создать Circuit Breaker для сервиса
   */
  private getCircuitBreaker(serviceName: string): CircuitBreaker {
    const existing = this.circuitBreakers.get(serviceName);
    if (existing) {
      return existing;
    }

    const breaker = new CircuitBreaker({
      timeout: ServiceConstants.CIRCUIT_BREAKER.TIMEOUT,
      errorThresholdPercentage: 50,
      minimumRequests: 10,
      resetTimeout: ServiceConstants.CIRCUIT_BREAKER.RESET_TIMEOUT,
      successThreshold: 2,
      name: serviceName,
      logger: this.logger,
    });
    this.circuitBreakers.set(serviceName, breaker);
    return breaker;
  }

  /**
   * Выполнить HTTP запрос
   */
  private async makeRequest<T>(
    url: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = "GET",
      headers = {},
      body,
      timeout = this.timeout,
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        signal: controller.signal,
      };

      if (body) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AppError(
          ErrorCode.EXCHANGE_API_ERROR,
          `Service request failed: ${response.status} ${response.statusText}`,
          response.status,
          errorData
        );
      }

      const data = (await response.json()) as ServiceResponse<T>;

      if (!data.success) {
        throw new AppError(
          data.error?.code ?? ErrorCode.EXCHANGE_API_ERROR,
          data.error?.message ?? "Service returned error",
          response.status,
          data.error?.details
        );
      }

      return data.data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AppError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new AppError(
          ErrorCode.TIMEOUT,
          "Service request timeout",
          ServiceConstants.HTTP.SERVICE_UNAVAILABLE
        );
      }

      throw new AppError(
        ErrorCode.EXCHANGE_API_ERROR,
        error instanceof Error ? error.message : "Unknown error",
        ServiceConstants.HTTP.INTERNAL_ERROR
      );
    }
  }

  /**
   * Выполнить запрос с retry и circuit breaker
   */
  private executeWithProtection<T>(
    serviceName: string,
    fn: () => Promise<T>,
    retryable = true
  ): Promise<T> {
    const executeRequest = (): Promise<T> => {
      if (this.enableCircuitBreaker) {
        const breaker = this.getCircuitBreaker(serviceName);
        return breaker.execute(fn);
      }
      return fn();
    };

    if (this.enableRetry && retryable) {
      return retryWithBackoff(executeRequest, {
        maxAttempts: ServiceConstants.RETRY.MAX_ATTEMPTS,
        initialDelay: ServiceConstants.RETRY.INITIAL_DELAY,
        maxDelay: ServiceConstants.RETRY.MAX_DELAY,
        multiplier: ServiceConstants.RETRY.BACKOFF_FACTOR,
        onRetry: (error, attempt) => {
          this.logger?.warn(
            `Retrying ${serviceName} request (attempt ${attempt})`,
            {
              error: error instanceof Error ? error.message : String(error),
            }
          );
        },
      });
    }

    return executeRequest();
  }

  /**
   * GET запрос
   */
  async get<T>(
    serviceName: string,
    path: string,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    const port =
      ServicePorts[
        serviceName
          .toUpperCase()
          .replace(/-/g, "_") as keyof typeof ServicePorts
      ] ?? 3000;
    const baseUrl = this.urlResolver.resolve(serviceName, port);
    const url = `${baseUrl}${path}`;

    this.logger?.debug(`GET ${url}`);

    return await this.executeWithProtection(
      serviceName,
      () => this.makeRequest<T>(url, { ...options, method: "GET" }),
      options.retryable ?? true
    );
  }

  /**
   * POST запрос
   */
  async post<T>(
    serviceName: string,
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<T> {
    const port =
      ServicePorts[
        serviceName
          .toUpperCase()
          .replace(/-/g, "_") as keyof typeof ServicePorts
      ] ?? 3000;
    const baseUrl = this.urlResolver.resolve(serviceName, port);
    const url = `${baseUrl}${path}`;

    this.logger?.debug(`POST ${url}`, { body });

    return await this.executeWithProtection(
      serviceName,
      () => this.makeRequest<T>(url, { ...options, method: "POST", body }),
      options.retryable ?? false // POST обычно не retryable
    );
  }

  /**
   * PUT запрос
   */
  async put<T>(
    serviceName: string,
    path: string,
    body?: unknown,
    options: Omit<RequestOptions, "method"> = {}
  ): Promise<T> {
    const port =
      ServicePorts[
        serviceName
          .toUpperCase()
          .replace(/-/g, "_") as keyof typeof ServicePorts
      ] ?? 3000;
    const baseUrl = this.urlResolver.resolve(serviceName, port);
    const url = `${baseUrl}${path}`;

    this.logger?.debug(`PUT ${url}`, { body });

    return await this.executeWithProtection(
      serviceName,
      () => this.makeRequest<T>(url, { ...options, method: "PUT", body }),
      options.retryable ?? false
    );
  }

  /**
   * DELETE запрос
   */
  async delete<T>(
    serviceName: string,
    path: string,
    options: Omit<RequestOptions, "method" | "body"> = {}
  ): Promise<T> {
    const port =
      ServicePorts[
        serviceName
          .toUpperCase()
          .replace(/-/g, "_") as keyof typeof ServicePorts
      ] ?? 3000;
    const baseUrl = this.urlResolver.resolve(serviceName, port);
    const url = `${baseUrl}${path}`;

    this.logger?.debug(`DELETE ${url}`);

    return await this.executeWithProtection(
      serviceName,
      () => this.makeRequest<T>(url, { ...options, method: "DELETE" }),
      options.retryable ?? false
    );
  }

  /**
   * Проверить health check сервиса
   */
  async healthCheck(serviceName: string): Promise<{
    status: string;
    service: string;
    timestamp: string;
    uptime: number;
  }> {
    return await this.get(serviceName, "/health", { retryable: true });
  }

  /**
   * Получить статистику Circuit Breaker для сервиса
   */
  getCircuitBreakerStats(
    serviceName: string
  ): ReturnType<CircuitBreaker["getStats"]> | null {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return null;

    return breaker.getStats();
  }

  /**
   * Сбросить Circuit Breaker для сервиса
   */
  resetCircuitBreaker(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.reset();
      this.logger?.info(`Circuit breaker reset for ${serviceName}`);
    }
  }

  /**
   * Получить статистику всех Circuit Breakers
   */
  getAllCircuitBreakerStats(): Record<
    string,
    ReturnType<CircuitBreaker["getStats"]>
  > {
    const stats: Record<string, ReturnType<CircuitBreaker["getStats"]>> = {};
    for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
      stats[serviceName] = breaker.getStats();
    }
    return stats;
  }
}

/**
 * Type-safe методы для вызова конкретных сервисов
 */
export class TypedServiceClient extends ServiceClient {
  /**
   * Market Data Service
   */
  marketData = {
    getTickers: () =>
      this.get<string[]>("market-data", "/api/market-data/tickers"),

    getQuote: (symbol: string) =>
      this.get<{
        symbol: string;
        price: number;
        volume: number;
        change24h: number;
        timestamp: number;
      }>("market-data", `/api/market-data/quote/${symbol}`),

    getCandles: (symbol: string, timeframe: string, limit: number) =>
      this.get<
        Array<{
          timestamp: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
        }>
      >(
        "market-data",
        `/api/market-data/candles/${symbol}?timeframe=${timeframe}&limit=${limit}`
      ),
  };

  /**
   * Analytics Service
   */
  analytics = {
    getSentiment: (symbol: string) =>
      this.get<{
        symbol: string;
        score: number;
        confidence: number;
        timestamp: string;
      }>("analytics", `/api/analytics/sentiment/${symbol}`),

    getIndicators: (
      symbol: string,
      indicators: string[],
      timeframe: string,
      limit: number
    ) =>
      this.get(
        "analytics",
        `/api/analytics/indicators/${symbol}?indicators=${indicators.join(",")}&timeframe=${timeframe}&limit=${limit}`
      ),
  };

  /**
   * Trading Service
   */
  trading = {
    createOrder: (order: {
      portfolioId: string;
      symbol: string;
      type: string;
      side: string;
      quantity: number;
      price?: number;
      exchange: string;
      exchangeCredentialsId: string;
    }) => this.post("trading", "/api/trading/orders", order),

    getOrders: (params: {
      portfolioId?: string;
      symbol?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) => {
      const query = new URLSearchParams(
        params as Record<string, string>
      ).toString();
      return this.get("trading", `/api/trading/orders?${query}`);
    },
  };

  /**
   * Portfolio Service
   */
  portfolio = {
    getPortfolio: (portfolioId: string) =>
      this.get("portfolio", `/api/portfolio/${portfolioId}`),

    getPositions: (portfolioId: string) =>
      this.get("portfolio", `/api/portfolio/${portfolioId}/positions`),
  };

  /**
   * Scraper Service
   */
  scraper = {
    getSocialSentiment: (symbol: string) =>
      this.get<{
        symbol: string;
        overall: number;
        telegram: {
          score: number;
          bullish: number;
          bearish: number;
          signals: number;
        };
        twitter: {
          score: number;
          positive: number;
          negative: number;
          neutral: number;
          tweets: number;
        };
        confidence: number;
        timestamp: string;
      }>("scraper", `/api/social/sentiment/${symbol}`),
  };
}
