import type { Tick } from "@aladdin/shared/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "./use-websocket";

const isDevelopment = import.meta.env.DEV;

/**
 * Hook для получения real-time котировок через WebSocket
 *
 * @param symbol - символ инструмента (например, "BTCUSDT")
 * @returns объект с текущей котировкой, статусом и ошибкой
 *
 * @example
 * ```tsx
 * const { quote, isConnected } = useMarketDataWS("BTCUSDT");
 *
 * if (!isConnected) {
 *   return <div>Подключение...</div>;
 * }
 *
 * return <div>Цена BTC: ${quote?.price}</div>;
 * ```
 */
export function useMarketDataWS(symbol?: string) {
  const [quote, setQuote] = useState<Tick | null>(null);
  const { status, data, error, subscribe, unsubscribe, isConnected } =
    useWebSocket<MarketDataMessage>();

  // Используем ref для отслеживания предыдущего символа
  const prevSymbolRef = useRef<string | undefined>(symbol);

  // Мемоизируем обработчик обновлений
  const handleTickUpdate = useCallback((tick: Tick, currentSymbol?: string) => {
    if (!currentSymbol || tick.symbol === currentSymbol) {
      if (isDevelopment) {
        console.log(
          "[useMarketDataWS] Received tick for",
          currentSymbol,
          ":",
          tick.price
        );
      }
      setQuote(tick);
    }
  }, []);

  // Подписка на символ
  useEffect(() => {
    if (isConnected && symbol) {
      if (isDevelopment) {
        console.log(`[useMarketDataWS] Subscribing to ${symbol}`);
      }
      subscribe("tick", { symbols: [symbol] });

      return () => {
        if (isDevelopment) {
          console.log(`[useMarketDataWS] Unsubscribing from ${symbol}`);
        }
        unsubscribe("tick", { symbols: [symbol] });
      };
    }
  }, [isConnected, symbol, subscribe, unsubscribe]);

  // Обработка входящих сообщений
  useEffect(() => {
    if (data && data.type === "tick" && data.data) {
      const tick = data.data as Tick;
      handleTickUpdate(tick, symbol);
    }
  }, [data, symbol, handleTickUpdate]);

  // Сброс состояния при смене символа
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      if (isDevelopment) {
        console.log("[useMarketDataWS] Symbol changed, resetting quote");
      }
      setQuote(null);
      prevSymbolRef.current = symbol;
    }
  }, [symbol]);

  return {
    quote,
    status,
    error,
    isConnected,
  };
}

/**
 * Hook для получения котировок нескольких символов
 *
 * @param symbols - массив символов
 * @returns map с котировками по символам
 */
export function useMarketDataMultiWS(symbols: string[]) {
  const [quotes, setQuotes] = useState<Map<string, Tick>>(new Map());
  const { status, data, error, subscribe, unsubscribe, isConnected } =
    useWebSocket<MarketDataMessage>();

  // Мемоизируем массив символов для стабильной ссылки
  const memoizedSymbols = useMemo(() => symbols, [JSON.stringify(symbols)]);

  useEffect(() => {
    if (isConnected && memoizedSymbols.length > 0) {
      subscribe("tick", { symbols: memoizedSymbols });

      return () => {
        unsubscribe("tick", { symbols: memoizedSymbols });
      };
    }
  }, [isConnected, memoizedSymbols, subscribe, unsubscribe]);

  // Мемоизируем обработчик обновлений
  const handleTickUpdate = useCallback((tick: Tick) => {
    setQuotes((prev) => {
      // Проверяем, изменилась ли цена перед обновлением
      const existingTick = prev.get(tick.symbol);
      if (
        existingTick?.price === tick.price &&
        existingTick?.bid === tick.bid &&
        existingTick?.ask === tick.ask
      ) {
        return prev; // Не обновляем если данные не изменились
      }

      const next = new Map(prev);
      next.set(tick.symbol, tick);
      return next;
    });
  }, []);

  useEffect(() => {
    if (data && data.type === "tick" && data.data) {
      const tick = data.data as Tick;
      handleTickUpdate(tick);
    }
  }, [data, handleTickUpdate]);

  return {
    quotes,
    status,
    error,
    isConnected,
  };
}

/**
 * Типы сообщений от Market Data WebSocket
 */
type MarketDataMessage =
  | {
      type: "tick";
      data: Tick;
    }
  | {
      type: "candle";
      data: unknown;
    }
  | {
      type: "pong";
    }
  | {
      type: "error";
      message: string;
    }
  | {
      type: "subscribed";
      channel: string;
      symbols: string[];
    }
  | {
      type: "unsubscribed";
      channel: string;
      symbols: string[];
    };
