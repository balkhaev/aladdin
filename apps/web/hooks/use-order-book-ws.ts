import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { OrderBook } from "@/lib/api/market-data";
import { logger } from "@/lib/logger";
import { useWebSocket } from "./use-websocket";

type OrderBookMessage = {
  type: "orderbook";
  data: OrderBook;
};

/**
 * Hook for real-time order book updates via WebSocket
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param limit - Number of levels to receive
 * @param enabled - Enable subscription
 *
 * @example
 * ```tsx
 * const { orderBook, isConnected } = useOrderBookWS("BTCUSDT", 20);
 * ```
 */
export function useOrderBookWS(symbol: string, limit = 20, enabled = true) {
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const queryClient = useQueryClient();
  const { status, data, error, subscribe, unsubscribe, isConnected } =
    useWebSocket<OrderBookMessage>();

  // Subscribe to order book updates
  useEffect(() => {
    if (isConnected && symbol && enabled) {
      logger.debug("OrderBook WS", `Subscribing to ${symbol}`);
      subscribe("orderbook", { symbols: [symbol] });

      return () => {
        logger.debug("OrderBook WS", `Unsubscribing from ${symbol}`);
        unsubscribe("orderbook", { symbols: [symbol] });
      };
    }
  }, [isConnected, symbol, limit, enabled, subscribe, unsubscribe]);

  // Handle incoming messages
  useEffect(() => {
    if (data && data.type === "orderbook" && data.data) {
      const obData = data.data as OrderBook;

      // Update only if it's our symbol
      if (obData.symbol === symbol) {
        logger.debug("OrderBook WS", `Received update for ${symbol}`);
        setOrderBook(obData);

        // Update React Query cache
        queryClient.setQueryData(["orderbook", symbol, limit], obData);
      }
    }
  }, [data, symbol, limit, queryClient]);

  // Reset state on unmount or symbol change
  useEffect(
    () => () => {
      logger.debug("OrderBook WS", `Resetting order book for ${symbol}`);
      setOrderBook(null);
    },
    [symbol]
  );

  return {
    orderBook,
    status,
    error,
    isConnected,
  };
}
