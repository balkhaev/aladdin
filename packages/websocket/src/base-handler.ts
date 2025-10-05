/**
 * Base WebSocket Handler
 * Provides common WebSocket functionality for all services
 */

import type { Logger } from "@aladdin/logger";
import type { ServerWebSocket } from "bun";

/**
 * Base WebSocket data type
 */
export type BaseWebSocketData = {
  clientId: string;
  messageCount: number;
  lastMessageTime: number;
  lastPingTime: number;
};

/**
 * Client message types
 */
export type ClientMessageType =
  | "subscribe"
  | "unsubscribe"
  | "ping"
  | "pong"
  | "auth";

/**
 * Base client message type
 */
export type BaseClientMessage = {
  type: ClientMessageType;
  [key: string]: unknown;
};

/**
 * Rate limiting configuration
 */
export type RateLimitConfig = {
  windowMs: number;
  maxMessages: number;
};

/**
 * WebSocket handler configuration
 */
export type WebSocketHandlerConfig<TData extends BaseWebSocketData> = {
  logger: Logger;
  rateLimit?: RateLimitConfig;
  requireAuth?: boolean;
  pingInterval?: number;
  pongTimeout?: number;
  createWebSocketData?: () => Partial<TData>;
};

/**
 * Default rate limiting configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 1000, // 1 second
  maxMessages: 10, // 10 messages per second
};

/**
 * Base WebSocket Handler
 * Handles common WebSocket operations: connection, messages, rate limiting, ping/pong
 */
export abstract class BaseWebSocketHandler<
  TData extends BaseWebSocketData = BaseWebSocketData,
  TMessage extends BaseClientMessage = BaseClientMessage,
