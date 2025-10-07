import { useQuery } from "@tanstack/react-query";
import { getRecentTrades, type RecentTrade } from "../lib/api/market-data";

/**
 * Hook for fetching recent trades
 * Real-time updates handled by useRecentTradesWS
 * This is only used for initial data loading
 */
export function useRecentTrades(symbol: string, limit = 50) {
  return useQuery<RecentTrade[]>({
    queryKey: ["trades", symbol, limit],
    queryFn: () => getRecentTrades(symbol, limit),
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: Number.POSITIVE_INFINITY, // Данные всегда актуальны благодаря WebSocket
  });
}
