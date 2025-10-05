/**
 * Portfolio Service Configuration
 * Централизованные константы для portfolio service
 */

import {
  ConfigSchemas,
  loadConfig,
  type PortfolioConfig,
  ServiceConstants,
} from "@aladdin/shared/config";

/**
 * Загрузить и валидировать конфигурацию portfolio service
 */
export const config: PortfolioConfig = loadConfig(ConfigSchemas.Portfolio);

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
  DEFAULT_TRANSACTIONS_LIMIT: 100,
  DEFAULT_PERFORMANCE_DAYS: 30,
  MAX_POSITIONS_PER_PORTFOLIO: 100,
} as const;

/**
 * Performance calculation defaults
 */
export const PERFORMANCE_DEFAULTS = {
  WINDOW_DAYS: 30,
  BENCHMARK_SYMBOL: "BTC",
} as const;

/**
 * Risk defaults
 */
export const RISK_DEFAULTS = {
  CONFIDENCE_LEVEL: 0.95,
  LOOKBACK_DAYS: 30,
} as const;

/**
 * Service URLs
 */
export const SERVICES = {
  MARKET_DATA_URL: process.env.MARKET_DATA_URL ?? "http://localhost:3010",
  TRADING_URL: process.env.TRADING_URL ?? "http://localhost:3011",
} as const;
