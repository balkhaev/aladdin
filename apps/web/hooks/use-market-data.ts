import { useQuery } from "@tanstack/react-query";
import { marketDataApi } from "../lib/api/market-data";

const REFETCH_INTERVAL_SHORT = 2000; // 2 seconds
const REFETCH_INTERVAL_MEDIUM = 60_000; // 1 minute
const REFETCH_INTERVAL_LONG = 300_000; // 5 minutes

/**
 * Hook to get current quote (price) for a symbol
 */
export function useQuote(symbol: string) {
  return useQuery({
    queryKey: ["market-data-quote", symbol],
    queryFn: () => marketDataApi.getQuote(symbol),
    refetchInterval: REFETCH_INTERVAL_SHORT,
    enabled: !!symbol,
  });
}

/**
 * Hook to get historical candles for a symbol
 */
export function useCandles(symbol: string, timeframe = "1h", limit = 100) {
  return useQuery({
    queryKey: ["market-data-candles", symbol, timeframe, limit],
    queryFn: () => marketDataApi.getCandles(symbol, timeframe, limit),
    refetchInterval: REFETCH_INTERVAL_MEDIUM,
    enabled: !!symbol,
  });
}

/**
 * Hook to get subscribed tickers
 */
export function useTickers() {
  return useQuery({
    queryKey: ["market-data-tickers"],
    queryFn: () => marketDataApi.getTickers(),
    refetchInterval: REFETCH_INTERVAL_MEDIUM,
    staleTime: REFETCH_INTERVAL_MEDIUM,
  });
}

/**
 * Hook to get all available symbols from Binance
 */
export function useAllSymbols() {
  return useQuery({
    queryKey: ["market-data-symbols"],
    queryFn: () => marketDataApi.getAllSymbols(),
    refetchInterval: REFETCH_INTERVAL_LONG,
    staleTime: REFETCH_INTERVAL_LONG,
  });
}
