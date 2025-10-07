/**
 * Centralized Query Keys for React Query
 * Type-safe query key factories for consistent cache management
 *
 * Benefits:
 * - Autocomplete and type safety
 * - Easy cache invalidation
 * - Centralized management
 * - Prevents typos and inconsistencies
 */

/**
 * Query keys for sentiment analysis
 */
export const sentimentKeys = {
  all: ["sentiment"] as const,
  detail: (symbol: string) => [...sentimentKeys.all, symbol] as const,
  batch: (symbols: string[]) =>
    [...sentimentKeys.all, "batch", symbols.join(",")] as const,
};

/**
 * Query keys for market data
 */
export const marketKeys = {
  all: ["market"] as const,
  overview: () => [...marketKeys.all, "overview"] as const,
  ticker: (symbol: string) => [...marketKeys.all, "ticker", symbol] as const,
  quote: (symbol: string) => [...marketKeys.all, "quote", symbol] as const,
  candles: (symbol: string, timeframe: string, limit: number) =>
    [...marketKeys.all, "candles", symbol, timeframe, limit] as const,
  orderBook: (symbol: string) =>
    [...marketKeys.all, "order-book", symbol] as const,
  trades: (symbol: string) => [...marketKeys.all, "trades", symbol] as const,
};

/**
 * Query keys for technical indicators
 */
export const indicatorKeys = {
  all: ["indicators"] as const,
  detail: (
    symbol: string,
    timeframe: string,
    indicators: string,
    limit: number
  ) => [...indicatorKeys.all, symbol, timeframe, indicators, limit] as const,
};

/**
 * Query keys for portfolio data
 */
export const portfolioKeys = {
  all: ["portfolio"] as const,
  lists: () => [...portfolioKeys.all, "list"] as const,
  detail: (id: string) => [...portfolioKeys.all, id] as const,
  positions: (id: string) =>
    [...portfolioKeys.detail(id), "positions"] as const,
  summary: (id: string, params?: object) =>
    [...portfolioKeys.detail(id), "summary", params] as const,
  advancedMetrics: (id: string, params?: object) =>
    [...portfolioKeys.detail(id), "advanced-metrics", params] as const,
  correlations: (id: string, window: string) =>
    [...portfolioKeys.detail(id), "correlations", window] as const,
};

/**
 * Query keys for risk analytics
 */
export const riskKeys = {
  all: ["risk"] as const,
  var: (portfolioId: string, confidence: number, window: string) =>
    [...riskKeys.all, "var", portfolioId, confidence, window] as const,
  cvar: (portfolioId: string, confidence: number, window: string) =>
    [...riskKeys.all, "cvar", portfolioId, confidence, window] as const,
  exposure: (portfolioId: string) =>
    [...riskKeys.all, "exposure", portfolioId] as const,
  limits: (portfolioId: string) =>
    [...riskKeys.all, "limits", portfolioId] as const,
};

/**
 * Query keys for trading operations
 */
export const tradingKeys = {
  all: ["trading"] as const,
  orders: (params?: object) => [...tradingKeys.all, "orders", params] as const,
  activeOrders: (symbol?: string) =>
    [...tradingKeys.all, "orders", "active", symbol] as const,
  orderHistory: (params?: object) =>
    [...tradingKeys.all, "orders", "history", params] as const,
  positions: (exchange?: string) =>
    [...tradingKeys.all, "positions", exchange] as const,
  futuresPositions: (exchange?: string) =>
    [...tradingKeys.all, "positions", "futures", exchange] as const,
};

/**
 * Query keys for on-chain data
 */
export const onChainKeys = {
  all: ["on-chain"] as const,
  sentiment: (symbol: string) =>
    [...onChainKeys.all, "sentiment", symbol] as const,
  whaleTransactions: (blockchain: string, minValue: number) =>
    [...onChainKeys.all, "whale-txs", blockchain, minValue] as const,
  metrics: (symbol: string) => [...onChainKeys.all, "metrics", symbol] as const,
  comparison: (symbol1: string, symbol2: string) =>
    [...onChainKeys.all, "comparison", symbol1, symbol2] as const,
};

/**
 * Query keys for social sentiment
 */
