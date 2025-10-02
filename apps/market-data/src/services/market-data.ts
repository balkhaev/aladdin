import type { ClickHouseService } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";
import type { NatsClient } from "@aladdin/shared/nats";
import type { AggTrade, Candle, Tick } from "@aladdin/shared/types";
import type { ExchangeConnector } from "../connectors/types";

type MarketDataServiceOptions = {
  logger: Logger;
  natsClient: NatsClient;
  clickhouse: ClickHouseService;
  connector: ExchangeConnector;
};

const DEFAULT_TICK_BUFFER_SIZE = 1000;
const FLUSH_INTERVAL_MS = 5000; // 5 seconds

export class MarketDataService {
  private ticks: Map<string, Tick> = new Map(); // Latest tick per symbol
  private tickBuffer: Tick[] = []; // Buffer for batch insert
  private aggTradeBuffer: AggTrade[] = []; // Buffer for aggTrades batch insert
  private bufferSize =
    Number(process.env.TICK_BUFFER_SIZE) || DEFAULT_TICK_BUFFER_SIZE;
  private flushInterval = FLUSH_INTERVAL_MS;
  private flushTimer: Timer | null = null;
  private aggTradeFlushTimer: Timer | null = null;
  private tickListeners: Set<(tick: Tick) => void> = new Set();
  private candleListeners: Set<(candle: Candle) => void> = new Set();
  private aggTradeListeners: Set<(aggTrade: AggTrade) => void> = new Set();

  constructor(private options: MarketDataServiceOptions) {}

  /**
   * Инициализация сервиса
   */
  initialize(): void {
    const { connector, logger } = this.options;

    // Подписываемся на события от коннектора
    connector.on("tick", (tick: Tick) => {
      this.handleTick(tick).catch((error) =>
        logger.error("Error handling tick", error)
      );
    });
    connector.on("aggTrade", (aggTrade: AggTrade) => {
      this.handleAggTrade(aggTrade).catch((error) =>
        logger.error("Error handling aggTrade", error)
      );
    });
    connector.on("error", (error: Error) =>
      logger.error("Connector error", error)
    );

    // Запускаем таймер для сброса буфера тиков
    this.flushTimer = setInterval(() => {
      this.flushTickBuffer().catch((error) =>
        logger.error("Error flushing tick buffer", error)
      );
    }, this.flushInterval);

    // Запускаем таймер для сброса буфера aggTrades
    this.aggTradeFlushTimer = setInterval(() => {
      this.flushAggTradeBuffer().catch((error) =>
        logger.error("Error flushing aggTrade buffer", error)
      );
    }, this.flushInterval);

    logger.info("Market Data Service initialized");
  }

  /**
   * Остановка сервиса
   */
  async stop(): Promise<void> {
    const { connector, logger } = this.options;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    if (this.aggTradeFlushTimer) {
      clearInterval(this.aggTradeFlushTimer);
    }

    // Сбрасываем оставшиеся данные в ClickHouse
    await this.flushTickBuffer();
    await this.flushAggTradeBuffer();

    await connector.disconnect();
    logger.info("Market Data Service stopped");
  }

  /**
   * Подписка на символ
   */
  async subscribeToSymbol(symbol: string): Promise<void> {
    const { connector, logger } = this.options;
    await connector.subscribe(symbol);
    logger.info("Subscribed to symbol", { symbol });
  }

  /**
   * Batch подписка на несколько символов
   */
  async subscribeToSymbols(symbols: string[]): Promise<void> {
    const { connector, logger } = this.options;

    // Check if connector has batch subscribe method
    if (
      "subscribeBatch" in connector &&
      typeof connector.subscribeBatch === "function"
    ) {
      await (
        connector as { subscribeBatch: (symbols: string[]) => Promise<void> }
      ).subscribeBatch(symbols);
      logger.info("Batch subscribed to symbols", {
        symbols,
        count: symbols.length,
      });
    } else {
      // Fallback to individual subscriptions
      for (const symbol of symbols) {
        await connector.subscribe(symbol);
      }
      logger.info("Subscribed to symbols individually", {
        symbols,
        count: symbols.length,
      });
    }
  }

