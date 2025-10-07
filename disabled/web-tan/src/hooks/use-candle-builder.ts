import type { AggTrade, Candle, Timeframe } from "@aladdin/core";
import { useCallback, useRef } from "react";

const MILLISECONDS_IN_SECOND = 1000;

/**
 * Утилита для построения свечей из трейдов
 *
 * @param timeframe - Таймфрейм для построения свечей (1m, 5m, 15m, 1h, 1d)
 * @param onCandleUpdate - Колбэк для обновления свечи
 */
export function useCandleBuilder(
  timeframe: Timeframe,
  onCandleUpdate: (candle: Candle) => void
) {
  // Храним текущую свечу
  const currentCandleRef = useRef<Candle | null>(null);

  /**
   * Получить начало временного окна для свечи
   */
  const getCandleTimestamp = useCallback(
    (tradeTimestamp: number): number => {
      const intervalMs = getIntervalMs(timeframe);
      return Math.floor(tradeTimestamp / intervalMs) * intervalMs;
    },
    [timeframe]
  );

  /**
   * Обработка трейда и обновление/создание свечи
   */
  const processTrade = useCallback(
    (trade: AggTrade) => {
      const candleTimestamp = getCandleTimestamp(trade.timestamp);
      const currentCandle = currentCandleRef.current;

      // Если это первый трейд или новая свеча
      if (
        !currentCandle ||
        currentCandle.timestamp !==
          Math.floor(candleTimestamp / MILLISECONDS_IN_SECOND)
      ) {
        // Создаем новую свечу
        const INITIAL_TRADE_COUNT = 1;
        const newCandle: Candle = {
          timestamp: Math.floor(candleTimestamp / MILLISECONDS_IN_SECOND), // Convert to seconds
          symbol: trade.symbol,
          timeframe,
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: trade.quantity,
          quoteVolume: trade.price * trade.quantity,
          trades: INITIAL_TRADE_COUNT,
          exchange: trade.exchange,
        };

        currentCandleRef.current = newCandle;
        onCandleUpdate(newCandle);
      } else {
        // Обновляем существующую свечу
        const updatedCandle: Candle = {
          ...currentCandle,
          high: Math.max(currentCandle.high, trade.price),
          low: Math.min(currentCandle.low, trade.price),
          close: trade.price,
          volume: currentCandle.volume + trade.quantity,
          quoteVolume: currentCandle.quoteVolume + trade.price * trade.quantity,
          trades: currentCandle.trades + 1,
        };

        currentCandleRef.current = updatedCandle;
        onCandleUpdate(updatedCandle);
      }
    },
    [timeframe, getCandleTimestamp, onCandleUpdate]
  );

  /**
   * Сбросить состояние построителя
   */
  const reset = useCallback(() => {
    currentCandleRef.current = null;
  }, []);

  return {
    processTrade,
    reset,
  };
}

/**
 * Получить интервал в миллисекундах для таймфрейма
 */
function getIntervalMs(timeframe: Timeframe): number {
  const SECONDS_IN_MINUTE = 60;
  const MINUTES_IN_HOUR = 60;
  const HOURS_IN_DAY = 24;
  const DAYS_IN_WEEK = 7;
  const MINUTES_IN_5M = 5;
  const MINUTES_IN_15M = 15;
  const MINUTES_IN_30M = 30;
  const HOURS_IN_4H = 4;

  const intervals: Record<Timeframe, number> = {
    "1m": SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND, // 1 минута
    "5m": MINUTES_IN_5M * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND, // 5 минут
    "15m": MINUTES_IN_15M * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND, // 15 минут
    "30m": MINUTES_IN_30M * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND, // 30 минут
    "1h": SECONDS_IN_MINUTE * MINUTES_IN_HOUR * MILLISECONDS_IN_SECOND, // 1 час
    "4h":
      HOURS_IN_4H *
      SECONDS_IN_MINUTE *
      MINUTES_IN_HOUR *
      MILLISECONDS_IN_SECOND, // 4 часа
    "1d":
      HOURS_IN_DAY *
      SECONDS_IN_MINUTE *
      MINUTES_IN_HOUR *
      MILLISECONDS_IN_SECOND, // 1 день
    "1w":
      DAYS_IN_WEEK *
      HOURS_IN_DAY *
      SECONDS_IN_MINUTE *
      MINUTES_IN_HOUR *
      MILLISECONDS_IN_SECOND, // 1 неделя
  };

  // По умолчанию 1 минута
  return intervals[timeframe] ?? SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND;
}
