import type { Logger } from "@aladdin/shared/logger";
import type { Candle, Tick } from "@aladdin/shared/types";
import WebSocket from "ws";
import type { ExchangeConnector, OrderBook, RecentTrade } from "./types";

type BybitConnectorOptions = {
  logger: Logger;
  wsUrl?: string;
  apiUrl?: string;
  category?: "spot" | "linear" | "inverse"; // spot, linear (USDT futures), inverse
};

const MAX_ORDER_BOOK_LIMIT = 200;
const MAX_TRADES_LIMIT = 1000;

type BybitTickerData = {
  topic: string;
  type: string;
  data: {
    symbol: string;
    lastPrice: string;
    volume24h: string;
    bid1Price: string;
    bid1Size: string;
    ask1Price: string;
    ask1Size: string;
  };
  ts: number;
};

export class BybitConnector implements ExchangeConnector {
  private ws: WebSocket | null = null;
  private subscriptions: Set<string> = new Set();
  private eventHandlers: Map<string, Set<(...args: unknown[]) => void>> =
    new Map();
  private reconnectTimer: Timer | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private pingInterval: Timer | null = null;

  constructor(private options: BybitConnectorOptions) {}

  /**
   * Подключение к Bybit WebSocket
   */
  connect(): Promise<void> {
    const { logger, wsUrl = "wss://stream.bybit.com/v5/public/spot" } =
      this.options;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on("open", () => {
          logger.info("Connected to Bybit WebSocket");
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
            const message = JSON.parse(data.toString()) as
              | BybitTickerData
              | { op: string; success: boolean };

            if ("topic" in message && message.topic.includes("tickers")) {
              this.handleTickerUpdate(message);
            }
          } catch (error) {
            logger.error("Failed to parse WebSocket message", error);
          }
        });

        this.ws.on("error", (error: Error) => {
          logger.error("Bybit WebSocket error", error);
          this.emit("error", error);
          reject(error);
        });

        this.ws.on("close", () => {
          logger.warn("Bybit WebSocket connection closed");
          this.stopPingInterval();
          this.emit("disconnected");
          this.attemptReconnect().catch((err) => {
            logger.error("Reconnect failed", err);
          });
        });
      } catch (error) {
        logger.error("Failed to connect to Bybit WebSocket", error);
        reject(error);
      }
    });
  }

  /**
   * Отключение от Bybit WebSocket
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
      logger.info("Disconnected from Bybit WebSocket");
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
   * Подписка на символ через WebSocket
   */
  private subscribeToSymbol(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        op: "subscribe",
        args: [`tickers.${symbol}`],
      };
      this.ws.send(JSON.stringify(message));
      this.options.logger.info("Subscribed to symbol", { symbol });
    }
  }

  /**
   * Отписка от символа через WebSocket
   */
  private unsubscribeFromSymbol(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const message = {
        op: "unsubscribe",
        args: [`tickers.${symbol}`],
      };
      this.ws.send(JSON.stringify(message));
      this.options.logger.info("Unsubscribed from symbol", { symbol });
    }
  }

  /**
   * Обработка обновления тикера
   */
  private handleTickerUpdate(data: BybitTickerData): void {
    const tick: Tick = {
      timestamp: data.ts,
      symbol: data.data.symbol,
      price: Number.parseFloat(data.data.lastPrice),
      volume: Number.parseFloat(data.data.volume24h),
      exchange: "bybit",
      bid: Number.parseFloat(data.data.bid1Price),
      ask: Number.parseFloat(data.data.ask1Price),
      bidVolume: Number.parseFloat(data.data.bid1Size),
      askVolume: Number.parseFloat(data.data.ask1Size),
    };

    this.emit("tick", tick);
  }

  /**
   * Запуск ping интервала
   */
  private startPingInterval(): void {
    const pingIntervalMs = 20_000; // 20 seconds
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: "ping" }));
      }
    }, pingIntervalMs);
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
    logger.info("Attempting to reconnect to Bybit WebSocket", {
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

  /**
   * Получить стакан ордеров (order book)
   */
  async getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
    const { logger, apiUrl = "https://api.bybit.com" } = this.options;
    const category = this.options.category || "spot";

    try {
      const params = new URLSearchParams({
        category,
        symbol,
        limit: Math.min(limit, MAX_ORDER_BOOK_LIMIT).toString(),
      });

      const response = await fetch(
        `${apiUrl}/v5/market/orderbook?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Bybit API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        retCode: number;
        retMsg: string;
        result: {
          s: string; // symbol
          b: [string, string][]; // bids [price, size]
          a: [string, string][]; // asks [price, size]
          ts: number; // timestamp
          u: number; // update ID
        };
      };

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      return {
        symbol: data.result.s,
        timestamp: data.result.ts,
        lastUpdateId: data.result.u,
        bids: data.result.b.map(
          ([price, size]) =>
            [Number.parseFloat(price), Number.parseFloat(size)] as [
              number,
              number,
            ]
        ),
        asks: data.result.a.map(
          ([price, size]) =>
            [Number.parseFloat(price), Number.parseFloat(size)] as [
              number,
              number,
            ]
        ),
      };
    } catch (error) {
      logger.error("Failed to fetch Bybit order book", { symbol, error });
      throw error;
    }
  }

  /**
   * Получить последние сделки
   */
  async getRecentTrades(symbol: string, limit = 100): Promise<RecentTrade[]> {
    const { logger, apiUrl = "https://api.bybit.com" } = this.options;
    const category = this.options.category || "spot";

    try {
      const params = new URLSearchParams({
        category,
        symbol,
        limit: Math.min(limit, MAX_TRADES_LIMIT).toString(),
      });

      const response = await fetch(
        `${apiUrl}/v5/market/recent-trade?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Bybit API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        retCode: number;
        retMsg: string;
        result: {
          list: Array<{
            execId: string;
            symbol: string;
            price: string;
            size: string;
            side: "Buy" | "Sell";
            time: string;
            isBlockTrade: boolean;
          }>;
        };
      };

      if (data.retCode !== 0) {
        throw new Error(`Bybit API error: ${data.retMsg}`);
      }

      return data.result.list.map((trade) => ({
        id: trade.execId,
        price: Number.parseFloat(trade.price),
        qty: Number.parseFloat(trade.size),
        quoteQty:
          Number.parseFloat(trade.price) * Number.parseFloat(trade.size),
        time: Number.parseInt(trade.time, 10),
        isBuyerMaker: trade.side === "Sell", // If side is Sell, buyer is maker
      }));
    } catch (error) {
      logger.error("Failed to fetch Bybit recent trades", { symbol, error });
      throw error;
    }
  }
}
