import type { ClickHouseService } from "@aladdin/database";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import type { AggTrade, Candle, Timeframe } from "@aladdin/core";
import type { Subscription } from "nats";

const MILLISECONDS_IN_SECOND = 1000;
const FLUSH_INTERVAL_MS = 5000; // 5 секунд
const CANDLE_BUFFER_SIZE = 100; // Размер буфера перед записью в ClickHouse
const CANDLE_CHECK_INTERVAL_MS = 30_000; // 30 секунд - проверка закрытых свечей

type CandleBuilderOptions = {
  logger: Logger;
  natsClient: NatsClient;
  clickhouse: ClickHouseService;
  timeframes: Timeframe[];
};

/**
 * Сервис построения свечей из aggTrade событий
 *
 * Подписывается на aggTrade события через NATS и строит свечи
 * для различных таймфреймов (1m, 5m, 15m, 1h, 1d и т.д.)
 */
export class CandleBuilderService {
  private candles: Map<string, Candle> = new Map(); // key: symbol:timeframe:timestamp
  private candleBuffer: Candle[] = [];
  private flushTimer: Timer | null = null;
  private checkCandlesTimer: Timer | null = null;
  private subscriptions: Subscription[] = [];

  constructor(private options: CandleBuilderOptions) {}

  /**
   * Запуск сервиса
   */
  start(): void {
    const { logger, natsClient } = this.options;

    logger.info("Starting CandleBuilder service", {
      timeframes: this.options.timeframes,
    });

    // Подписываемся на все aggTrade события
    try {
      const subscription = natsClient.subscribe<AggTrade>(
        "market.aggTrade.*",
        (aggTrade: AggTrade) => {
          this.processAggTrade(aggTrade);
        }
      );

      this.subscriptions.push(subscription);
      logger.info("Subscribed to aggTrade events");
    } catch (error) {
      logger.error("Failed to subscribe to aggTrade events", error);
      throw error;
    }

    // Запускаем периодический сброс буфера
    this.flushTimer = setInterval(() => {
      this.flushCandleBuffer().catch((error) => {
        logger.error("Error flushing candle buffer", error);
      });
    }, FLUSH_INTERVAL_MS);

    // Запускаем периодическую проверку закрытых свечей
    this.checkCandlesTimer = setInterval(() => {
      this.checkAndCloseCandles();
    }, CANDLE_CHECK_INTERVAL_MS);

    logger.info("CandleBuilder service started");
  }

  /**
   * Остановка сервиса
   */
  async stop(): Promise<void> {
    const { logger } = this.options;

    logger.info("Stopping CandleBuilder service");

    // Отписываемся от всех событий
    for (const sub of this.subscriptions) {
      try {
        await sub.unsubscribe();
      } catch (error) {
        logger.error("Error unsubscribing from NATS", error);
      }
    }
    this.subscriptions = [];

    // Останавливаем таймеры
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.checkCandlesTimer) {
      clearInterval(this.checkCandlesTimer);
      this.checkCandlesTimer = null;
    }

    // Сбрасываем оставшиеся свечи
    await this.flushCandleBuffer();

