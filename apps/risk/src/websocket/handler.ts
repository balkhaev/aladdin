import type { Logger } from "@aladdin/shared/logger";
import type { NatsClient } from "@aladdin/shared/nats";
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

type RiskMetricsEvent = {
  type: "risk.metrics.updated";
  data: {
    portfolioId: string;
    metrics: {
      var95: number;
      var99: number;
      exposure: {
        long: number;
        short: number;
        net: number;
        leverage: number;
      };
      limits: {
        maxLeverage?: number;
        maxPositionSize?: number;
        maxDailyLoss?: number;
        minMargin?: number;
      };
      breachedLimits: string[];
    };
  };
};

/**
 * WebSocket Handler для Risk Service
 * Транслирует обновления риск-метрик в реальном времени через NATS
 */
export class RiskWebSocketHandler {
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
      // Подписываемся на события риск-метрик
      await this.natsClient.subscribe<string>("risk.metrics.updated", (msg) => {
        this.handleRiskMetricsEvent(msg);
      });

      this.logger.info("Risk WebSocket handler initialized");
      this.natsInitialized = true;
    } catch (error) {
      this.logger.error("Failed to initialize Risk WebSocket handler", error);
      throw error;
    }
  }

  /**
   * Обработчик открытия WebSocket соединения
   */
  onOpen(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;
    this.clients.set(clientId, ws);

    this.logger.info("Risk WebSocket client connected", { clientId });

    ws.send(
      JSON.stringify({
        type: "connected",
        channel: "risk",
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

    this.logger.info("Risk WebSocket client disconnected", { clientId });
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

    if (channels.includes("risk-metrics")) {
      // Сохраняем userId для фильтрации событий
      ws.data.userId = userId;

      if (portfolioId) {
        ws.data.subscribedPortfolios.add(portfolioId);
      }

      ws.send(
        JSON.stringify({
          type: "subscribed",
          channel: "risk-metrics",
          portfolioId,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client subscribed to risk metrics", {
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

    if (channels.includes("risk-metrics")) {
      if (portfolioId) {
        ws.data.subscribedPortfolios.delete(portfolioId);
      } else {
        ws.data.subscribedPortfolios.clear();
        ws.data.userId = undefined;
      }

      ws.send(
        JSON.stringify({
          type: "unsubscribed",
          channel: "risk-metrics",
          portfolioId,
          timestamp: Date.now(),
        })
      );

      this.logger.info("Client unsubscribed from risk metrics", {
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
   * Обработка события риск-метрик из NATS
   */
  private handleRiskMetricsEvent(rawMsg: string): void {
    try {
      const event: RiskMetricsEvent = JSON.parse(rawMsg);

      this.logger.debug("Received risk metrics event from NATS", {
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
              type: "risk-metrics",
              event: event.type,
              data: event.data,
              timestamp: Date.now(),
            })
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to handle risk metrics event", {
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
