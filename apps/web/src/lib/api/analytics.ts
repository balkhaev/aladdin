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