export const socialKeys = {
  all: ["social"] as const,
  sentiment: (symbol: string) =>
    [...socialKeys.all, "sentiment", symbol] as const,
  history: (symbol: string) => [...socialKeys.all, "history", symbol] as const,
  trending: () => [...socialKeys.all, "trending"] as const,
};

/**
 * Query keys for macro data
 */
export const macroKeys = {
  all: ["macro"] as const,
  globalMetrics: () => [...macroKeys.all, "global-metrics"] as const,
  fearGreed: (limit: number) =>
    [...macroKeys.all, "fear-greed", limit] as const,
};

/**
 * Query keys for ML models
 */
export const mlKeys = {
  all: ["ml"] as const,
  models: () => [...mlKeys.all, "models"] as const,
  modelDetail: (id: string) => [...mlKeys.all, "models", id] as const,
  predictions: (modelId: string, symbol: string) =>
    [...mlKeys.all, "predictions", modelId, symbol] as const,
  training: (modelId: string) => [...mlKeys.all, "training", modelId] as const,
  hpo: (modelId: string) => [...mlKeys.all, "hpo", modelId] as const,
};

/**
 * Query keys for analytics
 */
export const analyticsKeys = {
  all: ["analytics"] as const,
  reports: () => [...analyticsKeys.all, "reports"] as const,
  report: (id: string) => [...analyticsKeys.all, "reports", id] as const,
  statistics: (params?: object) =>
    [...analyticsKeys.all, "statistics", params] as const,
};

/**
 * Query keys for screener
 */
export const screenerKeys = {
  all: ["screener"] as const,
  results: (criteria: object) =>
    [...screenerKeys.all, "results", criteria] as const,
};

/**
 * Query keys for aggregated prices
 */
export const aggregatedPriceKeys = {
  all: ["aggregated-price"] as const,
  detail: (symbol: string) => [...aggregatedPriceKeys.all, symbol] as const,
  arbitrage: (minSpread: number, limit: number) =>
    [...aggregatedPriceKeys.all, "arbitrage", minSpread, limit] as const,
};

/**
 * Query keys for funding rates
 */
export const fundingRateKeys = {
  all: ["funding-rates"] as const,
  current: (symbol: string) =>
    [...fundingRateKeys.all, "current", symbol] as const,
  history: (symbol: string, exchange?: string) =>
    [...fundingRateKeys.all, "history", symbol, exchange] as const,
};

/**
 * Query keys for open interest
 */
export const openInterestKeys = {
  all: ["open-interest"] as const,
  current: (symbol: string) =>
    [...openInterestKeys.all, "current", symbol] as const,
  history: (symbol: string, timeframe: string) =>
    [...openInterestKeys.all, "history", symbol, timeframe] as const,
};

/**
 * Query keys for executor stats
 */
export const executorKeys = {
  all: ["executor"] as const,
  stats: () => [...executorKeys.all, "stats"] as const,
  health: () => [...executorKeys.all, "health"] as const,
};

/**
 * Query keys for anomaly detection
 */
export const anomalyKeys = {
  all: ["anomaly"] as const,
  detect: (symbol: string, params?: object) =>
    [...anomalyKeys.all, "detect", symbol, params] as const,
};

/**
 * Query keys for backtest
 */
export const backtestKeys = {
  all: ["backtest"] as const,
  results: (id: string) => [...backtestKeys.all, "results", id] as const,
  history: () => [...backtestKeys.all, "history"] as const,
};

/**
 * Query keys for cache monitoring
 */
export const cacheKeys = {
  all: ["cache"] as const,
  stats: () => [...cacheKeys.all, "stats"] as const,
  health: () => [...cacheKeys.all, "health"] as const,
};

/**
 * Combined sentiment query keys
 */
export const combinedSentimentKeys = {
  all: ["combined-sentiment"] as const,
  detail: (symbol: string) => [...combinedSentimentKeys.all, symbol] as const,
};

/**
 * Helper to invalidate all queries for a specific entity
 */
export const invalidateKeys = {
  portfolio: (id: string) => portfolioKeys.detail(id),
  market: (symbol: string) => marketKeys.ticker(symbol),
  sentiment: (symbol: string) => sentimentKeys.detail(symbol),
  // Add more as needed
};