  /**
   * Отписка от символа
   */
  async unsubscribeFromSymbol(symbol: string): Promise<void> {
    const { connector, logger } = this.options;
    await connector.unsubscribe(symbol);
    logger.info("Unsubscribed from symbol", { symbol });
  }

  /**
   * Получить список доступных тикеров
   */
  getAvailableTickers(): string[] {
    return Array.from(this.ticks.keys());
  }

  /**
   * Получить последнюю котировку
   */
  getQuote(symbol: string): Tick | null {
    return this.ticks.get(symbol) ?? null;
  }

  /**
   * Получить коннектор для прямого доступа к методам биржи
   */
  getConnector(): ExchangeConnector {
    return this.options.connector;
  }

  /**
   * Подписка на события тиков
   */
  onTick(callback: (tick: Tick) => void): void {
    this.tickListeners.add(callback);
  }

  /**
   * Отписка от событий тиков
   */
  offTick(callback: (tick: Tick) => void): void {
    this.tickListeners.delete(callback);
  }

  /**
   * Подписка на события свечей
   */
  onCandle(callback: (candle: Candle) => void): void {
    this.candleListeners.add(callback);
  }

  /**
   * Отписка от событий свечей
   */
  offCandle(callback: (candle: Candle) => void): void {
    this.candleListeners.delete(callback);
  }

  /**
   * Подписка на события aggTrade
   */
  onAggTrade(callback: (aggTrade: AggTrade) => void): void {
    this.aggTradeListeners.add(callback);
  }

  /**
   * Отписка от событий aggTrade
   */
  offAggTrade(callback: (aggTrade: AggTrade) => void): void {
    this.aggTradeListeners.delete(callback);
  }

