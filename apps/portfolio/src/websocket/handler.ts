import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import type { Position } from "@aladdin/core";
import type { ServerWebSocket } from "bun";

type WebSocketData = {
  clientId: string;
  userId?: string;
  subscribedPortfolios: Set<string>;
};

type ClientMessage =
  | {
      type: "subscribe";
      channels: string[];
      userId: string;
      portfolioId?: string;
    }
  | {
      type: "unsubscribe";
      channels: string[];
      portfolioId?: string;
    }
  | {
      type: "ping";
    };

type PositionEvent = {
  type:
    | "portfolio.position.updated"
    | "portfolio.position.created"
    | "portfolio.position.deleted";
  data: {
    portfolioId: string;
    position: Position;
  };
};

type PortfolioEvent = {
  type: "portfolio.updated";
  data: {
    portfolioId: string;
    totalValue: number;
    pnl: number;
  };
};

/**
 * WebSocket Handler для Portfolio Service
 * Транслирует обновления позиций и портфелей в реальном времени через NATS
 */
export class PortfolioWebSocketHandler {
  private clients = new Map<string, ServerWebSocket<WebSocketData>>();
  private natsInitialized = false;

  constructor(
    private natsClient: NatsClient,
    private logger: Logger
  ) {}

  /**
   * Инициализация подписок NATS
   */
  async initialize(): Promise<void> {
    if (this.natsInitialized) {
      return;
    }

    try {
      // Подписываемся на события позиций
      await this.natsClient.subscribe<string>("portfolio.position.*", (msg) => {
        this.handlePositionEvent(msg);
      });

      // Подписываемся на события портфелей
      await this.natsClient.subscribe<string>("portfolio.updated", (msg) => {
        this.handlePortfolioEvent(msg);
      });

      this.logger.info("Portfolio WebSocket handler initialized");
      this.natsInitialized = true;
    } catch (error) {
      this.logger.error(
        "Failed to initialize Portfolio WebSocket handler",
        error
      );
      throw error;
    }
  }

  /**
   * Обработчик открытия WebSocket соединения
   */
  onOpen(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;

    // Initialize subscribedPortfolios Set
    ws.data.subscribedPortfolios = new Set();

    this.clients.set(clientId, ws);

    this.logger.info("Portfolio WebSocket client connected", { clientId });

    ws.send(
      JSON.stringify({
        type: "connected",
        channel: "portfolio",
        clientId,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Обработчик входящих сообщений
   */
  onMessage(ws: ServerWebSocket<WebSocketData>, message: string): void {
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
        default:
          this.logger.warn("Unknown message type", { type: data.type });
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Unknown message type",
            })
          );
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
  onClose(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;
    this.clients.delete(clientId);

    this.logger.info("Portfolio WebSocket client disconnected", { clientId });
  }

  /**
   * Обработка подписки
   */
  private handleSubscribe(
    ws: ServerWebSocket<WebSocketData>,
    data: ClientMessage & { type: "subscribe" }
  ): void {
    const { channels, userId, portfolioId } = data;

    this.logger.info("Processing subscribe request", {
      clientId: ws.data.clientId,
      channels,
      userId,
      portfolioId,
    });

    if (channels.includes("positions")) {
      // Сохраняем userId для фильтрации событий
      ws.data.userId = userId;

      if (portfolioId) {
        ws.data.subscribedPortfolios.add(portfolioId);
      }

      ws.send(
        JSON.stringify({
          type: "subscribed",
          channel: "positions",
          portfolioId,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client subscribed to positions", {
        clientId: ws.data.clientId,
        userId,
        portfolioId,
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
    const { channels, portfolioId } = data;

    if (channels.includes("positions")) {
      if (portfolioId) {
        ws.data.subscribedPortfolios.delete(portfolioId);
      } else {
        ws.data.subscribedPortfolios.clear();
        ws.data.userId = undefined;
      }

      ws.send(
        JSON.stringify({
          type: "unsubscribed",
          channel: "positions",
          portfolioId,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client unsubscribed from positions", {
        clientId: ws.data.clientId,
        portfolioId,
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
   * Обработка события позиции из NATS
   */
  private handlePositionEvent(rawMsg: string): void {
    try {
      const event: PositionEvent = JSON.parse(rawMsg);

      this.logger.debug("Received position event from NATS", {
        type: event.type,
        portfolioId: event.data.portfolioId,
      });

      // Транслируем событие всем подписанным клиентам
      for (const ws of this.clients.values()) {
        // Проверяем, что клиент подписан на этот портфель
        const isSubscribed =
          ws.data.subscribedPortfolios.size === 0 || // Подписан на все портфели
          ws.data.subscribedPortfolios.has(event.data.portfolioId);

        if (
          ws.data.userId &&
          isSubscribed &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(
            JSON.stringify({
              type: "position",
              event: event.type,
              data: event.data,
              timestamp: Date.now(),
            })
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to handle position event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработка события портфеля из NATS
   */
  private handlePortfolioEvent(rawMsg: string): void {
    try {
      const event: PortfolioEvent = JSON.parse(rawMsg);

      this.logger.debug("Received portfolio event from NATS", {
        type: event.type,
        portfolioId: event.data.portfolioId,
      });

      // Транслируем событие всем подписанным клиентам
      for (const ws of this.clients.values()) {
        // Проверяем, что клиент подписан на этот портфель
        const isSubscribed =
          ws.data.subscribedPortfolios.size === 0 ||
          ws.data.subscribedPortfolios.has(event.data.portfolioId);

        if (
          ws.data.userId &&
          isSubscribed &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(
            JSON.stringify({
              type: "portfolio",
              event: event.type,
              data: event.data,
              timestamp: Date.now(),
            })
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to handle portfolio event", {
        error: error instanceof Error ? error.message : String(error),
      });
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
