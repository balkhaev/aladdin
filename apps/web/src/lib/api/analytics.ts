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
