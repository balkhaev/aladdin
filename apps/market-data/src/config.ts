/**
 * Market Data Service Configuration
 * Централизованные константы для market-data service
 */

import {
  ConfigSchemas,
  loadConfig,
  type MarketDataConfig,
  ServiceConstants,
} from "@aladdin/shared/config";

/**
 * Загрузить и валидировать конфигурацию market-data service
 */
export const config: MarketDataConfig = loadConfig(ConfigSchemas.MarketData);

/**
 * HTTP статусы
 */
export const HTTP_STATUS = ServiceConstants.HTTP;

/**
 * Time constants
 */
export const TIME = ServiceConstants.TIME;

/**
 * Лимиты
 */
export const LIMITS = {
  DEFAULT_LIMIT: 1,
  DEFAULT_ORDERBOOK_LIMIT: 100,
  DEFAULT_HISTORY_LIMIT: 100,
  DEFAULT_TRADES_LIMIT: 1000,
  DEFAULT_ARBITRAGE_LIMIT: 100,
  DEFAULT_ARBIT_LIMIT_QUERY: 20,
} as const;

/**
 * Cache TTL (seconds)
 */
export const CACHE_TTL = {
  SHORT: ServiceConstants.CACHE.SHORT,
  MEDIUM: ServiceConstants.CACHE.MEDIUM,
  LONG: ServiceConstants.CACHE.LONG,
} as const;

/**
 * Collector intervals
 */
export const INTERVALS = {
  ORDERBOOK: Number.parseInt(process.env.ORDERBOOK_INTERVAL_MS ?? "5000", 10),
  FUNDING_RATE: Number.parseInt(
    process.env.FUNDING_INTERVAL_MS ?? String(TIME.MILLISECONDS_PER_HOUR),
    10
  ),
  OPEN_INTEREST: Number.parseInt(
    process.env.OI_INTERVAL_MS ?? String(TIME.MILLISECONDS_PER_HOUR),
    10
  ),
} as const;

/**
 * Exchange URLs
 */
export const EXCHANGE_URLS = {
  BINANCE: {
    API: config.BINANCE_API_URL,
    WS: config.BINANCE_WS_URL,
  },
  BYBIT: {
    API: config.BYBIT_API_URL,
    WS: config.BYBIT_WS_URL,
  },
  OKX: {
    API: config.OKX_API_URL,
    WS: config.OKX_WS_URL,
  },
} as const;

/**
 * Default symbols
 */
export const DEFAULT_SYMBOLS = config.DEFAULT_SYMBOLS.split(",");

/**
 * Service URLs
 */
export const SERVICES = {
  PORTFOLIO_URL: process.env.PORTFOLIO_URL ?? "http://localhost:3012",
} as const;