> {
  protected clients = new Map<string, ServerWebSocket<TData>>();
  protected readonly logger: Logger;
  protected readonly rateLimit: RateLimitConfig;
  protected readonly requireAuth: boolean;
  protected readonly pingInterval: number;
  protected readonly pongTimeout: number;
  protected pingIntervals = new Map<string, Timer>();

  constructor(config: WebSocketHandlerConfig<TData>) {
    this.logger = config.logger;
    this.rateLimit = config.rateLimit ?? DEFAULT_RATE_LIMIT;
    this.requireAuth = config.requireAuth ?? false;
    this.pingInterval = config.pingInterval ?? 30_000; // 30 seconds
    this.pongTimeout = config.pongTimeout ?? 5000; // 5 seconds
  }

  /**
   * Handle new WebSocket connection
   */
  onOpen(ws: ServerWebSocket<TData>): void {
    const { clientId } = ws.data;

    this.clients.set(clientId, ws);
    this.logger.info("WebSocket client connected", { clientId });

    // Start ping interval
    if (this.pingInterval > 0) {
      this.startPingInterval(ws);
    }

    // Send welcome message
    this.sendMessage(ws, {
      type: "connected",
      clientId,
      timestamp: Date.now(),
    });

    // Call custom initialization
    this.onClientConnected(ws);
  }

  /**
   * Handle incoming message
   */
  onMessage(ws: ServerWebSocket<TData>, message: string): void {
    const { clientId } = ws.data;

    // Rate limiting check
    if (!this.checkRateLimit(ws)) {
      this.logger.warn("Rate limit exceeded", { clientId });
      this.sendError(ws, "Rate limit exceeded");
      return;
    }

    try {
      const data = JSON.parse(message) as TMessage;

      // Check authentication if required
      if (
        this.requireAuth &&
        !this.isAuthenticated(ws) &&
        data.type !== "auth"
      ) {
        this.sendError(ws, "Authentication required");
        return;
      }

      // Handle standard message types
      switch (data.type) {
        case "ping":
          this.handlePing(ws);
          break;
        case "pong":
          this.handlePong(ws);
          break;
        case "auth":
          this.handleAuth(ws, data);
          break;
        case "subscribe":
          this.handleSubscribe(ws, data);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(ws, data);
          break;
        default:
          // Let subclass handle custom message types
          this.handleCustomMessage(ws, data);
      }
    } catch (error) {
      this.logger.error("Failed to parse WebSocket message", {
        clientId,
        error: error instanceof Error ? error.message : String(error),
        message: message.substring(0, 100), // Log first 100 chars
      });

      this.sendError(ws, "Invalid message format");
    }
  }

  /**
   * Handle connection close
   */
  onClose(ws: ServerWebSocket<TData>, code: number, reason: string): void {
    const { clientId } = ws.data;

    this.clients.delete(clientId);

    // Clear ping interval
    const interval = this.pingIntervals.get(clientId);
    if (interval) {
      clearInterval(interval);
      this.pingIntervals.delete(clientId);
    }

    this.logger.info("WebSocket client disconnected", {
      clientId,
      code,
      reason: reason || "No reason provided",
    });

    // Call custom cleanup
    this.onClientDisconnected(ws, code, reason);
  }

  /**
   * Send message to client
   */
  protected sendMessage(
    ws: ServerWebSocket<TData>,
    data: Record<string, unknown>
  ): void {
    try {
      ws.send(JSON.stringify(data));
    } catch (error) {
      this.logger.error("Failed to send message", {
        clientId: ws.data.clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send error message to client
   */
  protected sendError(ws: ServerWebSocket<TData>, message: string): void {
    this.sendMessage(ws, {
      type: "error",
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all clients
   */
  protected broadcast(data: Record<string, unknown>): void {
    const message = JSON.stringify(data);
    for (const client of this.clients.values()) {
      try {
        client.send(message);
      } catch (error) {
        this.logger.error("Failed to broadcast message", {
          clientId: client.data.clientId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Check rate limit for client
   */
  protected checkRateLimit(ws: ServerWebSocket<TData>): boolean {
    const now = Date.now();
    const timeSinceLastMessage = now - ws.data.lastMessageTime;

    if (timeSinceLastMessage < this.rateLimit.windowMs) {
      ws.data.messageCount += 1;
      if (ws.data.messageCount > this.rateLimit.maxMessages) {
        return false;
      }
    } else {
      ws.data.messageCount = 1;
      ws.data.lastMessageTime = now;
    }

    return true;
  }

  /**
   * Handle ping message
   */
  protected handlePing(ws: ServerWebSocket<TData>): void {
    ws.data.lastPingTime = Date.now();
    this.sendMessage(ws, {
      type: "pong",
      timestamp: Date.now(),
    });
  }

  /**
   * Handle pong message
   */
  protected handlePong(ws: ServerWebSocket<TData>): void {
    ws.data.lastPingTime = Date.now();
  }

  /**
   * Start ping interval for client
   */
  protected startPingInterval(ws: ServerWebSocket<TData>): void {
    const interval = setInterval(() => {
      const timeSinceLastPing = Date.now() - ws.data.lastPingTime;

      if (timeSinceLastPing > this.pongTimeout + this.pingInterval) {
        this.logger.warn("Client ping timeout", {
          clientId: ws.data.clientId,
        });
        ws.close(1001, "Ping timeout");
        return;
      }

      this.sendMessage(ws, {
        type: "ping",
        timestamp: Date.now(),
      });
    }, this.pingInterval);

    this.pingIntervals.set(ws.data.clientId, interval);
  }

  // ===== Abstract methods for subclasses to implement =====

  /**
   * Check if client is authenticated
   * Override in subclass if authentication is required
   */
  protected isAuthenticated(_ws: ServerWebSocket<TData>): boolean {
    return !this.requireAuth; // No auth required by default
  }

  /**
   * Handle authentication message
   * Override in subclass if authentication is required
   */
  protected handleAuth(_ws: ServerWebSocket<TData>, _data: TMessage): void {
    // Override in subclass
  }

  /**
   * Handle subscribe message
   * Must be implemented by subclass
   */
  protected abstract handleSubscribe(
    ws: ServerWebSocket<TData>,
    data: TMessage
  ): void;

  /**
   * Handle unsubscribe message
   * Must be implemented by subclass
   */
  protected abstract handleUnsubscribe(
    ws: ServerWebSocket<TData>,
    data: TMessage
  ): void;

  /**
   * Handle custom message types
   * Override in subclass for service-specific messages
   */
  protected handleCustomMessage(
    _ws: ServerWebSocket<TData>,
    data: TMessage
  ): void {
    this.logger.warn("Unknown message type", {
      type: data.type,
    });
  }

  /**
   * Called when a client connects
   * Override in subclass for custom initialization
   */
  protected onClientConnected(_ws: ServerWebSocket<TData>): void {
    // Override in subclass
  }

  /**
   * Called when a client disconnects
   * Override in subclass for custom cleanup
   */
  protected onClientDisconnected(
    _ws: ServerWebSocket<TData>,
    _code: number,
    _reason: string
  ): void {
    // Override in subclass
  }
}
