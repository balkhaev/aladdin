import { z } from "zod";

/**
 * Централизованная конфигурация для всех сервисов
 *
 * Использует Zod для валидации переменных окружения
 */

/**
 * Базовая конфигурация (общая для всех сервисов)
 */
const BaseConfigSchema = z.object({
  // Environment
  NODE_ENV: z
    .enum(["development", "production", "staging", "test"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Infrastructure
  NATS_URL: z.string().default("nats://localhost:4222"),
  CLICKHOUSE_HOST: z.string().default("localhost"),
  CLICKHOUSE_PORT: z.coerce.number().default(8123),
  CLICKHOUSE_DATABASE: z.string().default("aladdin"),
  CLICKHOUSE_USER: z.string().default("default"),
  CLICKHOUSE_PASSWORD: z.string().default(""),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Security
  ENCRYPTION_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),

  // Service Discovery
  SERVICE_DISCOVERY: z.enum(["local", "kubernetes", "consul"]).default("local"),
});

/**
 * API Gateway конфигурация
 */
const GatewayConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:3001"),

  // Service URLs
  MARKET_DATA_URL: z.string().default("http://localhost:3010"),
  TRADING_URL: z.string().default("http://localhost:3011"),
  PORTFOLIO_URL: z.string().default("http://localhost:3012"),
  RISK_URL: z.string().default("http://localhost:3013"),
  ANALYTICS_URL: z.string().default("http://localhost:3014"),
  ON_CHAIN_URL: z.string().default("http://localhost:3015"),
  SCREENER_URL: z.string().default("http://localhost:3016"),
  MACRO_DATA_URL: z.string().default("http://localhost:3017"),

  // Auth
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

/**
 * Market Data конфигурация
 */
const MarketDataConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3010),

  // Exchange URLs
  BINANCE_API_URL: z.string().default("https://api.binance.com"),
  BINANCE_WS_URL: z.string().default("wss://stream.binance.com:9443"),
  BYBIT_API_URL: z.string().default("https://api.bybit.com"),
  BYBIT_WS_URL: z.string().default("wss://stream.bybit.com/v5/public/spot"),
  OKX_API_URL: z.string().default("https://www.okx.com"),
  OKX_WS_URL: z.string().default("wss://ws.okx.com:8443/ws/v5/public"),

  // Symbols
  DEFAULT_SYMBOLS: z.string().default("BTCUSDT,ETHUSDT,BNBUSDT"),
});

/**
 * On-Chain конфигурация
 */
const OnChainConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3015),

  // API Keys
  ETHERSCAN_API_KEY: z.string(),
  CMC_API_KEY: z.string(),

  // Settings
  UPDATE_INTERVAL_MS: z.coerce.number().default(300_000), // 5 minutes
  WHALE_THRESHOLD_BTC: z.coerce.number().default(10),
  WHALE_THRESHOLD_ETH: z.coerce.number().default(100),
  ENABLED_CHAINS: z.string().default("BTC,ETH"),
});

/**
 * Analytics конфигурация
 */
const AnalyticsConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3014),

  // Service URLs
  SCRAPER_URL: z.string().default("http://localhost:3018"),
  MARKET_DATA_BASE_URL: z.string().default("http://localhost:3010"),

  // Settings
  MAX_BACKTEST_DAYS: z.coerce.number().default(365),

  // Cache TTL (seconds)
  CACHE_INDICATORS_TTL: z.coerce.number().default(60),
  CACHE_MARKET_OVERVIEW_TTL: z.coerce.number().default(120),
  CACHE_COMBINED_SENTIMENT_TTL: z.coerce.number().default(120),
  CACHE_ADVANCED_METRICS_TTL: z.coerce.number().default(300),
  CACHE_SUMMARY_TTL: z.coerce.number().default(60),

  // Defaults
  DEFAULT_WINDOW: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  DEFAULT_BENCHMARK: z.string().default("BTC"),
  DEFAULT_DAYS_LOOKBACK: z.coerce.number().default(30),
  TOP_ITEMS_LIMIT: z.coerce.number().default(5),
  VAR_CONFIDENCE: z.coerce.number().default(95),
  VAR_TIME_WINDOW: z.coerce.number().default(30),
});

/**
 * Trading конфигурация
 */
const TradingConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3011),

  // Executor configuration
  EXECUTOR_MODE: z.enum(["PAPER", "LIVE"]).default("PAPER"),
  MAX_OPEN_POSITIONS: z.coerce.number().default(5),
  DEFAULT_USER_ID: z.string().default(""),
  DEFAULT_PORTFOLIO_ID: z.string().default(""),
  DEFAULT_EXCHANGE_CREDENTIALS_ID: z.string().default(""),
  AUTO_EXECUTE: z.coerce.boolean().default(true),
});

/**
 * Portfolio конфигурация
 */
const PortfolioConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3012),

  // Service URLs
  MARKET_DATA_URL: z.string().default("http://localhost:3010"),
});

/**
 * ML Service конфигурация
 */
const MLServiceConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3019),
});

/**
 * Screener конфигурация
 */
const ScreenerConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3017),

  // Scan settings
  SCAN_INTERVAL_MS: z.coerce.number().default(60_000), // 1 minute
  MAX_SYMBOLS_PER_SCAN: z.coerce.number().default(100),
});

/**
 * Scraper конфигурация
 */
const ScraperConfigSchema = BaseConfigSchema.extend({
  PORT: z.coerce.number().default(3018),

  // Telegram settings
  TELEGRAM_API_ID: z.string().optional(),
  TELEGRAM_API_HASH: z.string().optional(),
  TELEGRAM_SESSION_STRING: z.string().optional(),

  // Twitter settings
  TWITTER_USERNAME: z.string().optional(),
  TWITTER_PASSWORD: z.string().optional(),
  TWITTER_EMAIL: z.string().optional(),

  // Reddit settings
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USER_AGENT: z.string().optional(),
});