  /**
   * Получить исторические свечи из ClickHouse или Binance
   * Фильтрует пустые свечи (с нулевым объемом) и загружает больше данных при необходимости
   */
  async getCandles(
    symbol: string,
    timeframe: string,
    limit = 100
  ): Promise<Candle[]> {
    const { clickhouse, connector, logger } = this.options;

    try {
      // Сначала пытаемся получить из ClickHouse
      // Загружаем больше свечей, чтобы после фильтрации пустых осталось достаточно
      const CACHE_MULTIPLIER = 2;
      const cacheLimit = limit * CACHE_MULTIPLIER;

      const cachedCandles = await clickhouse.query<Candle>(
        `WITH unique_timestamps AS (
           SELECT DISTINCT timestamp
           FROM candles
           WHERE symbol = {symbol:String} 
             AND timeframe = {timeframe:String}
             AND volume > 0
           ORDER BY timestamp DESC
           LIMIT {limit:UInt32}
         )
         SELECT 
           toUnixTimestamp(c.timestamp) as timestamp,
           c.symbol as symbol,
           c.timeframe as timeframe,
           c.open as open,
           c.high as high,
           c.low as low,
           c.close as close,
           c.volume as volume,
           c.quoteVolume as quoteVolume,
           c.trades as trades,
           c.exchange as exchange
         FROM (
           SELECT 
             timestamp,
             symbol,
             timeframe,
             open,
             high,
             low,
             close,
             volume,
             quoteVolume,
             trades,
             exchange,
             row_number() OVER (PARTITION BY timestamp ORDER BY _part DESC) as rn
           FROM candles
           WHERE symbol = {symbol:String} 
             AND timeframe = {timeframe:String}
             AND timestamp IN (SELECT timestamp FROM unique_timestamps)
         ) c
         WHERE c.rn = 1
         ORDER BY timestamp DESC`,
        { symbol, timeframe, limit: cacheLimit }
      );

      // Если есть достаточно данных в кэше, возвращаем их
      if (cachedCandles.length >= limit) {
        logger.debug("Retrieved candles from ClickHouse cache", {
          symbol,
          timeframe,
          count: cachedCandles.length,
        });
        // Фильтруем пустые свечи и берем нужное количество
        const filteredCandles = cachedCandles
          .filter((c) => c.volume > 0 && c.trades > 0)
          .slice(0, limit)
          .sort((a, b) => a.timestamp - b.timestamp);

        return filteredCandles;
      }

      // Иначе получаем из Binance API
      // Загружаем больше свечей, чтобы после фильтрации осталось достаточно
      const API_MULTIPLIER = 3;
      const apiLimit = Math.min(limit * API_MULTIPLIER, 1000);

      logger.info("Fetching candles from Binance API", {
        symbol,
        timeframe,
        requestedLimit: limit,
        apiLimit,
        cachedCount: cachedCandles.length,
      });

      // Проверяем, поддерживает ли коннектор метод getHistoricalCandles
      if (
        "getHistoricalCandles" in connector &&
        typeof (
          connector as {
            getHistoricalCandles?: (
              symbol: string,
              timeframe: string,
              limit: number
            ) => Promise<Candle[]>;
          }
        ).getHistoricalCandles === "function"
      ) {
        const candles = await (
          connector as {
            getHistoricalCandles: (
              symbol: string,
              timeframe: string,
              limit: number
            ) => Promise<Candle[]>;
          }
        ).getHistoricalCandles(symbol, timeframe, apiLimit);

        // Сохраняем в ClickHouse для будущих запросов
        if (candles.length > 0) {
          try {
            await clickhouse.insert("candles", candles);
            logger.info("Cached candles to ClickHouse", {
              symbol,
              timeframe,
              count: candles.length,
            });
          } catch (insertError) {
            logger.error("Failed to cache candles to ClickHouse", insertError, {
              symbol,
              timeframe,
            });
            // Не прерываем выполнение, если кэширование не удалось
          }
        }

        // Фильтруем пустые свечи и возвращаем нужное количество
        const filteredCandles = candles
          .filter((c) => c.volume > 0 && c.trades > 0)
          .slice(0, limit);

        logger.info("Filtered empty candles", {
          symbol,
          timeframe,
          original: candles.length,
          filtered: filteredCandles.length,
          emptyCandles: candles.length - filteredCandles.length,
        });

        return filteredCandles;
      }

      // Если коннектор не поддерживает получение исторических данных
      logger.warn("Connector does not support historical candles", {
        symbol,
        timeframe,
      });
      return cachedCandles
        .filter((c) => c.volume > 0 && c.trades > 0)
        .slice(0, limit)
        .reverse();
    } catch (error) {
      logger.error("Failed to get candles", error, {
        symbol,
        timeframe,
      });
      return [];
    }
  }

  /**
   * Получить последние тики из ClickHouse
   */
  async getRecentTicks(symbol: string, limit = 100): Promise<Tick[]> {
    const { clickhouse, logger } = this.options;

    try {
      const ticks = await clickhouse.query<Tick>(
        `SELECT * FROM ticks 
         WHERE symbol = {symbol:String}
         ORDER BY timestamp DESC 
         LIMIT {limit:UInt32}`,
        { symbol, limit }
      );

      return ticks.reverse();
    } catch (error) {
      logger.error("Failed to get ticks from ClickHouse", error, { symbol });
      return [];
    }
  }

  /**
   * Обработка нового тика
   */
  private async handleTick(tick: Tick): Promise<void> {
    const { natsClient, logger } = this.options;

    // Сохраняем последний тик
    this.ticks.set(tick.symbol, tick);

    // Добавляем в буфер для записи в ClickHouse
    this.tickBuffer.push(tick);

    // Уведомляем всех подписчиков (WebSocket clients)
    for (const listener of this.tickListeners) {
      try {
        listener(tick);
      } catch (error) {
        logger.error("Tick listener error", error);
      }
    }

    // Публикуем в NATS для других сервисов
    try {
      await natsClient.publish(`market.tick.${tick.symbol}`, tick);
    } catch (error) {
      logger.error("Failed to publish tick to NATS", error, {
        symbol: tick.symbol,
      });
    }

    // Если буфер заполнен, сбрасываем немедленно
    if (this.tickBuffer.length >= this.bufferSize) {
      await this.flushTickBuffer();
    }
  }

