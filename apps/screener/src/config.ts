/**
 * Screener Service Configuration
 * Централизованные константы для screener service
 */

import {
  ConfigSchemas,
  loadConfig,
  type ScreenerConfig,
  ServiceConstants,
} from "@aladdin/core/config";

/**
 * Загрузить и валидировать конфигурацию screener service
 */
export const config: ScreenerConfig = loadConfig(ConfigSchemas.Screener);

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
  DEFAULT_RESULTS_LIMIT: 100,
  DEFAULT_SIGNALS_LIMIT: 20,
  MAX_SYMBOLS_PER_SCAN: config.MAX_SYMBOLS_PER_SCAN,
} as const;

/**
 * Valid recommendations
 */
export const VALID_RECOMMENDATIONS = [
  "STRONG_BUY",
  "BUY",
  "SELL",
  "STRONG_SELL",
] as const;

export type Recommendation = (typeof VALID_RECOMMENDATIONS)[number];
