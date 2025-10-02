/**
 * Advanced Performance Metrics React Hooks
 * Custom hooks for advanced analytics using TanStack Query
 */

import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type AdvancedPerformanceMetrics = {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  omegaRatio: number;
  ulcerIndex: number;
  maxDrawdown: number;
};

export type TradingStatistics = {
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
};

export type AdvancedMetricsResponse = {
  portfolioId: string;
  from: string;
  to: string;
  benchmark: string;
  performance: AdvancedPerformanceMetrics;
  trading: TradingStatistics;
  calculatedAt: string;
};

/**
 * Hook to fetch advanced performance metrics for a portfolio
 */
export function useAdvancedMetrics(
  portfolioId: string | undefined,
  params?: {
    from?: Date;
    to?: Date;
    benchmark?: string;
  },
  enabled = true
) {
  return useQuery<AdvancedMetricsResponse>({
    queryKey: ["advanced-metrics", portfolioId, params],
    queryFn: async () => {
      if (!portfolioId) throw new Error("Portfolio ID is required");

      const searchParams = new URLSearchParams();
      if (params?.from) {
        searchParams.append("from", params.from.toISOString());
      }
      if (params?.to) {
        searchParams.append("to", params.to.toISOString());
      }
      if (params?.benchmark) {
        searchParams.append("benchmark", params.benchmark);
      }

      const url = `${API_BASE_URL}/api/analytics/portfolio/${portfolioId}/advanced-metrics${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch advanced metrics");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 300_000, // Update every 5 minutes (matches backend cache)
    staleTime: 120_000, // Consider data stale after 2 minutes
    enabled: enabled && !!portfolioId,
  });
}

/**
 * Hook to fetch portfolio summary (all metrics in one call)
 */
export type PortfolioSummary = {
  portfolioId: string;
  period: {
    from: string;
    to: string;
  };
  performance: AdvancedPerformanceMetrics | null;
  trading: TradingStatistics | null;
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
      changePercent24h: number;
      volume24h: number;
    }>;
    topLosers: Array<{
      symbol: string;
      price: number;
      changePercent24h: number;
      volume24h: number;
    }>;
    totalVolume24h: number;
    avgVolatility: number;
  } | null;
  generatedAt: string;
};

export function usePortfolioSummary(
  portfolioId: string | undefined,
  params?: {
    from?: Date;
    to?: Date;
    window?: "7d" | "30d" | "90d" | "1y";
  },
  enabled = true
) {
  return useQuery<PortfolioSummary>({
    queryKey: ["portfolio-summary", portfolioId, params],
    queryFn: async () => {
      if (!portfolioId) throw new Error("Portfolio ID is required");

      const searchParams = new URLSearchParams();
      if (params?.from) {
        searchParams.append("from", params.from.toISOString());
      }
      if (params?.to) {
        searchParams.append("to", params.to.toISOString());
      }
      if (params?.window) {
        searchParams.append("window", params.window);
      }

      const url = `${API_BASE_URL}/api/analytics/portfolio/${portfolioId}/summary${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch portfolio summary");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 60_000, // Update every minute (matches backend cache)
    staleTime: 30_000, // Consider data stale after 30 seconds
    enabled: enabled && !!portfolioId,
  });
}