/**
 * Общие константы для всех сервисов
 */
export const ServiceConstants = {
  // HTTP Status Codes
  HTTP: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
  },

  // Time constants
  TIME: {
    MILLISECONDS_PER_SECOND: 1000,
    MILLISECONDS_PER_MINUTE: 60_000,
    MILLISECONDS_PER_HOUR: 3_600_000,
    MILLISECONDS_PER_DAY: 86_400_000,
  },

  // Default limits
  LIMITS: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    DEFAULT_HISTORY_LIMIT: 100,
    DEFAULT_TRADES_LIMIT: 1000,
    DEFAULT_ARBITRAGE_LIMIT: 100,
    DEFAULT_ORDERBOOK_LIMIT: 100,
    MAX_MESSAGES_LIMIT: 100,
  },

  // Cache TTL defaults (seconds)
  CACHE: {
    SHORT: 5,
    MEDIUM: 60,
    LONG: 300,
  },

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    MAX_DELAY: 10_000,
    BACKOFF_FACTOR: 2,
  },

  // Circuit breaker
  CIRCUIT_BREAKER: {
    FAILURE_THRESHOLD: 5,
    SUCCESS_THRESHOLD: 2,
    TIMEOUT: 10_000,
    RESET_TIMEOUT: 60_000,
  },
} as const;

/**
 * Service Ports mapping
 */
export const ServicePorts = {
  SERVER: 3000,
  MARKET_DATA: 3010,
  TRADING: 3011,
  PORTFOLIO: 3012,
  ANALYTICS: 3014,
  SCREENER: 3017,
  SCRAPER: 3018,
  ML_SERVICE: 3019,
} as const;

/**
 * Общие типы конфигураций
 */
export type BaseConfig = z.infer<typeof BaseConfigSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type MarketDataConfig = z.infer<typeof MarketDataConfigSchema>;
export type OnChainConfig = z.infer<typeof OnChainConfigSchema>;
export type AnalyticsConfig = z.infer<typeof AnalyticsConfigSchema>;
export type TradingConfig = z.infer<typeof TradingConfigSchema>;
export type PortfolioConfig = z.infer<typeof PortfolioConfigSchema>;
export type MLServiceConfig = z.infer<typeof MLServiceConfigSchema>;
export type ScreenerConfig = z.infer<typeof ScreenerConfigSchema>;
export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;

/**
 * Загрузить и валидировать конфигурацию
 *
 * @example
 * ```typescript
 * const config = loadConfig(GatewayConfigSchema);
 * console.log(config.PORT); // type-safe!
 * ```
 */
export function loadConfig<T extends z.ZodSchema>(schema: T): z.infer<T> {
  try {
    return schema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Configuration validation failed:");
      for (const issue of error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      throw new Error("Invalid configuration");
    }
    throw error;
  }
}

/**
 * Service URL resolver with service discovery support
 */
export class ServiceUrlResolver {
  constructor(private config: BaseConfig) {}

  resolve(serviceName: string, defaultPort: number): string {
    const { SERVICE_DISCOVERY, NODE_ENV } = this.config;

    // Local development
    if (SERVICE_DISCOVERY === "local") {
      return `http://localhost:${defaultPort}`;
    }

    // Kubernetes
    if (SERVICE_DISCOVERY === "kubernetes") {
      const namespace = NODE_ENV === "production" ? "prod" : "staging";
      return `http://${serviceName}-service.${namespace}.svc.cluster.local:${defaultPort}`;
    }

    // Consul
    if (SERVICE_DISCOVERY === "consul") {
      return `http://${serviceName}.service.consul:${defaultPort}`;
    }

    // Fallback
    return `http://localhost:${defaultPort}`;
  }
}

/**
 * Config Manager для dynamic configuration
 */
export class ConfigManager {
  private config: Map<string, unknown> = new Map();
  private watchers: Map<string, Array<(value: unknown) => void>> = new Map();

  set<T>(key: string, value: T): void {
    this.config.set(key, value);

    // Notify watchers
    const callbacks = this.watchers.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(value);
      }
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    const value = this.config.get(key);
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Config key not found: ${key}`);
    }
    return value as T;
  }

  has(key: string): boolean {
    return this.config.has(key);
  }

  watch<T>(key: string, callback: (value: T) => void): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, []);
    }

    const callbacks = this.watchers.get(key);
    if (callbacks) {
      callbacks.push(callback as (value: unknown) => void);
    }

    // Return unwatch function
    return () => {
      const watcherCallbacks = this.watchers.get(key);
      if (watcherCallbacks) {
        const index = watcherCallbacks.indexOf(
          callback as (value: unknown) => void
        );
        if (index > -1) {
          watcherCallbacks.splice(index, 1);
        }
      }
    };
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.config);
  }
}

/**
 * Export schemas for each service
 */
export const ConfigSchemas = {
  Base: BaseConfigSchema,
  Gateway: GatewayConfigSchema,
  MarketData: MarketDataConfigSchema,
  OnChain: OnChainConfigSchema,
  Analytics: AnalyticsConfigSchema,
  Trading: TradingConfigSchema,
  Portfolio: PortfolioConfigSchema,
  MLService: MLServiceConfigSchema,
  Screener: ScreenerConfigSchema,
  Scraper: ScraperConfigSchema,
} as const;

/**
 * Helper to get required env var
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Helper to get optional env var
 */
export function getEnv(key: string, defaultValue = ""): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Helper to get numeric env var
 */
export function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return num;
}

/**
 * Helper to get boolean env var
 */
export function getEnvBoolean(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}
