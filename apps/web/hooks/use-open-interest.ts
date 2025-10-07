import { useQuery } from "@tanstack/react-query";
import { getAllOpenInterest, getOpenInterest } from "../lib/api/market-data";

const REFETCH_INTERVAL = 60_000; // 1 minute

/**
 * Hook to get open interest for a symbol from a specific exchange
 */
export function useOpenInterest(symbol: string, exchange = "binance") {
  return useQuery({
    queryKey: ["open-interest", symbol, exchange],
    queryFn: () => getOpenInterest(symbol, exchange),
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!symbol,
  });
}

/**
 * Hook to get open interest across all exchanges
 */
export function useAllOpenInterest(symbol: string) {
  return useQuery({
    queryKey: ["open-interest-all", symbol],
    queryFn: () => getAllOpenInterest(symbol),
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!symbol,
  });
}

