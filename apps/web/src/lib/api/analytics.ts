/**
 * Analytics API module
 * Provides functions to interact with Analytics Service via API Gateway
 */

import { apiClient } from "./client";

export type AdvancedMetrics = {
  portfolioId: string;
  period: { from: string; to: string };
  performance: {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    informationRatio: number;
    omegaRatio: number;
    ulcerIndex: number;
    maxDrawdown: number;
  };
  trading: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
  };
  generatedAt: string;
};

/**
 * Get advanced portfolio metrics
 */
export function getAdvancedPortfolioMetrics(
  portfolioId: string,
  params?: { from?: string; to?: string; benchmark?: string }
): Promise<AdvancedMetrics> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.benchmark) searchParams.set("benchmark", params.benchmark);

  const query = searchParams.toString();
  return apiClient.get<AdvancedMetrics>(
    `/api/analytics/portfolio/${portfolioId}/advanced-metrics${query ? `?${query}` : ""}`
  );
}

export type PortfolioSummary = {
  portfolioId: string;
  period: { from: string; to: string };
  performance: {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    informationRatio: number;
    omegaRatio: number;
    ulcerIndex: number;
    maxDrawdown: number;
  } | null;
  trading: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
  } | null;
  risk: {
    var95: number | null;
    var99: number | null;
    sharpeRatio: number | null;
    maxDrawdown: number | null;
  };
  correlations: {
    diversificationScore: number;
    avgCorrelation: number;
    highlyCorrelated: Array<{
      symbol1: string;
      symbol2: string;
      correlation: number;
    }>;
  } | null;
  market: {
    topGainers: Array<{
      symbol: string;
      price: number;
      change24h: number;
      changePercent24h: number;
    }>;
    topLosers: Array<{
      symbol: string;
      price: number;
      change24h: number;
      changePercent24h: number;
    }>;
  } | null;
  generatedAt: string;
};

/**
 * Get comprehensive portfolio summary
 * Combines advanced metrics, risk metrics, correlations, and market overview
 */
export function getPortfolioSummary(
  portfolioId: string,
  params?: { from?: string; to?: string; window?: string; benchmark?: string }
): Promise<PortfolioSummary> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.window) searchParams.set("window", params.window);
  if (params?.benchmark) searchParams.set("benchmark", params.benchmark);

  const query = searchParams.toString();
  return apiClient.get<PortfolioSummary>(
    `/api/analytics/portfolio/${portfolioId}/summary${query ? `?${query}` : ""}`
  );
}

// ==================== Market Overview ====================

export type MarketMover = {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
};

export type VolumeLeader = {
  symbol: string;
  price: number;
  volume24h: number;
  volumeUsd: number;
  trades24h: number;
};

export type MarketStats = {
  totalVolume24h: number;
  totalSymbols: number;
  avgVolatility: number;
  gainersCount: number;
  losersCount: number;
  unchangedCount: number;
  timestamp: Date;
};

export type MarketOverview = {
  topGainers: MarketMover[];
  topLosers: MarketMover[];
  volumeLeaders: VolumeLeader[];
  marketStats: MarketStats;
};

/**
 * Get market overview with top gainers, losers, volume leaders, and market stats
 */
export function getMarketOverview(): Promise<MarketOverview> {
  return apiClient.get<MarketOverview>("/api/analytics/market-overview");
}

// ==================== Technical Indicators ====================

export type IndicatorType = "RSI" | "MACD" | "EMA" | "SMA" | "BB" | "ATR";

export type Indicators = {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema?: number;
  sma?: number;
  bb?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr?: number;
};

/**
 * Get technical indicators for a symbol
 */
export function getIndicators(params: {
  symbol: string;
  timeframe?: string;
  indicators?: IndicatorType[];
  period?: number;
}): Promise<Indicators> {
  const searchParams = new URLSearchParams();
  searchParams.set("symbol", params.symbol);
  if (params.timeframe) searchParams.set("timeframe", params.timeframe);
  if (params.indicators)
    searchParams.set("indicators", params.indicators.join(","));
  if (params.period) searchParams.set("period", params.period.toString());

  return apiClient.get<Indicators>(
    `/api/analytics/indicators?${searchParams.toString()}`
  );
}

// ==================== Trading Statistics ====================

export type TradingStatistics = {
  portfolioId: string;
  period: { from: string; to: string };
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  totalPnL: number;
};

/**
 * Get trading statistics for a portfolio
 */
export function getTradingStatistics(params: {
  portfolioId: string;
  from?: string;
  to?: string;
}): Promise<TradingStatistics> {
  const searchParams = new URLSearchParams();
  searchParams.set("portfolioId", params.portfolioId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  return apiClient.get<TradingStatistics>(
    `/api/analytics/trading-statistics?${searchParams.toString()}`
  );
}

// ==================== Backtesting ====================

export type StrategyType =
  | "MEAN_REVERSION"
  | "TREND_FOLLOWING"
  | "BREAKOUT"
  | "RSI"
  | "MACD";

export type BacktestResult = {
  strategy: StrategyType;
  symbol: string;
  timeframe: string;
  period: { from: string; to: string };
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  trades: Array<{
    timestamp: Date;
    type: "BUY" | "SELL";
    price: number;
    quantity: number;
    pnl: number;
  }>;
};

/**
 * Run backtest for a strategy
 */
export function runBacktest(params: {
  strategy: StrategyType;
  symbol: string;
  timeframe: string;
  from: string;
  to: string;
  initialBalance?: number;
  parameters?: Record<string, number>;
}): Promise<BacktestResult> {
  return apiClient.post<BacktestResult>("/api/analytics/backtest", params);
}

// ==================== Portfolio Reports ====================

export type PortfolioReport = {
  portfolioId: string;
  period: { from: string; to: string };
  performance: {
    totalReturn: number;
    totalReturnPercent: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  positions: Array<{
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  }>;
  trades: Array<{
    timestamp: Date;
    symbol: string;
    type: "BUY" | "SELL";
    price: number;
    quantity: number;
    pnl: number;
  }>;
  generatedAt: Date;
};

/**
 * Generate portfolio report
 */
export function generateReport(params: {
  portfolioId: string;
  from: string;
  to: string;
  format?: "json" | "csv";
}): Promise<PortfolioReport | Blob> {
  const searchParams = new URLSearchParams();
  searchParams.set("portfolioId", params.portfolioId);
  searchParams.set("from", params.from);
  searchParams.set("to", params.to);
  if (params.format) searchParams.set("format", params.format);

  if (params.format === "csv") {
    return apiClient.get<Blob>(
      `/api/analytics/report?${searchParams.toString()}`,
      {
        responseType: "blob",
      }
    );
  }

  return apiClient.get<PortfolioReport>(
    `/api/analytics/report?${searchParams.toString()}`
  );
}
