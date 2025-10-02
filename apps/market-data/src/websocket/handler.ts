import type { Logger } from "@aladdin/shared/logger";
import type { AggTrade, Tick } from "@aladdin/shared/types";
import type { ServerWebSocket } from "bun";
import type { MarketDataService } from "../services/market-data";

type WebSocketData = {
  clientId: string;
  subscribedSymbols: Set<string>;
  subscribedOrderBooks: Map<string, number>; // symbol -> limit
  subscribedTrades: Set<string>;
  orderBookIntervals: Map<string, Timer>; // symbol -> interval timer
};

type ClientMessage =
  | {
      type: "subscribe";
      channels: string[];
      symbols?: string[];
      limit?: number; // для orderbook
    }
  | {
      type: "unsubscribe";
      channels: string[];
      symbols?: string[];
    }
  | {
      type: "ping";
    };

const DEFAULT_ORDERBOOK_LIMIT = 20;

export class WebSocketHandler {
  private clients = new Map<string, ServerWebSocket<WebSocketData>>();
  private tickCallbacks = new Map<string, (tick: Tick) => void>();
  private tradeCallbacks = new Map<string, (trade: AggTrade) => void>();

  constructor(
    private marketDataService: MarketDataService,
    private logger: Logger
  ) {}

  /**
   * Обработчик открытия WebSocket соединения
   */
  onOpen(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;
    this.clients.set(clientId, ws);

    this.logger.info("WebSocket client connected", { clientId });

    ws.send(
      JSON.stringify({
        type: "connected",
        clientId,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Обработчик входящих сообщений
   */
  onMessage(ws: ServerWebSocket<WebSocketData>, message: string): void {
    const MAX_LOG_LENGTH = 100;
    this.logger.info("WebSocket message received", {
      clientId: ws.data.clientId,
      message: message.substring(0, MAX_LOG_LENGTH), // First 100 chars
    });

    try {
      const data = JSON.parse(message) as ClientMessage;

      switch (data.type) {
        case "subscribe":
          this.handleSubscribe(ws, data);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(ws, data);
          break;
        case "ping":
          this.handlePing(ws);
          break;
      }
    } catch (error) {
      this.logger.error("Failed to parse WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        message,
      });

      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
        })
      );
    }
  }

  /**
   * Обработчик закрытия соединения
   */
  onClose(
    ws: ServerWebSocket<WebSocketData>,
    code: number,
    message: string
  ): void {
    const clientId = ws.data.clientId;

    // Отписываем от всех тиков
    const symbols = Array.from(ws.data.subscribedSymbols);
    for (const symbol of symbols) {
      this.unsubscribeFromSymbol(ws, symbol);
    }

    // Отписываем от всех orderbooks
    const orderbookSymbols = Array.from(ws.data.subscribedOrderBooks.keys());
    for (const symbol of orderbookSymbols) {
      this.unsubscribeFromOrderBook(ws, symbol);
    }

    // Отписываем от всех trades
    const tradeSymbols = Array.from(ws.data.subscribedTrades);
    for (const symbol of tradeSymbols) {
      this.unsubscribeFromTrades(ws, symbol);
    }

    this.clients.delete(clientId);

    this.logger.info("WebSocket client disconnected", {
      clientId,
      code,
      message,
    });
  }

