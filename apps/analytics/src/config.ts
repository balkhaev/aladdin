/**
 * Analytics Service Configuration
 * Централизованные константы для analytics service
 */

import {
  type AnalyticsConfig,
  ConfigSchemas,
  loadConfig,
  ServiceConstants,
} from "@aladdin/core/config";

/**
 * Загрузить и валидировать конфигурацию analytics service
 */
export const config: AnalyticsConfig = loadConfig(ConfigSchemas.Analytics);

/**
 * HTTP статусы (переэкспорт из shared для удобства)
 */
export const HTTP_STATUS = ServiceConstants.HTTP;

/**
 * Константы времени
 */
export const TIME = ServiceConstants.TIME;

/**
 * Дефолтные значения
 */
export const DEFAULTS = {
  WINDOW: config.DEFAULT_WINDOW,
  BENCHMARK: config.DEFAULT_BENCHMARK,
  DAYS_LOOKBACK: config.DEFAULT_DAYS_LOOKBACK,
  TOP_ITEMS_LIMIT: config.TOP_ITEMS_LIMIT,
  VAR_CONFIDENCE: config.VAR_CONFIDENCE,
  VAR_TIME_WINDOW: config.VAR_TIME_WINDOW,
} as const;

/**
 * Cache TTL значения (в секундах)
 */
export const CACHE_TTL = {
  INDICATORS: config.CACHE_INDICATORS_TTL,
  MARKET_OVERVIEW: config.CACHE_MARKET_OVERVIEW_TTL,
  COMBINED_SENTIMENT: config.CACHE_COMBINED_SENTIMENT_TTL,
  ADVANCED_METRICS: config.CACHE_ADVANCED_METRICS_TTL,
  SUMMARY: config.CACHE_SUMMARY_TTL,
} as const;

/**
 * Service URLs
 */
export const SERVICES = {
  SCRAPER_URL: config.SCRAPER_URL,
  MARKET_DATA_BASE_URL: config.MARKET_DATA_BASE_URL,
  RISK_URL: process.env.RISK_URL ?? "http://localhost:3013",
} as const;