  /**
   * Обработка новой свечи (используется только для исторических данных)
   */
  private async handleCandle(candle: Candle): Promise<void> {
    const { natsClient, clickhouse, logger } = this.options;

    // Уведомляем слушателей
    for (const listener of this.candleListeners) {
      try {
        listener(candle);
      } catch (error) {
        logger.error("Error in candle listener", error);
      }
    }

    // Публикуем в NATS
    try {
      await natsClient.publish(
        `market.candle.${candle.timeframe}.${candle.symbol}`,
        candle
      );
    } catch (error) {
      logger.error("Failed to publish candle to NATS", error, {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
      });
    }

    // Сохраняем в ClickHouse
    try {
      await clickhouse.insert("candles", [candle]);
    } catch (error) {
      logger.error("Failed to insert candle into ClickHouse", error, {
        symbol: candle.symbol,
        timeframe: candle.timeframe,
      });
    }
  }

  /**
   * Обработка aggTrade события
   */
  private async handleAggTrade(aggTrade: AggTrade): Promise<void> {
    const { natsClient, logger } = this.options;

    logger.debug("Received aggTrade", {
      symbol: aggTrade.symbol,
      price: aggTrade.price,
      quantity: aggTrade.quantity,
      bufferSize: this.aggTradeBuffer.length,
    });

    // Добавляем в буфер для записи в ClickHouse
    this.aggTradeBuffer.push(aggTrade);

    // Уведомляем всех подписчиков (WebSocket clients)
    for (const listener of this.aggTradeListeners) {
      try {
        listener(aggTrade);
      } catch (error) {
        logger.error("AggTrade listener error", error);
      }
    }

    // Публикуем в NATS для других сервисов
    try {
      await natsClient.publish(`market.aggTrade.${aggTrade.symbol}`, aggTrade);
    } catch (error) {
      logger.error("Failed to publish aggTrade to NATS", error, {
        symbol: aggTrade.symbol,
      });
    }

    // Если буфер заполнен, сбрасываем немедленно
    if (this.aggTradeBuffer.length >= this.bufferSize) {
      await this.flushAggTradeBuffer();
    }
  }

  /**
   * Сброс буфера тиков в ClickHouse
   */
  private async flushTickBuffer(): Promise<void> {
    if (this.tickBuffer.length === 0) {
      return;
    }

    const { clickhouse, logger } = this.options;
    const ticks = [...this.tickBuffer];
    this.tickBuffer = [];

    try {
      await clickhouse.insert("ticks", ticks);
      logger.debug("Flushed tick buffer to ClickHouse", {
        count: ticks.length,
      });
    } catch (error) {
      logger.error("Failed to flush tick buffer to ClickHouse", error, {
        count: ticks.length,
      });
      // В случае ошибки возвращаем тики обратно в буфер (с ограничением)
      this.tickBuffer = [
        ...ticks.slice(-this.bufferSize / 2),
        ...this.tickBuffer,
      ];
    }
  }

  /**
   * Сброс буфера aggTrades в ClickHouse
   */
  private async flushAggTradeBuffer(): Promise<void> {
    if (this.aggTradeBuffer.length === 0) {
      return;
    }

    const { clickhouse, logger } = this.options;
    const aggTrades = [...this.aggTradeBuffer];
    this.aggTradeBuffer = [];

    try {
      await clickhouse.insert("agg_trades", aggTrades);
      logger.debug("Flushed aggTrade buffer to ClickHouse", {
        count: aggTrades.length,
      });
    } catch (error) {
      logger.error("Failed to flush aggTrade buffer to ClickHouse", error, {
        count: aggTrades.length,
      });
      // В случае ошибки возвращаем aggTrades обратно в буфер (с ограничением)
      this.aggTradeBuffer = [
        ...aggTrades.slice(-this.bufferSize / 2),
        ...this.aggTradeBuffer,
      ];
    }
  }
}
