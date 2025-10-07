/**
 * Multi-Symbol WebSocket Hook
 * Эффективная подписка на несколько символов одновременно для ticker bars
 */

import type { Tick } from "@aladdin/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWebSocket } from "./use-websocket";

type TickMessage = {
  type: "tick";
  data: Tick;
};

type TickerData = {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  lastUpdate: number;
};

/**
 * Hook для подписки на несколько символов одновременно
 * Оптимизирован для ticker bars с минимальным количеством ререндеров
 *
 * @param symbols - Массив символов для подписки
 * @param enabled - Включить подписку
 *
 * @example
 * ```tsx
 * const { tickers, isConnected } = useMultiSymbolWS(["BTCUSDT", "ETHUSDT"]);
 * ```
 */
export function useMultiSymbolWS(symbols: string[], enabled = true) {
  const [tickers, setTickers] = useState<Map<string, TickerData>>(new Map());
  const { status, data, subscribe, unsubscribe, isConnected } =
    useWebSocket<TickMessage>();

  // Подписка на символы
  useEffect(() => {
    if (!(isConnected && enabled && symbols.length > 0)) {
      return;
    }

    // Подписываемся на канал tick для всех символов
    subscribe("tick", { symbols });

    return () => {
      unsubscribe("tick", { symbols });
    };
  }, [isConnected, enabled, symbols, subscribe, unsubscribe]);

  // Обработка входящих тиков
  useEffect(() => {
    if (!data || data.type !== "tick") {
      return;
    }

    const tick = data.data;

    // Обновляем только если символ в нашем списке
    if (symbols.includes(tick.symbol)) {
      setTickers((prev) => {
        const newTickers = new Map(prev);
        newTickers.set(tick.symbol, {
          symbol: tick.symbol,
          price: tick.price,
          priceChange: tick.priceChange ?? 0,
          priceChangePercent: tick.priceChangePercent ?? 0,
          lastUpdate: Date.now(),
        });
        return newTickers;
      });
    }
  }, [data, symbols]);

  // Преобразуем Map в массив для удобства использования
  const tickersArray = useMemo(() => Array.from(tickers.values()), [tickers]);

  // Получить данные конкретного символа
  const getTicker = useCallback(
    (symbol: string): TickerData | undefined => tickers.get(symbol),
    [tickers]
  );

  return {
    tickers: tickersArray,
    tickersMap: tickers,
    getTicker,
    status,
    isConnected: isConnected && enabled,
  };
}
