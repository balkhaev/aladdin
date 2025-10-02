import type { Logger } from "@aladdin/shared/logger";
import type { Candle, Tick } from "@aladdin/shared/types";
import WebSocket from "ws";
import type { ExchangeConnector, OrderBook, RecentTrade } from "./types";

type OKXConnectorOptions = {
  logger: Logger;
  wsUrl?: string;
  apiUrl?: string;
};

type OKXTickerData = {
  arg: {
    channel: string;
    instId: string;
  };
  data: Array<{
    instType: string;
    instId: string;
    last: string;
    lastSz: string;
    askPx: string;
    askSz: string;
    bidPx: string;
    bidSz: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
    vol24h: string;
    ts: string;
  }>;
};

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL_MS = 20_000;
const MAX_ORDER_BOOK_LIMIT = 400;
const MAX_TRADES_LIMIT = 500;

export class OKXConnector implements ExchangeConnector {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private eventHandlers: Map<string, Set<(...args: unknown[]) => void>> =
    new Map();
  private reconnectTimer: Timer | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  private reconnectDelay = RECONNECT_DELAY_MS;
  private pingInterval: Timer | null = null;

  constructor(private options: OKXConnectorOptions) {}

  /**
   * Подключение к OKX WebSocket
   */
  connect(): Promise<void> {
    const { logger, wsUrl = "wss://ws.okx.com:8443/ws/v5/public" } =
      this.options;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          logger.info("Connected to OKX WebSocket");
          this.reconnectAttempts = 0;

          // Subscribe to all symbols
          for (const symbol of this.subscriptions) {
            this.subscribeToSymbol(symbol);
          }

          // Start ping interval
          this.startPingInterval();

          this.emit("connected");
          resolve();
        });

        this.ws.on("message", (data: WebSocket.RawData) => {
          try {
            const messageStr = data.toString();

            // OKX отправляет простой текст "pong" в ответ на ping
            if (messageStr === "pong") {
              return;
            }

            const message = JSON.parse(messageStr) as
              | OKXTickerData
              | { event: string; code?: string; msg?: string };

            if ("event" in message) {
              // Response or ping/pong
              if (message.event === "error") {
                logger.error("OKX WebSocket error", {
                  code: message.code,
                  msg: message.msg,
                });
              }
            } else if ("arg" in message && message.arg.channel === "tickers") {
              this.handleTickerUpdate(message);
            }
          } catch (error) {
            logger.error("Failed to parse WebSocket message", error);
          }
        });

        this.ws.on("error", (error: Error) => {
          logger.error("OKX WebSocket error", error);
          this.emit("error", error);
          reject(error);
        });

        this.ws.on("close", () => {
          logger.warn("OKX WebSocket connection closed");
          this.stopPingInterval();
          this.emit("disconnected");
          this.attemptReconnect().catch((err) => {
            logger.error("Reconnect failed", err);
          });
        });
      } catch (error) {
        logger.error("Failed to connect to OKX WebSocket", error);
        reject(error);
      }
    });
  }

  /**
   * Отключение от OKX WebSocket
   */
  disconnect(): Promise<void> {
    const { logger } = this.options;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      logger.info("Disconnected from OKX WebSocket");
    }

    return Promise.resolve();
  }

  /**
   * Подписка на символ
   */
  subscribe(symbol: string): Promise<void> {
    this.subscriptions.add(symbol);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.subscribeToSymbol(symbol);
      return Promise.resolve();
    }
    if (!this.ws) {
      return this.connect();
    }
    return Promise.resolve();
  }

  /**
   * Отписка от символа
   */
  unsubscribe(symbol: string): Promise<void> {
    this.subscriptions.delete(symbol);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.unsubscribeFromSymbol(symbol);
    }

    return Promise.resolve();
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
   * Получить стакан ордеров (order book)
   */
  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const { logger, apiUrl = "https://www.okx.com" } = this.options;

    try {
      // OKX uses instId format like BTC-USDT
      const instId = symbol.replace("USDT", "-USDT");
      const sz = Math.min(limit, MAX_ORDER_BOOK_LIMIT).toString();

      const response = await fetch(
        `${apiUrl}/api/v5/market/books?instId=${instId}&sz=${sz}`
      );

      if (!response.ok) {
        throw new Error(`OKX API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        code: string;
        msg: string;
        data: Array<{
          asks: [string, string, string, string][]; // [price, size, deprecated, numOrders]
          bids: [string, string, string, string][];
          ts: string;
        }>;
      };

      if (data.code !== "0") {
        throw new Error(`OKX API error: ${data.msg}`);
      }

      if (!data.data || data.data.length === 0) {
        throw new Error("No order book data returned from OKX");
      }

      const orderBookData = data.data[0];

      return {
        symbol,
        timestamp: Number.parseInt(orderBookData.ts, 10),
        lastUpdateId: Number.parseInt(orderBookData.ts, 10), // OKX uses timestamp as ID
        bids: orderBookData.bids.map(
          ([price, size]) =>
            [Number.parseFloat(price), Number.parseFloat(size)] as [
              number,
              number,
            ]
        ),
        asks: orderBookData.asks.map(
          ([price, size]) =>
            [Number.parseFloat(price), Number.parseFloat(size)] as [
              number,
              number,
            ]
        ),
      };
    } catch (error) {
      logger.error("Failed to fetch OKX order book", { symbol, error });
      throw error;
    }
  }

  /**
   * Получить последние сделки
   */
  async getRecentTrades(symbol: string, limit = 100): Promise<RecentTrade[]> {
    const { logger, apiUrl = "https://www.okx.com" } = this.options;

    try {
      // OKX uses instId format like BTC-USDT
      const instId = symbol.replace("USDT", "-USDT");
      const limitParam = Math.min(limit, MAX_TRADES_LIMIT).toString();

      const response = await fetch(
        `${apiUrl}/api/v5/market/trades?instId=${instId}&limit=${limitParam}`
      );

      if (!response.ok) {
        throw new Error(`OKX API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        code: string;
        msg: string;
        data: Array<{
          instId: string;
          tradeId: string;
          px: string; // price
          sz: string; // size
          side: "buy" | "sell";
          ts: string; // timestamp
        }>;
      };

      if (data.code !== "0") {
        throw new Error(`OKX API error: ${data.msg}`);
      }

      return data.data.map((trade) => {
        const price = Number.parseFloat(trade.px);
        const qty = Number.parseFloat(trade.sz);
        return {
          id: trade.tradeId,
          price,
          qty,
          quoteQty: price * qty,
          time: Number.parseInt(trade.ts, 10),
          isBuyerMaker: trade.side === "sell", // If side is sell, buyer is maker
        };
      });
    } catch (error) {
      logger.error("Failed to fetch OKX recent trades", { symbol, error });
      throw error;
    }
  }

  /**
   * Подписка на символ через WebSocket
   */
  private subscribeToSymbol(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // OKX uses instId format like BTC-USDT
      const instId = symbol.replace("USDT", "-USDT");
      const message = {
        op: "subscribe",
        args: [
          {
            channel: "tickers",
            instId,
          },
        ],
      };
      this.ws.send(JSON.stringify(message));
      this.options.logger.info("Subscribed to OKX symbol", { symbol, instId });
    }
  }

  /**
   * Отписка от символа через WebSocket
   */
  private unsubscribeFromSymbol(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const instId = symbol.replace("USDT", "-USDT");
      const message = {
        op: "unsubscribe",
        args: [
          {
            channel: "tickers",
            instId,
          },
        ],
      };
      this.ws.send(JSON.stringify(message));
      this.options.logger.info("Unsubscribed from OKX symbol", {
        symbol,
        instId,
      });
    }
  }

  /**
   * Обработка обновления тикера
   */
  private handleTickerUpdate(data: OKXTickerData): void {
    if (!data.data || data.data.length === 0) {
      return;
    }

    const tickerData = data.data[0];
    // Convert OKX instId format (BTC-USDT) back to standard (BTCUSDT)
    const symbol = tickerData.instId.replace("-", "");

    const tick: Tick = {
      timestamp: Number.parseInt(tickerData.ts, 10),
      symbol,
      price: Number.parseFloat(tickerData.last),
      volume: Number.parseFloat(tickerData.vol24h),
      exchange: "okx",
      bid: Number.parseFloat(tickerData.bidPx),
      ask: Number.parseFloat(tickerData.askPx),
      bidVolume: Number.parseFloat(tickerData.bidSz),
      askVolume: Number.parseFloat(tickerData.askSz),
    };

    this.emit("tick", tick);
  }

  /**
   * Запуск ping интервала
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Остановка ping интервала
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Попытка переподключения
   */
  private attemptReconnect(): Promise<void> {
    const { logger } = this.options;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached");
      return Promise.resolve();
    }

    this.reconnectAttempts++;
    logger.info("Attempting to reconnect to OKX WebSocket", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    });

    return new Promise((resolve) => {
      this.reconnectTimer = setTimeout(() => {
        this.connect()
          .then(resolve)
          .catch((error) => {
            logger.error("Reconnection failed", error);
            resolve();
          });
      }, this.reconnectDelay * this.reconnectAttempts);
    });
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
