import { createLogger } from "@aladdin/logger";

const logger = createLogger({ service: "gateway-health" });

const HEALTH_CHECK_TIMEOUT_MS = 5000;

type ServiceHealth = {
  status: "healthy" | "unhealthy" | "unknown";
  responseTime?: number;
  error?: string;
};

type ServicesHealth = {
  [serviceName: string]: ServiceHealth;
};

/**
 * Список микросервисов для проверки
 */
const SERVICES = {
  "market-data": process.env.MARKET_DATA_URL || "http://localhost:3010",
  trading: process.env.TRADING_URL || "http://localhost:3011",
  portfolio: process.env.PORTFOLIO_URL || "http://localhost:3012",
  risk: process.env.RISK_URL || "http://localhost:3013",
  analytics: process.env.ANALYTICS_URL || "http://localhost:3014",
  "on-chain": process.env.ON_CHAIN_URL || "http://localhost:3015",
  screener: process.env.SCREENER_URL || "http://localhost:3016",
  "macro-data": process.env.MACRO_DATA_URL || "http://localhost:3017",
};

/**
 * Проверяет здоровье одного сервиса
 */
async function checkService(
  serviceName: string,
  serviceUrl: string
): Promise<ServiceHealth> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${serviceUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: "healthy",
        responseTime,
      };
    }

    logger.warn("Service unhealthy", {
      serviceName,
      statusCode: response.status,
      responseTime,
    });

    return {
      status: "unhealthy",
      responseTime,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error("Service check failed", {
      serviceName,
      error: error instanceof Error ? error.message : String(error),
      responseTime,
    });

    return {
      status: "unhealthy",
      responseTime,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Проверяет здоровье всех микросервисов
 */
export async function checkAllServices(): Promise<ServicesHealth> {
  const checks = Object.entries(SERVICES).map(async ([name, url]) => {
    const health = await checkService(name, url);
    return [name, health] as const;
  });

  const results = await Promise.all(checks);

  return Object.fromEntries(results);
}

/**
 * Проверяет, все ли сервисы здоровы
 */
export function areAllServicesHealthy(services: ServicesHealth): boolean {
  return Object.values(services).every(
    (service) => service.status === "healthy"
  );
}

/**
 * Получает количество здоровых сервисов
 */
export function getHealthyServicesCount(services: ServicesHealth): {
  healthy: number;
  total: number;
} {
  const total = Object.keys(services).length;
  const healthy = Object.values(services).filter(
    (service) => service.status === "healthy"
  ).length;

  return { healthy, total };
}
