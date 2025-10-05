import type { Logger } from "@aladdin/logger";
import type { AggTrade, Candle, Tick } from "@aladdin/core";
import WebSocket from "ws";
import type { ExchangeConnector, OrderBook, RecentTrade } from "./types";

type BinanceConnectorOptions = {
  logger: Logger;
  wsUrl?: string;
  apiUrl?: string;
};

type BinanceTickerData = {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Volume
  q: string; // Quote volume
  b: string; // Best bid price
  B: string; // Best bid quantity
  a: string; // Best ask price
  A: string; // Best ask quantity
};

type BinanceAggTradeData = {
  e: string; // Event type "aggTrade"
  E: number; // Event time
  s: string; // Symbol
  a: number; // Aggregate trade ID
  p: string; // Price
  q: string; // Quantity
  f: number; // First trade ID
  l: number; // Last trade ID
  T: number; // Trade time
  m: boolean; // Is buyer maker?
  M: boolean; // Ignore
};

const RECONNECT_DELAY_MS = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const MILLISECONDS_TO_SECONDS = 1000;

export class BinanceConnector implements ExchangeConnector {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private eventHandlers: Map<string, Set<(...args: unknown[]) => void>> =
    new Map();
  private reconnectTimer: Timer | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  private reconnectDelay = RECONNECT_DELAY_MS;

  constructor(private options: BinanceConnectorOptions) {}

