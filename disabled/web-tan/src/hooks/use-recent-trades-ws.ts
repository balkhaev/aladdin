import type { AggTrade } from "@aladdin/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { RecentTrade } from "../lib/api/market-data";
import { useWebSocket } from "./use-websocket";

type TradeMessage = {
  type: "trade";
  data: AggTrade;
};

/**
 * Hook for real-time trade updates via WebSocket
 *
 * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
 * @param maxTrades - Maximum number of trades to keep
 * @param enabled - Enable subscription
 *
 * @example
 * ```tsx
 * const { trades, isConnected } = useRecentTradesWS("BTCUSDT", 50);
 * ```
 */
export function useRecentTradesWS(
  symbol: string,
  maxTrades = 50,
  enabled = true
) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const queryClient = useQueryClient();
  const { status, data, error, subscribe, unsubscribe, isConnected } =
    useWebSocket<TradeMessage>();

  // Subscribe to trade updates
  useEffect(() => {
    if (isConnected && symbol && enabled) {
      console.log(`[Trades WS] Subscribing to ${symbol}`);
      subscribe("trade", { symbols: [symbol] });

      return () => {
        console.log(`[Trades WS] Unsubscribing from ${symbol}`);
        unsubscribe("trade", { symbols: [symbol] });
      };
    }
  }, [isConnected, symbol, enabled, subscribe, unsubscribe]);

  // Handle incoming messages
  useEffect(() => {
    if (data && data.type === "trade" && data.data) {
      const aggTrade = data.data as AggTrade;

      // Update only if it's our symbol
      if (aggTrade.symbol === symbol) {
        console.log(
          `[Trades WS] Received trade for ${symbol}:`,
          aggTrade.price
        );

        // Transform AggTrade to RecentTrade format
        const trade: RecentTrade = {
          id: aggTrade.tradeId,
          price: aggTrade.price,
          qty: aggTrade.quantity, // Map quantity to qty
          quoteQty: aggTrade.price * aggTrade.quantity,
          time: aggTrade.timestamp,
          isBuyerMaker: aggTrade.isBuyerMaker,
        };

        setTrades((prevTrades) => {
          // Add new trade to the beginning
          const newTrades = [trade, ...prevTrades];
          // Limit to maxTrades
          const limitedTrades = newTrades.slice(0, maxTrades);

          // Update React Query cache
          queryClient.setQueryData(
            ["trades", symbol, maxTrades],
            limitedTrades
          );

          return limitedTrades;
        });
      }
    }
  }, [data, symbol, maxTrades, queryClient]);

  // Reset state on unmount or symbol change
  useEffect(
    () => () => {
      console.log(`[Trades WS] Resetting trades for ${symbol}`);
      setTrades([]);
    },
    [symbol]
  );

  return {
    trades,
    status,
    error,
    isConnected,
  };
}
