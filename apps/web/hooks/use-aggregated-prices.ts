/**
 * React Query hooks for Aggregated Prices and Arbitrage
 */

import { useQuery } from "@tanstack/react-query";
import {
  getAggregatedPrice,
  getArbitrageOpportunities,
} from "../lib/api/market-data";

/**
 * Get aggregated price for a symbol
 */
export function useAggregatedPrice(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ["aggregated-price", symbol],
    queryFn: () => getAggregatedPrice(symbol, 1),
    enabled: enabled && !!symbol,
    refetchInterval: 5000, // Refetch every 5 seconds
  });
}

/**
 * Get arbitrage opportunities
 */
export function useArbitrageOpportunities(
  minSpread = 0.1,
  limit = 20,
  enabled = true
) {
  return useQuery({
    queryKey: ["arbitrage-opportunities", minSpread, limit],
    queryFn: () => getArbitrageOpportunities(minSpread, limit),
    enabled,
    refetchInterval: 10_000, // Refetch every 10 seconds
  });
}