  /**
   * Подключение к Binance WebSocket
   */
  connect(): Promise<void> {
    const { logger, wsUrl = "wss://stream.binance.com:9443" } = this.options;

    return new Promise((resolve, reject) => {
      try {
        // Формируем URL для множественных стримов (тикеры + aggTrade)
        const streams: string[] = [];

        for (const symbol of this.subscriptions) {
          const symbolLower = symbol.toLowerCase();
          // Добавляем тикер для price updates
          streams.push(`${symbolLower}@ticker`);
          // Добавляем aggTrade стрим для получения реальных сделок
          streams.push(`${symbolLower}@aggTrade`);
        }

        const url =
          streams.length > 0
            ? `${wsUrl}/stream?streams=${streams.join("/")}`
            : `${wsUrl}/ws`;

        this.ws = new WebSocket(url);

        this.ws.on("open", () => {
          logger.info("Connected to Binance WebSocket");
          this.reconnectAttempts = 0;
          this.emit("connected");
          resolve();
        });

        this.ws.on("message", (data: WebSocket.RawData) => {
          try {
            const message = JSON.parse(data.toString()) as
              | {
                  stream?: string;
                  data: BinanceTickerData | BinanceAggTradeData;
                }
              | BinanceTickerData
              | BinanceAggTradeData;

            const eventData = "stream" in message ? message.data : message;

            if (eventData.e === "24hrTicker") {
              this.handleTickerUpdate(eventData as BinanceTickerData);
            } else if (eventData.e === "aggTrade") {
              this.handleAggTradeUpdate(eventData as BinanceAggTradeData);
            }
          } catch (error) {
            logger.error("Failed to parse WebSocket message", error);
          }
        });

        this.ws.on("error", (error: Error) => {
          logger.error("Binance WebSocket error", error);
          this.emit("error", error);
          reject(error);
        });

        this.ws.on("close", () => {
          logger.warn("Binance WebSocket connection closed");
          this.emit("disconnected");
          this.attemptReconnect();
        });

        this.ws.on("ping", () => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.pong();
          }
        });
      } catch (error) {
        logger.error("Failed to connect to Binance WebSocket", error);
        reject(error);
      }
    });
  }

  /**
   * Отключение от Binance WebSocket
   */
  disconnect(): Promise<void> {
    const { logger } = this.options;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Удаляем обработчики событий перед закрытием
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
      logger.info("Disconnected from Binance WebSocket");
    }

    return Promise.resolve();
  }

  /**
   * Подписка на символ
   */
  async subscribe(symbol: string): Promise<void> {
    const { logger } = this.options;

    this.subscriptions.add(symbol);
    logger.info("Adding symbol subscription", {
      symbol,
      totalSubscriptions: this.subscriptions.size,
      wsState: this.ws?.readyState,
    });

    // Если уже подключены, переподключаемся с новой подпиской
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.info("Reconnecting to add new symbol", { symbol });
      await this.disconnect();
      await this.connect();
      logger.info("Reconnected with new symbol", { symbol });
    } else if (!this.ws) {
      logger.info("Connecting for the first time", { symbol });
      await this.connect();
    }
  }

  /**
   * Batch подписка на несколько символов
   */
  async subscribeBatch(symbols: string[]): Promise<void> {
    const { logger } = this.options;

    for (const symbol of symbols) {
      this.subscriptions.add(symbol);
    }

    logger.info("Adding batch symbol subscriptions", {
      symbols,
      totalSubscriptions: this.subscriptions.size,
      wsState: this.ws?.readyState,
    });

    // Переподключаемся один раз со всеми символами
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.info("Reconnecting for batch subscription", {
        count: symbols.length,
      });
      await this.disconnect();
      await this.connect();
      logger.info("Reconnected with all symbols", { count: symbols.length });
    } else if (!this.ws) {
      logger.info("Connecting with batch symbols", { count: symbols.length });
      await this.connect();
    }
  }

  /**
   * Отписка от символа
   */
  async unsubscribe(symbol: string): Promise<void> {
    this.subscriptions.delete(symbol);

    // Переподключаемся без этого символа
    if (this.ws?.readyState === WebSocket.OPEN) {
      await this.disconnect();
      if (this.subscriptions.size > 0) {
        await this.connect();
      }
    }
  }

  /**
   * Подписка на события
   */
  on(event: "tick", handler: (tick: Tick) => void): void;
  on(event: "candle", handler: (candle: Candle) => void): void;
  on(event: "error", handler: (error: Error) => void): void;
  on(event: "connected" | "disconnected", handler: () => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  /**
   * Отписка от событий
   */
  off(event: string, handler: (...args: unknown[]) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Обработка обновления тикера
   */
  private handleTickerUpdate(data: BinanceTickerData): void {
    const tick: Tick = {
      timestamp: data.E,
      symbol: data.s,
      price: Number.parseFloat(data.c),
      volume: Number.parseFloat(data.v),
      exchange: "binance",
      bid: Number.parseFloat(data.b),
      ask: Number.parseFloat(data.a),
      bidVolume: Number.parseFloat(data.B),
      askVolume: Number.parseFloat(data.A),
    };

    this.emit("tick", tick);
  }

  /**
   * Обработка aggTrade обновлений
   */
  private handleAggTradeUpdate(data: BinanceAggTradeData): void {
    const aggTrade: AggTrade = {
      timestamp: data.E, // Event time in milliseconds
      symbol: data.s,
      tradeId: data.a,
      price: Number.parseFloat(data.p),
      quantity: Number.parseFloat(data.q),
      isBuyerMaker: data.m,
      exchange: "binance",
    };

    // Генерируем событие aggTrade для построения свечей на клиенте
    this.emit("aggTrade", aggTrade);
  }

  /**
   * Попытка переподключения
   */
  private attemptReconnect(): void {
    const { logger } = this.options;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    logger.info("Attempting to reconnect to Binance WebSocket", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        logger.error("Reconnection failed", error);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Получить order book (depth) через REST API
   */
  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const { apiUrl = "https://api.binance.com", logger } = this.options;

    try {
      const url = `${apiUrl}/api/v3/depth?symbol=${symbol}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        lastUpdateId: number;
        bids: string[][];
        asks: string[][];
      };

      return {
        symbol,
        timestamp: Date.now(),
        lastUpdateId: data.lastUpdateId,
        bids: data.bids.map(([price, qty]) => [
          Number.parseFloat(price),
          Number.parseFloat(qty),
        ]),
        asks: data.asks.map(([price, qty]) => [
          Number.parseFloat(price),
          Number.parseFloat(qty),
        ]),
      };
    } catch (error) {
      logger.error(`Failed to fetch order book for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Получить все доступные торговые пары с Binance
   */
  async getAllSymbols(): Promise<string[]> {
    const { apiUrl = "https://api.binance.com", logger } = this.options;

    try {
      const url = `${apiUrl}/api/v3/exchangeInfo`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        symbols: Array<{
          symbol: string;
          status: string;
          baseAsset: string;
          quoteAsset: string;
        }>;
      };

      // Фильтруем только активные USDT пары
      return data.symbols
        .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
        .map((s) => s.symbol)
        .sort();
    } catch (error) {
      logger.error("Failed to fetch Binance symbols", error);
      throw error;
    }
  }

  /**
   * Получить недавние сделки через REST API
   */
  async getRecentTrades(symbol: string, limit = 100): Promise<RecentTrade[]> {
    const { apiUrl = "https://api.binance.com", logger } = this.options;

    try {
      const url = `${apiUrl}/api/v3/trades?symbol=${symbol}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as Array<{
        id: number;
        price: string;
        qty: string;
        quoteQty: string;
        time: number;
        isBuyerMaker: boolean;
        isBestMatch: boolean;
      }>;

      return data.map((trade) => ({
        id: trade.id,
        price: Number.parseFloat(trade.price),
        qty: Number.parseFloat(trade.qty),
        quoteQty: Number.parseFloat(trade.quoteQty),
        time: trade.time,
        isBuyerMaker: trade.isBuyerMaker,
      }));
    } catch (error) {
      logger.error(`Failed to fetch recent trades for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Получить исторические свечи через REST API
   */
  async getHistoricalCandles(
    symbol: string,
    interval: string,
    limit: number
  ): Promise<Candle[]> {
    const { apiUrl = "https://api.binance.com", logger } = this.options;

    // Маппинг timeframe в формат Binance
    const intervalMap: Record<string, string> = {
      "1m": "1m",
      "5m": "5m",
      "15m": "15m",
      "1h": "1h",
      "4h": "4h",
      "1d": "1d",
    };

    const binanceInterval = intervalMap[interval] ?? interval;

    try {
      const url = `${apiUrl}/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as [
        number, // 0: Open time
        string, // 1: Open
        string, // 2: High
        string, // 3: Low
        string, // 4: Close
        string, // 5: Volume
        number, // 6: Close time
        string, // 7: Quote asset volume
        number, // 8: Number of trades
        string, // 9: Taker buy base asset volume
        string, // 10: Taker buy quote asset volume
        string, // 11: Ignore
      ][];

      const candles: Candle[] = data.map((item) => ({
        timestamp: Math.floor(item[0] / MILLISECONDS_TO_SECONDS), // Convert milliseconds to seconds for ClickHouse DateTime
        symbol,
        timeframe: interval,
        open: Number.parseFloat(item[1]),
        high: Number.parseFloat(item[2]),
        low: Number.parseFloat(item[3]),
        close: Number.parseFloat(item[4]),
        volume: Number.parseFloat(item[5]),
        quoteVolume: Number.parseFloat(item[7]),
        trades: item[8],
        exchange: "binance",
      }));

      return candles;
    } catch (error) {
      logger.error(
        "Failed to fetch historical candles from Binance",
        error as Error,
        {
          symbol,
          interval,
          limit,
        }
      );
      throw error;
    }
  }

  /**
   * Генерация события
   */
  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          this.options.logger.error("Error in event handler", error as Error, {
            event,
          });
        }
      }
    }
  }
}
