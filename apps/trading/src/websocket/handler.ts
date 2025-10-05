import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import type { Order } from "@aladdin/core";
import type { ServerWebSocket } from "bun";

type WebSocketData = {
  clientId: string;
  userId?: string;
  authenticated: boolean;
  subscriptions: Set<string>;
  messageCount: number;
  lastMessageTime: number;
  lastPingTime: number;
};

type ClientMessage =
  | {
      type: "auth";
      token: string;
    }
  | {
      type: "subscribe";
      channels: string[];
    }
  | {
      type: "unsubscribe";
      channels: string[];
    }
  | {
      type: "ping";
    }
  | {
      type: "pong";
    };

type OrderEvent = {
  type:
    | "trading.order.created"
    | "trading.order.updated"
    | "trading.order.cancelled"
    | "trading.order.filled";
  data: Order;
};

type ExecutionEvent = {
  type:
    | "trading.execution.created"
    | "trading.execution.progress"
    | "trading.execution.completed"
    | "trading.execution.cancelled";
  data: {
    executionId: string;
    symbol?: string;
    strategy?: string;
    totalQuantity?: number;
    slices?: number;
    startTime?: number;
    endTime?: number;
    status?: string;
    filled?: number;
    remaining?: number;
    completion?: number;
    failedSlices?: number;
  };
  timestamp: string;
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const MAX_MESSAGES_PER_WINDOW = 10; // 10 messages per second
const AUTH_TIMEOUT_MS = 5000; // 5 seconds to authenticate
const PING_INTERVAL_MS = 30_000; // 30 seconds
const PONG_TIMEOUT_MS = 5000; // 5 seconds to respond to ping

// WebSocket close codes
const WS_CLOSE_AUTH_TIMEOUT = 1008; // Policy violation
const WS_CLOSE_PING_TIMEOUT = 1001; // Going away
const WS_CLOSE_AUTH_FAILED = 1008; // Policy violation

// Event cache limits
const EVENT_CACHE_MAX_SIZE = 1000;
const EVENT_CACHE_CLEANUP_SIZE = 100;

/**
 * WebSocket Handler для Trading Service
 * Транслирует обновления ордеров в реальном времени через NATS
 */
export class TradingWebSocketHandler {
  private clients = new Map<string, ServerWebSocket<WebSocketData>>();
  private natsInitialized = false;
  private pingIntervals = new Map<string, Timer>();
  private authTimeouts = new Map<string, Timer>();
  private eventCache = new Map<string, Set<string>>(); // userId -> Set<eventId>

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
      // Подписываемся на все события ордеров
      await this.natsClient.subscribe<string>("trading.order.*", (msg) => {
        this.handleOrderEvent(msg);
      });

      // Подписываемся на события алгоритмического исполнения
      await this.natsClient.subscribe<string>("trading.execution.*", (msg) => {
        this.handleExecutionEvent(msg);
      });

      this.logger.info("Trading WebSocket handler initialized");
      this.natsInitialized = true;
    } catch (error) {
      this.logger.error(
        "Failed to initialize Trading WebSocket handler",
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

    // Initialize client data
    ws.data.authenticated = false;
    ws.data.subscriptions = new Set();
    ws.data.messageCount = 0;
    ws.data.lastMessageTime = Date.now();
    ws.data.lastPingTime = Date.now();

    this.clients.set(clientId, ws);

    this.logger.info("Trading WebSocket client connected", { clientId });

    // Set authentication timeout
    const authTimeout = setTimeout(() => {
      if (!ws.data.authenticated) {
        this.logger.warn("Client authentication timeout", { clientId });
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Authentication timeout",
            timestamp: Date.now(),
          })
        );
        ws.close(WS_CLOSE_AUTH_TIMEOUT, "Authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);

    this.authTimeouts.set(clientId, authTimeout);

    // Start ping interval for keepalive
    const pingInterval = setInterval(() => {
      this.sendPing(ws);
    }, PING_INTERVAL_MS);

    this.pingIntervals.set(clientId, pingInterval);

    ws.send(
      JSON.stringify({
        type: "connected",
        channel: "trading",
        clientId,
        message: "Please authenticate within 5 seconds",
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Обработчик входящих сообщений
   */
  onMessage(ws: ServerWebSocket<WebSocketData>, message: string): void {
    const clientId = ws.data.clientId;

    // Rate limiting check
    if (!this.checkRateLimit(ws)) {
      this.logger.warn("Rate limit exceeded", { clientId });
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Rate limit exceeded. Maximum 10 messages per second.",
          timestamp: Date.now(),
        })
      );
      return;
    }

    try {
      const data = JSON.parse(message) as ClientMessage;

      switch (data.type) {
        case "auth":
          this.handleAuth(ws, data);
          break;
        case "subscribe":
          if (!ws.data.authenticated) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Authentication required",
                timestamp: Date.now(),
              })
            );
            return;
          }
          this.handleSubscribe(ws, data);
          break;
        case "unsubscribe":
          if (!ws.data.authenticated) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Authentication required",
                timestamp: Date.now(),
              })
            );
            return;
          }
          this.handleUnsubscribe(ws, data);
          break;
        case "ping":
          this.handlePing(ws);
          break;
        case "pong":
          this.handlePong(ws);
          break;
        default:
          this.logger.warn("Unknown message type", {
            type: (data as { type?: string }).type,
            clientId,
          });
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Unknown message type",
              timestamp: Date.now(),
            })
          );
      }
    } catch (error) {
      this.logger.error("Failed to parse WebSocket message", {
        error: error instanceof Error ? error.message : String(error),
        message,
        clientId,
      });

      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
          timestamp: Date.now(),
        })
      );
    }
  }

  /**
   * Обработчик закрытия соединения
   */
  onClose(ws: ServerWebSocket<WebSocketData>): void {
    const clientId = ws.data.clientId;
    const userId = ws.data.userId;

    // Cleanup
    this.clients.delete(clientId);

    // Clear timers
    const pingInterval = this.pingIntervals.get(clientId);
    if (pingInterval) {
      clearInterval(pingInterval);
      this.pingIntervals.delete(clientId);
    }

    const authTimeout = this.authTimeouts.get(clientId);
    if (authTimeout) {
      clearTimeout(authTimeout);
      this.authTimeouts.delete(clientId);
    }

    // Clear event cache for this user if no more connections
    if (userId) {
      const hasOtherConnections = Array.from(this.clients.values()).some(
        (client) => client.data.userId === userId
      );
      if (!hasOtherConnections) {
        this.eventCache.delete(userId);
      }
    }

    this.logger.info("Trading WebSocket client disconnected", {
      clientId,
      userId,
      authenticated: ws.data.authenticated,
    });
  }

  /**
   * Обработчик аутентификации
   */
  private handleAuth(
    ws: ServerWebSocket<WebSocketData>,
    data: ClientMessage & { type: "auth" }
  ): void {
    const clientId = ws.data.clientId;

    // TODO: Implement proper JWT token validation
    // For now, accept x-user-id from token or use development mode
    try {
      // Simple validation - in production, validate JWT token
      const { token } = data;

      if (!token) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Token is required",
            timestamp: Date.now(),
          })
        );
        return;
      }

      // Extract userId from token (placeholder - in production use JWT)
      // For development, token format: "user:{userId}"
      let userId = "test-user";
      if (token.startsWith("user:")) {
        userId = token.split(":")[1];
      }

      ws.data.authenticated = true;
      ws.data.userId = userId;

      // Clear auth timeout
      const authTimeout = this.authTimeouts.get(clientId);
      if (authTimeout) {
        clearTimeout(authTimeout);
        this.authTimeouts.delete(clientId);
      }

      // Initialize event cache for this user
      if (!this.eventCache.has(userId)) {
        this.eventCache.set(userId, new Set());
      }

      this.logger.info("Client authenticated", { clientId, userId });

      ws.send(
        JSON.stringify({
          type: "authenticated",
          userId,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      this.logger.error("Authentication failed", {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });

      ws.send(
        JSON.stringify({
          type: "error",
          message: "Authentication failed",
          timestamp: Date.now(),
        })
      );
      ws.close(WS_CLOSE_AUTH_FAILED, "Authentication failed");
    }
  }

  /**
   * Rate limiting check
   */
  private checkRateLimit(ws: ServerWebSocket<WebSocketData>): boolean {
    const now = Date.now();
    const timeSinceLastMessage = now - ws.data.lastMessageTime;

    if (timeSinceLastMessage >= RATE_LIMIT_WINDOW_MS) {
      // Reset counter for new window
      ws.data.messageCount = 1;
      ws.data.lastMessageTime = now;
      return true;
    }

    ws.data.messageCount++;

    if (ws.data.messageCount > MAX_MESSAGES_PER_WINDOW) {
      return false;
    }

    return true;
  }

  /**
   * Send ping to client
   */
  private sendPing(ws: ServerWebSocket<WebSocketData>): void {
    if (ws.readyState === WebSocket.OPEN) {
      const now = Date.now();
      const timeSinceLastPing = now - ws.data.lastPingTime;

      // Check if client responded to previous ping
      if (timeSinceLastPing > PING_INTERVAL_MS + PONG_TIMEOUT_MS) {
        this.logger.warn("Client not responding to ping", {
          clientId: ws.data.clientId,
        });
        ws.close(WS_CLOSE_PING_TIMEOUT, "Ping timeout");
        return;
      }

      ws.data.lastPingTime = now;
      ws.send(
        JSON.stringify({
          type: "ping",
          timestamp: now,
        })
      );
    }
  }

  /**
   * Handle pong from client
   */
  private handlePong(ws: ServerWebSocket<WebSocketData>): void {
    ws.data.lastPingTime = Date.now();

    this.logger.debug("Received pong from client", {
      clientId: ws.data.clientId,
    });
  }

  /**
   * Обработка подписки
   */
  private handleSubscribe(
    ws: ServerWebSocket<WebSocketData>,
    data: ClientMessage & { type: "subscribe" }
  ): void {
    const { channels } = data;
    const clientId = ws.data.clientId;
    const userId = ws.data.userId;

    this.logger.info("Processing subscribe request", {
      clientId,
      channels,
      userId,
    });

    for (const channel of channels) {
      if (channel === "orders") {
        ws.data.subscriptions.add("orders");

        ws.send(
          JSON.stringify({
            type: "subscribed",
            channel: "orders",
            timestamp: Date.now(),
          })
        );

        this.logger.info("Client subscribed to orders", {
          clientId,
          userId,
        });
      } else if (channel === "executions") {
        ws.data.subscriptions.add("executions");

        ws.send(
          JSON.stringify({
            type: "subscribed",
            channel: "executions",
            timestamp: Date.now(),
          })
        );

        this.logger.info("Client subscribed to executions", {
          clientId,
          userId,
        });
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: `Unknown channel: ${channel}`,
            timestamp: Date.now(),
          })
        );
      }
    }
  }

  /**
   * Обработка отписки
   */
  private handleUnsubscribe(
    ws: ServerWebSocket<WebSocketData>,
    data: ClientMessage & { type: "unsubscribe" }
  ): void {
    const { channels } = data;
    const clientId = ws.data.clientId;

    for (const channel of channels) {
      if (channel === "orders") {
        ws.data.subscriptions.delete("orders");

        ws.send(
          JSON.stringify({
            type: "unsubscribed",
            channel: "orders",
            timestamp: Date.now(),
          })
        );

        this.logger.info("Client unsubscribed from orders", {
          clientId,
        });
      } else if (channel === "executions") {
        ws.data.subscriptions.delete("executions");

        ws.send(
          JSON.stringify({
            type: "unsubscribed",
            channel: "executions",
            timestamp: Date.now(),
          })
        );

        this.logger.info("Client unsubscribed from executions", {
          clientId,
        });
      }
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
   * Обработка события ордера из NATS
   */
  private handleOrderEvent(rawMsg: string): void {
    try {
      const event: OrderEvent = JSON.parse(rawMsg);
      const userId = event.data.userId;
      const eventId = `${event.type}:${event.data.id}:${event.data.updatedAt}`;

      this.logger.debug("Received order event from NATS", {
        type: event.type,
        orderId: event.data.id,
        userId,
      });

      // Event deduplication check
      const userEventCache = this.eventCache.get(userId);
      if (userEventCache?.has(eventId)) {
        this.logger.debug("Duplicate event detected, skipping", {
          eventId,
          userId,
        });
        return;
      }

      // Add to cache
      if (userEventCache) {
        userEventCache.add(eventId);

        // Limit cache size to prevent memory leaks
        if (userEventCache.size > EVENT_CACHE_MAX_SIZE) {
          // Remove oldest entries (first 100)
          const toRemove = Array.from(userEventCache).slice(
            0,
            EVENT_CACHE_CLEANUP_SIZE
          );
          for (const id of toRemove) {
            userEventCache.delete(id);
          }
        }
      }

      // Транслируем событие всем подписанным клиентам
      let sentCount = 0;
      for (const ws of this.clients.values()) {
        // Проверяем, что клиент аутентифицирован, подписан на orders и userId совпадает
        if (
          ws.data.authenticated &&
          ws.data.userId === userId &&
          ws.data.subscriptions.has("orders") &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(
            JSON.stringify({
              type: "order",
              event: event.type,
              data: event.data,
              timestamp: Date.now(),
            })
          );
          sentCount++;
        }
      }

      if (sentCount > 0) {
        this.logger.debug("Order event sent to clients", {
          eventId,
          userId,
          clientCount: sentCount,
        });
      }
    } catch (error) {
      this.logger.error("Failed to handle order event", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Обработка события execution из NATS
   */
  private handleExecutionEvent(rawMsg: string): void {
    try {
      const event: ExecutionEvent = JSON.parse(rawMsg);
      const eventId = `${event.type}:${event.data.executionId}:${event.timestamp}`;

      this.logger.debug("Received execution event from NATS", {
        type: event.type,
        executionId: event.data.executionId,
        symbol: event.data.symbol,
      });

      // Транслируем событие всем подписанным клиентам
      // Execution events не привязаны к конкретному user, поэтому отправляем всем подписанным
      let sentCount = 0;
      for (const ws of this.clients.values()) {
        if (
          ws.data.authenticated &&
          ws.data.subscriptions.has("executions") &&
          ws.readyState === WebSocket.OPEN
        ) {
          ws.send(
            JSON.stringify({
              type: "execution",
              event: event.type,
              data: event.data,
              timestamp: event.timestamp,
            })
          );
          sentCount++;
        }
      }

      if (sentCount > 0) {
        this.logger.debug("Execution event sent to clients", {
          eventId,
          executionId: event.data.executionId,
          clientCount: sentCount,
        });
      }
    } catch (error) {
      this.logger.error("Failed to handle execution event", {
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
