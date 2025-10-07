/**
 * Hooks for Bybit Opportunities
 */

import { useQuery } from "@tanstack/react-query";
import { bybitOpportunitiesApi } from "@/lib/api/bybit-opportunities";
import type { OpportunitySignal } from "@/types/bybit";

const REFETCH_INTERVAL = 10_000; // 10 seconds

/**
 * Hook to fetch opportunities with filters
 */
export function useBybitOpportunities(filters: {
  minScore?: number;
  signal?: OpportunitySignal;
  minConfidence?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["bybit-opportunities", filters],
    queryFn: async () => {
      const response = await bybitOpportunitiesApi.getOpportunities(filters);
      return response;
    },
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Hook to fetch opportunities for a specific symbol
 */
export function useSymbolOpportunities(symbol: string, limit?: number) {
  return useQuery({
    queryKey: ["bybit-opportunities", symbol, limit],
    queryFn: () => bybitOpportunitiesApi.getSymbolOpportunities(symbol, limit),
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Hook to fetch statistics
 */
export function useOpportunitiesStats() {
  return useQuery({
    queryKey: ["bybit-opportunities-stats"],
    queryFn: async () => {
      const response = await bybitOpportunitiesApi.getStats();
      return response;
    },
    refetchInterval: REFETCH_INTERVAL * 3, // 30 seconds
    initialData: {
      total: 0,
      bySignal: { BUY: 0, SELL: 0, NEUTRAL: 0 },
      byStrength: { WEAK: 0, MODERATE: 0, STRONG: 0 },
    },
  });
}

/**
 * Hook to fetch monitored symbols
 */
export function useMonitoredSymbols() {
  return useQuery({
    queryKey: ["bybit-opportunities-symbols"],
    queryFn: () => bybitOpportunitiesApi.getSymbols(),
    refetchInterval: REFETCH_INTERVAL * 6, // 60 seconds
    staleTime: REFETCH_INTERVAL * 6,
  });
}
