/**
 * Trading Service Configuration
 * Централизованные константы для trading service
 */

import {
  ConfigSchemas,
  loadConfig,
  ServiceConstants,
  type TradingConfig,
} from "@aladdin/shared/config";

/**
 * Загрузить и валидировать конфигурацию trading service
 */
export const config: TradingConfig = loadConfig(ConfigSchemas.Trading);

/**
 * HTTP статусы
 */
export const HTTP_STATUS = ServiceConstants.HTTP;

/**
 * Time constants
 */
export const TIME = ServiceConstants.TIME;

/**
 * Cache TTL (seconds)
 */
export const CACHE_TTL = {
  SHORT: ServiceConstants.CACHE.SHORT,
  MEDIUM: ServiceConstants.CACHE.MEDIUM,
  LONG: ServiceConstants.CACHE.LONG,
} as const;

/**
 * Лимиты
 */
export const LIMITS = {
  DEFAULT_ORDERS_LIMIT: 100,
  DEFAULT_TRADES_LIMIT: 100,
  MAX_BATCH_SIZE: 50,
} as const;

/**
 * Order defaults
 */
export const ORDER_DEFAULTS = {
  TIME_IN_FORCE: "GTC",
  REDUCE_ONLY: false,
} as const;

/**
 * Service URLs
 */
export const SERVICES = {
  MARKET_DATA_URL: process.env.MARKET_DATA_URL ?? "http://localhost:3010",
  PORTFOLIO_URL: process.env.PORTFOLIO_URL ?? "http://localhost:3012",
} as const;
