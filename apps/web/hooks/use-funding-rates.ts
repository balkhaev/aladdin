import { useQuery } from "@tanstack/react-query";
import { getAllFundingRates, getFundingRate } from "../lib/api/market-data";

const REFETCH_INTERVAL = 60_000; // 1 minute

/**
 * Hook to get funding rate for a symbol from a specific exchange
 */
export function useFundingRate(symbol: string, exchange = "binance") {
  return useQuery({
    queryKey: ["funding-rate", symbol, exchange],
    queryFn: () => getFundingRate(symbol, exchange),
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!symbol,
  });
}

/**
 * Hook to get funding rates across all exchanges
 */
export function useAllFundingRates(symbol: string) {
  return useQuery({
    queryKey: ["funding-rates-all", symbol],
    queryFn: () => getAllFundingRates(symbol),
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!symbol,
  });
}