    logger.info("CandleBuilder service stopped");
  }

  /**
   * Обработка aggTrade события
   */
  private processAggTrade(aggTrade: AggTrade): void {
    const { timeframes } = this.options;

    // Строим свечи для каждого таймфрейма
    for (const timeframe of timeframes) {
      this.updateCandle(aggTrade, timeframe);
    }
  }

  /**
   * Обновление свечи для заданного таймфрейма
   */
  private updateCandle(aggTrade: AggTrade, timeframe: Timeframe): void {
    const { logger, natsClient } = this.options;
    const candleTimestamp = this.getCandleTimestamp(
      aggTrade.timestamp,
      timeframe
    );
    const candleKey = `${aggTrade.symbol}:${timeframe}:${candleTimestamp}`;

    // Получаем существующую свечу или создаем новую
    const candle = this.candles.get(candleKey);

    if (candle) {
      // Обновляем существующую свечу
      candle.high = Math.max(candle.high, aggTrade.price);
      candle.low = Math.min(candle.low, aggTrade.price);
      candle.close = aggTrade.price;
      candle.volume += aggTrade.quantity;
      candle.quoteVolume += aggTrade.price * aggTrade.quantity;
      candle.trades += 1;
    } else {
      // Создаем новую свечу
      const newCandle: Candle = {
        timestamp: candleTimestamp,
        symbol: aggTrade.symbol,
        timeframe,
        open: aggTrade.price,
        high: aggTrade.price,
        low: aggTrade.price,
        close: aggTrade.price,
        volume: aggTrade.quantity,
        quoteVolume: aggTrade.price * aggTrade.quantity,
        trades: 1,
        exchange: aggTrade.exchange,
      };

      this.candles.set(candleKey, newCandle);

      logger.debug("Created new candle", {
        symbol: aggTrade.symbol,
        timeframe,
        timestamp: candleTimestamp,
        price: aggTrade.price,
      });
    }

    // Проверяем, закрылась ли свеча (начался новый временной интервал)
    const currentCandleTimestamp = this.getCandleTimestamp(
      Date.now(),
      timeframe
    );

    if (candleTimestamp >= currentCandleTimestamp) {
      return;
    }

    // Свеча закрылась, сохраняем её
    const completedCandle = this.candles.get(candleKey);
    if (completedCandle) {
      this.saveCandle(completedCandle);
      this.candles.delete(candleKey);

      // Публикуем закрытую свечу в NATS
      if (natsClient) {
        try {
          natsClient.publish(
            `market.candle.${timeframe}.${completedCandle.symbol}`,
            completedCandle
          );
        } catch (error) {
          logger.error("Failed to publish candle to NATS", error, {
            symbol: completedCandle.symbol,
            timeframe,
          });
        }
      }
    }
  }

  /**
   * Получить временную метку начала свечи для заданного таймфрейма
   */
  private getCandleTimestamp(timestamp: number, timeframe: Timeframe): number {
    const intervalMs = this.getIntervalMs(timeframe);
    return (
      (Math.floor(timestamp / intervalMs) * intervalMs) / MILLISECONDS_IN_SECOND
    );
  }

  /**
   * Получить интервал в миллисекундах для таймфрейма
   */
  private getIntervalMs(timeframe: Timeframe): number {
    const SECONDS_IN_MINUTE = 60;
    const MINUTES_IN_HOUR = 60;
    const HOURS_IN_DAY = 24;
    const DAYS_IN_WEEK = 7;
    const MINUTES_IN_5M = 5;
    const MINUTES_IN_15M = 15;
    const MINUTES_IN_30M = 30;
    const HOURS_IN_4H = 4;

    const intervals: Record<Timeframe, number> = {
      "1m": SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND,
      "5m": MINUTES_IN_5M * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND,
      "15m": MINUTES_IN_15M * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND,
      "30m": MINUTES_IN_30M * SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND,
      "1h": SECONDS_IN_MINUTE * MINUTES_IN_HOUR * MILLISECONDS_IN_SECOND,
      "4h":
        HOURS_IN_4H *
        SECONDS_IN_MINUTE *
        MINUTES_IN_HOUR *
        MILLISECONDS_IN_SECOND,
      "1d":
        HOURS_IN_DAY *
        SECONDS_IN_MINUTE *
        MINUTES_IN_HOUR *
        MILLISECONDS_IN_SECOND,
      "1w":
        DAYS_IN_WEEK *
        HOURS_IN_DAY *
        SECONDS_IN_MINUTE *
        MINUTES_IN_HOUR *
        MILLISECONDS_IN_SECOND,
    };

    return intervals[timeframe] ?? SECONDS_IN_MINUTE * MILLISECONDS_IN_SECOND;
  }

  /**
   * Сохранить свечу в буфер
   */
  private saveCandle(candle: Candle): void {
    const { logger } = this.options;

    this.candleBuffer.push(candle);

    logger.debug("Added candle to buffer", {
      symbol: candle.symbol,
      timeframe: candle.timeframe,
      timestamp: candle.timestamp,
      close: candle.close,
      volume: candle.volume,
      bufferSize: this.candleBuffer.length,
    });

    // Если буфер заполнен, сбрасываем немедленно
    if (this.candleBuffer.length >= CANDLE_BUFFER_SIZE) {
      this.flushCandleBuffer().catch((error) => {
        logger.error("Error flushing candle buffer", error);
      });
    }
  }

  /**
   * Проверить и закрыть все свечи, чей интервал уже завершился
   */
  private checkAndCloseCandles(): void {
    const { logger, natsClient, timeframes } = this.options;
    const now = Date.now();
    let closedCount = 0;

    // Для каждого таймфрейма получаем текущую временную метку
    const currentTimestamps = new Map<Timeframe, number>();
    for (const timeframe of timeframes) {
      currentTimestamps.set(timeframe, this.getCandleTimestamp(now, timeframe));
    }

    // Проходим по всем открытым свечам
    for (const [key, candle] of this.candles.entries()) {
      const currentTimestamp = currentTimestamps.get(candle.timeframe);

      // Если временная метка свечи меньше текущей - свеча закрылась
      if (
        currentTimestamp !== undefined &&
        candle.timestamp < currentTimestamp
      ) {
        // Сохраняем закрытую свечу
        this.saveCandle(candle);
        this.candles.delete(key);
        closedCount++;

        // Публикуем закрытую свечу в NATS (только если клиент доступен)
        if (natsClient) {
          try {
            natsClient.publish(
              `market.candle.${candle.timeframe}.${candle.symbol}`,
              candle
            );
          } catch (error) {
            logger.error("Failed to publish candle to NATS", error, {
              symbol: candle.symbol,
              timeframe: candle.timeframe,
            });
          }
        }

        logger.debug("Closed candle by timer", {
          symbol: candle.symbol,
          timeframe: candle.timeframe,
          timestamp: candle.timestamp,
          close: candle.close,
          volume: candle.volume,
        });
      }
    }

    if (closedCount > 0) {
      logger.info("Closed candles by timer", {
        count: closedCount,
        remainingCandles: this.candles.size,
      });
    }
  }

  /**
   * Сброс буфера свечей в ClickHouse
   */
  private async flushCandleBuffer(): Promise<void> {
    if (this.candleBuffer.length === 0) {
      return;
    }

    const { logger, clickhouse } = this.options;
    const candlesToFlush = [...this.candleBuffer];
    this.candleBuffer = [];

    try {
      const startTime = Date.now();
      await clickhouse.insert("candles", candlesToFlush);
      const duration = Date.now() - startTime;

      logger.info("Flushed candles to ClickHouse", {
        count: candlesToFlush.length,
        duration: `${duration}ms`,
      });
    } catch (error) {
      logger.error("Failed to flush candles to ClickHouse", error, {
        count: candlesToFlush.length,
      });

      // Возвращаем свечи обратно в буфер для повторной попытки
      this.candleBuffer.push(...candlesToFlush);
    }
  }
}
