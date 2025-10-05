import type { Candle, Tick } from "@aladdin/core";

export type ExchangeConnectorEvent =
  | "tick"
  | "candle"
  | "orderbook"
  | "trade"
  | "error"
  | "connected"
  | "disconnected";

export type OrderBookLevel = [number, number]; // [price, quantity]

export type OrderBook = {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  timestamp: number;
};

export type RecentTrade = {
  id: number;
  price: number;
  qty: number;
  quoteQty: number;
  time: number;
  isBuyerMaker: boolean;
};

export type ExchangeConnector = {
  /**
   * Подключение к бирже
   */
  connect(): Promise<void>;

  /**
   * Отключение от биржи
   */
  disconnect(): Promise<void>;

  /**
   * Подписка на символ
   */
  subscribe(symbol: string): Promise<void>;

  /**
   * Отписка от символа
   */
  unsubscribe(symbol: string): Promise<void>;

  /**
   * Получить стакан ордеров (order book)
   */
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;

  /**
   * Получить последние сделки
   */
  getRecentTrades(symbol: string, limit?: number): Promise<RecentTrade[]>;

  /**
   * Получить все доступные торговые пары (опционально)
   */
  getAllSymbols?(): Promise<string[]>;

  /**
   * Подписка на события
   */
  on(event: "tick", handler: (tick: Tick) => void): void;
  on(event: "candle", handler: (candle: Candle) => void): void;
  on(event: "error", handler: (error: Error) => void): void;
  on(event: "connected" | "disconnected", handler: () => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void;

  /**
   * Отписка от событий
   */
  off(event: string, handler: (...args: unknown[]) => void): void;
};
