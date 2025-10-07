import { useQuery } from "@tanstack/react-query";
import { getOrderBook, type OrderBook } from "../lib/api/market-data";

/**
 * Hook for fetching order book data
 * Real-time updates handled by useOrderBookWS
 * This is only used for initial data loading
 */
export function useOrderBook(symbol: string, limit = 20) {
  return useQuery<OrderBook>({
    queryKey: ["orderbook", symbol, limit],
    queryFn: () => getOrderBook(symbol, limit),
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: Number.POSITIVE_INFINITY, // Данные всегда актуальны благодаря WebSocket
  });
}
