/**
 * Advanced Performance Metrics React Hooks
 * Custom hooks for advanced analytics using TanStack Query
 */

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { API_CONFIG } from "@/lib/config";
import { REFETCH_INTERVALS, STALE_TIME } from "@/lib/query-config";
import { portfolioKeys } from "@/lib/query-keys";

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
    queryKey: portfolioId
      ? portfolioKeys.advancedMetrics(portfolioId, params)
      : portfolioKeys.all,
    queryFn: () => {
      if (!portfolioId) throw new Error("Portfolio ID is required");

      return apiGet<AdvancedMetricsResponse>(
        `/api/analytics/portfolio/${portfolioId}/advanced-metrics`,
        {
          from: params?.from?.toISOString(),
          to: params?.to?.toISOString(),
          benchmark: params?.benchmark,
        }
      );
    },
    refetchInterval: REFETCH_INTERVALS.VERY_SLOW,
    staleTime: STALE_TIME.VERY_SLOW,
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

      const url = `${API_CONFIG.BASE_URL}/api/analytics/portfolio/${portfolioId}/summary${
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