  /**
   * Обработка подписки
   */
  private handleSubscribe(
    ws: ServerWebSocket<WebSocketData>,
    data: ClientMessage & { type: "subscribe" }
  ): void {
    const { channels, symbols, limit } = data;

    this.logger.info("Processing subscribe request", {
      clientId: ws.data.clientId,
      channels,
      symbols,
      limit,
    });

    if (channels.includes("tick") && symbols) {
      for (const symbol of symbols) {
        this.subscribeToSymbol(ws, symbol.toUpperCase());
      }

      ws.send(
        JSON.stringify({
          type: "subscribed",
          channel: "tick",
          symbols,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client subscribed to ticks", {
        clientId: ws.data.clientId,
        symbols,
      });
    }

    if (channels.includes("orderbook") && symbols) {
      const orderbookLimit = limit ?? DEFAULT_ORDERBOOK_LIMIT;
      for (const symbol of symbols) {
        this.subscribeToOrderBook(ws, symbol.toUpperCase(), orderbookLimit);
      }

      ws.send(
        JSON.stringify({
          type: "subscribed",
          channel: "orderbook",
          symbols,
          limit: orderbookLimit,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client subscribed to orderbook", {
        clientId: ws.data.clientId,
        symbols,
        limit: orderbookLimit,
      });
    }

    if (channels.includes("trade") && symbols) {
      for (const symbol of symbols) {
        this.subscribeToTrades(ws, symbol.toUpperCase());
      }

      ws.send(
        JSON.stringify({
          type: "subscribed",
          channel: "trade",
          symbols,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client subscribed to trades", {
        clientId: ws.data.clientId,
        symbols,
      });
    }
  }

  /**
   * Обработка отписки
   */
  private handleUnsubscribe(
    ws: ServerWebSocket<WebSocketData>,
    data: ClientMessage & { type: "unsubscribe" }
  ): void {
    const { channels, symbols } = data;

    if (channels.includes("tick") && symbols) {
      for (const symbol of symbols) {
        this.unsubscribeFromSymbol(ws, symbol.toUpperCase());
      }

      ws.send(
        JSON.stringify({
          type: "unsubscribed",
          channel: "tick",
          symbols,
          timestamp: Date.now(),
        })
      );

      this.logger.debug("Client unsubscribed from ticks", {
        clientId: ws.data.clientId,
        symbols,
      });
    }

    if (channels.includes("orderbook") && symbols) {
      for (const symbol of symbols) {
        this.unsubscribeFromOrderBook(ws, symbol.toUpperCase());
      }

      ws.send(
        JSON.stringify({
          type: "unsubscribed",
          channel: "orderbook",
          symbols,
          timestamp: Date.now(),
        })
      );

      this.logger.debug("Client unsubscribed from orderbook", {
        clientId: ws.data.clientId,
        symbols,
      });
    }

    if (channels.includes("trade") && symbols) {
      for (const symbol of symbols) {
        this.unsubscribeFromTrades(ws, symbol.toUpperCase());
      }

      ws.send(
        JSON.stringify({
          type: "unsubscribed",
          channel: "trade",
          symbols,
          timestamp: Date.now(),
        })
      );

      this.logger.debug("Client unsubscribed from trades", {
        clientId: ws.data.clientId,
        symbols,
      });
    }
  }

  /**
   * Обработка ping
   */
  private handlePing(ws: ServerWebSocket<WebSocketData>): void {
    ws.send(
      JSON.stringify({
        type: "pong",
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Подписка на символ
   */
  private subscribeToSymbol(
    ws: ServerWebSocket<WebSocketData>,
    symbol: string
  ): void {
    ws.data.subscribedSymbols.add(symbol);

    // Создаем callback для этого клиента и символа
    const callbackKey = `${ws.data.clientId}:${symbol}`;
    const callback = (tick: Tick) => {
      if (tick.symbol === symbol && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "tick",
            data: tick,
          })
        );
      }
    };

    this.tickCallbacks.set(callbackKey, callback);
    this.marketDataService.onTick(callback);
  }

  /**
   * Отписка от символа
   */
  private unsubscribeFromSymbol(
    ws: ServerWebSocket<WebSocketData>,
    symbol: string
  ): void {
    ws.data.subscribedSymbols.delete(symbol);

    const callbackKey = `${ws.data.clientId}:${symbol}`;
    const callback = this.tickCallbacks.get(callbackKey);

    if (callback) {
      this.marketDataService.offTick(callback);
      this.tickCallbacks.delete(callbackKey);
    }
  }

  /**
   * Подписка на трейды (aggTrade)
   */
  private subscribeToTrades(
    ws: ServerWebSocket<WebSocketData>,
    symbol: string
  ): void {
    ws.data.subscribedTrades.add(symbol);

    // Создаем callback для этого клиента и символа
    const callbackKey = `${ws.data.clientId}:${symbol}`;
    const callback = (aggTrade: AggTrade) => {
      if (aggTrade.symbol === symbol && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "trade",
            data: aggTrade,
          })
        );
      }
    };

    this.tradeCallbacks.set(callbackKey, callback);
    this.marketDataService.onAggTrade(callback);
  }

  /**
   * Отписка от трейдов
   */
  private unsubscribeFromTrades(
    ws: ServerWebSocket<WebSocketData>,
    symbol: string
  ): void {
    ws.data.subscribedTrades.delete(symbol);

    const callbackKey = `${ws.data.clientId}:${symbol}`;
    const callback = this.tradeCallbacks.get(callbackKey);

    if (callback) {
      this.marketDataService.offAggTrade(callback);
      this.tradeCallbacks.delete(callbackKey);
    }
  }

  /**
   * Подписка на orderbook
   */
  private subscribeToOrderBook(
    ws: ServerWebSocket<WebSocketData>,
    symbol: string,
    limit: number
  ): void {
    ws.data.subscribedOrderBooks.set(symbol, limit);

    // Получаем orderbook через REST API и отправляем периодически
    const updateOrderBook = async (): Promise<void> => {
      try {
        const connector = this.marketDataService.getConnector();
        const orderBook = await connector.getOrderBook(symbol, limit);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "orderbook",
              data: orderBook,
            })
          );
        }
      } catch (error) {
        this.logger.error(`Failed to fetch orderbook for ${symbol}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    // Отправляем сразу
    updateOrderBook().catch((error) => {
      this.logger.error("Failed to update orderbook", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Обновляем каждую секунду
    const UPDATE_INTERVAL_MS = 1000;
    const intervalId = setInterval(() => {
      updateOrderBook().catch((error) => {
        this.logger.error("Failed to update orderbook", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, UPDATE_INTERVAL_MS);

    ws.data.orderBookIntervals.set(symbol, intervalId);
  }

  /**
   * Отписка от orderbook
   */
  private unsubscribeFromOrderBook(
    ws: ServerWebSocket<WebSocketData>,
    symbol: string
  ): void {
    ws.data.subscribedOrderBooks.delete(symbol);

    const intervalId = ws.data.orderBookIntervals.get(symbol);
    if (intervalId) {
      clearInterval(intervalId);
      ws.data.orderBookIntervals.delete(symbol);
    }
  }

  /**
   * Broadcast сообщения всем подключенным клиентам
   */
  broadcast(message: unknown): void {
    const payload = JSON.stringify(message);

    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}
