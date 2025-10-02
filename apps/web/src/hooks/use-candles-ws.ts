import type { AggTrade, Candle, Timeframe } from "@aladdin/shared/types";
import { useCallback, useEffect, useState } from "react";
import { useCandleBuilder } from "./use-candle-builder";
import { useWebSocket } from "./use-websocket";

type TradeMessage = {
  type: "trade";
  data: AggTrade;
};

type MarketDataMessage = TradeMessage | { type: string; data?: unknown };

/**
 * Hook для получения real-time свечей через WebSocket
 * Строит свечи из потока трейдов в реальном времени
 *
 * @param symbol - символ инструмента (например, "BTCUSDT")
 * @param interval - интервал свечей (1m, 5m, 15m, 1h, 1d)
 * @returns объект с текущей свечей, статусом и ошибкой
 *
 * @example
 * ```tsx
 * const { candle, isConnected } = useCandlesWS("BTCUSDT", "1m");
 *
 * useEffect(() => {
 *   if (candle) {
 *     // Обновить последнюю свечу на графике
 *     updateLastCandle(candle);
 *   }
 * }, [candle]);
 * ```
 */
export function useCandlesWS(
  symbol?: string,
  interval?: string,
  enabled = true
) {
  const [candle, setCandle] = useState<Candle | null>(null);
  const { status, data, error, subscribe, unsubscribe, isConnected } =
    useWebSocket<MarketDataMessage>();

  // Колбэк для обновления свечи
  const handleCandleUpdate = useCallback((updatedCandle: Candle) => {
    console.log(
      "[useCandlesWS] Candle updated:",
      updatedCandle.symbol,
      updatedCandle.close
    );
    setCandle(updatedCandle);
  }, []);

  // Инициализируем построитель свечей
  const { processTrade, reset } = useCandleBuilder(
    (interval as Timeframe) ?? "1m",
    handleCandleUpdate
  );

  // Подписка на символ и интервал
  useEffect(() => {
    if (isConnected && symbol && interval && enabled) {
      console.log(`[useCandlesWS] Subscribing to trades for ${symbol}`);
      subscribe("trade", { symbols: [symbol] });

      return () => {
        console.log(`[useCandlesWS] Unsubscribing from trades for ${symbol}`);
        unsubscribe("trade", { symbols: [symbol] });
      };
    }
  }, [isConnected, symbol, interval, enabled, subscribe, unsubscribe]);

  // Обработка входящих трейдов и построение свечей
  useEffect(() => {
    if (data && data.type === "trade" && data.data) {
      const trade = data.data as AggTrade;

      // Обрабатываем только трейды нашего символа
      if (symbol && trade.symbol === symbol) {
        processTrade(trade);
      }
    }
  }, [data, symbol, processTrade]);

  // Сброс состояния при размонтировании или смене символа/интервала
  useEffect(() => {
    console.log(
      `[useCandlesWS] Resetting candle builder for ${symbol} ${interval}`
    );
    setCandle(null);
    reset();
  }, [symbol, interval, reset]);

  return {
    candle,
    status,
    error,
    isConnected,
  };
}
