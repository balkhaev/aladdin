/**
 * Base WebSocket Handler
 * Provides common WebSocket functionality for all services
 */

import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
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
  natsClient?: NatsClient;
  rateLimit?: RateLimitConfig;
  requireAuth?: boolean;
  pingInterval?: number;
  pongTimeout?: number;
  authTimeout?: number;
  enableEventCache?: boolean;
  eventCacheMaxSize?: number;
  createWebSocketData?: () => Partial<TData>;
};

/**
 * Subscription manager for handling channel subscriptions
 */
export type SubscriptionManager = {
  subscriptions: Map<string, Set<string>>; // clientId -> Set<channel>
  reverseIndex: Map<string, Set<string>>; // channel -> Set<clientId>
};

/**
 * Event cache for deduplication
 */
export type EventCache = {
  cache: Map<string, Set<string>>; // clientId -> Set<eventId>
  maxSize: number;
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
 * Supports NATS integration, event caching, and subscription management
 */
export abstract class BaseWebSocketHandler<
  TData extends BaseWebSocketData = BaseWebSocketData,
  TMessage extends BaseClientMessage = BaseClientMessage,
> {
  protected clients = new Map<string, ServerWebSocket<TData>>();
  protected readonly logger: Logger;
  protected readonly natsClient?: NatsClient;
  protected readonly rateLimit: RateLimitConfig;
  protected readonly requireAuth: boolean;
  protected readonly pingInterval: number;
  protected readonly pongTimeout: number;
  protected readonly authTimeout: number;
  protected readonly enableEventCache: boolean;
  protected pingIntervals = new Map<string, Timer>();
  protected authTimeouts = new Map<string, Timer>();

  // Subscription management
  protected subscriptionManager: SubscriptionManager = {
    subscriptions: new Map(),
    reverseIndex: new Map(),
  };

  // Event cache for deduplication
  protected eventCache: EventCache;
  private natsInitialized = false;

  constructor(config: WebSocketHandlerConfig<TData>) {
    this.logger = config.logger;
    this.natsClient = config.natsClient;
    this.rateLimit = config.rateLimit ?? DEFAULT_RATE_LIMIT;
    this.requireAuth = config.requireAuth ?? false;
    this.pingInterval = config.pingInterval ?? 30_000; // 30 seconds
    this.pongTimeout = config.pongTimeout ?? 5000; // 5 seconds
    this.authTimeout = config.authTimeout ?? 5000; // 5 seconds to authenticate
    this.enableEventCache = config.enableEventCache ?? false;
    this.eventCache = {
      cache: new Map(),
      maxSize: config.eventCacheMaxSize ?? 1000,
    };
  }

  /**
   * Initialize NATS subscriptions
   * Should be called after handler is created
   */
  async initialize(): Promise<void> {
    if (this.natsClient && !this.natsInitialized) {
      await this.setupNatsSubscriptions();
      this.natsInitialized = true;
      this.logger.info("WebSocket handler NATS subscriptions initialized");
    }
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

    // Start auth timeout if authentication is required
    if (this.requireAuth) {
      this.startAuthTimeout(ws);
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

    // Clear auth timeout
    const authTimeout = this.authTimeouts.get(clientId);
    if (authTimeout) {
      clearTimeout(authTimeout);
      this.authTimeouts.delete(clientId);
    }

    // Clean up subscriptions
    this.unsubscribeAll(clientId);

    // Clean up event cache
    if (this.enableEventCache) {
      this.eventCache.cache.delete(clientId);
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

  // ===== Subscription Management =====

  /**
   * Subscribe client to a channel
   */
  protected subscribeToChannel(clientId: string, channel: string): void {
    // Add to client's subscriptions
    const clientSubs = this.subscriptionManager.subscriptions.get(clientId);
    if (clientSubs) {
      clientSubs.add(channel);
    } else {
      this.subscriptionManager.subscriptions.set(clientId, new Set([channel]));
    }

    // Add to reverse index
    const channelClients = this.subscriptionManager.reverseIndex.get(channel);
    if (channelClients) {
      channelClients.add(clientId);
    } else {
      this.subscriptionManager.reverseIndex.set(channel, new Set([clientId]));
    }

    this.logger.debug("Client subscribed to channel", { clientId, channel });
  }

  /**
   * Unsubscribe client from a channel
   */
  protected unsubscribeFromChannel(clientId: string, channel: string): void {
    // Remove from client's subscriptions
    const clientSubs = this.subscriptionManager.subscriptions.get(clientId);
    if (clientSubs) {
      clientSubs.delete(channel);
      if (clientSubs.size === 0) {
        this.subscriptionManager.subscriptions.delete(clientId);
      }
    }

    // Remove from reverse index
    const channelClients = this.subscriptionManager.reverseIndex.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      if (channelClients.size === 0) {
        this.subscriptionManager.reverseIndex.delete(channel);
      }
    }

    this.logger.debug("Client unsubscribed from channel", {
      clientId,
      channel,
    });
  }

  /**
   * Unsubscribe client from all channels
   */
  protected unsubscribeAll(clientId: string): void {
    const clientSubs = this.subscriptionManager.subscriptions.get(clientId);
    if (clientSubs) {
      for (const channel of clientSubs) {
        const channelClients =
          this.subscriptionManager.reverseIndex.get(channel);
        if (channelClients) {
          channelClients.delete(clientId);
          if (channelClients.size === 0) {
            this.subscriptionManager.reverseIndex.delete(channel);
          }
        }
      }
      this.subscriptionManager.subscriptions.delete(clientId);
    }
  }

  /**
   * Get all channels a client is subscribed to
   */
  protected getClientSubscriptions(clientId: string): Set<string> {
    return this.subscriptionManager.subscriptions.get(clientId) ?? new Set();
  }

  /**
   * Get all clients subscribed to a channel
   */
  protected getChannelClients(channel: string): Set<string> {
    return this.subscriptionManager.reverseIndex.get(channel) ?? new Set();
  }

  /**
   * Broadcast message to all clients subscribed to a channel
   */
  protected broadcastToChannel(
    channel: string,
    data: Record<string, unknown>
  ): void {
    const clients = this.getChannelClients(channel);
    const message = JSON.stringify(data);

    for (const clientId of clients) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(message);
        } catch (error) {
          this.logger.error("Failed to send message to client", {
            clientId,
            channel,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  // ===== Event Caching =====

  /**
   * Check if event was already sent to client (deduplication)
   */
  protected hasSeenEvent(clientId: string, eventId: string): boolean {
    if (!this.enableEventCache) return false;

    const clientEvents = this.eventCache.cache.get(clientId);
    return clientEvents ? clientEvents.has(eventId) : false;
  }

  /**
   * Mark event as seen by client
   */
  protected markEventSeen(clientId: string, eventId: string): void {
    if (!this.enableEventCache) return;

    let clientEvents = this.eventCache.cache.get(clientId);
    if (!clientEvents) {
      clientEvents = new Set();
      this.eventCache.cache.set(clientId, clientEvents);
    }

    clientEvents.add(eventId);

    // Clean up if cache is too large
    if (clientEvents.size > this.eventCache.maxSize) {
      const toDelete = Math.floor(this.eventCache.maxSize * 0.1); // Remove 10%
      const eventsArray = Array.from(clientEvents);
      for (let i = 0; i < toDelete; i++) {
        clientEvents.delete(eventsArray[i]);
      }
    }
  }

  // ===== Authentication Timeout =====

  /**
   * Start authentication timeout
   * Closes connection if client doesn't authenticate in time
   */
  protected startAuthTimeout(ws: ServerWebSocket<TData>): void {
    const timeout = setTimeout(() => {
      if (!this.isAuthenticated(ws)) {
        this.logger.warn("Client authentication timeout", {
          clientId: ws.data.clientId,
        });
        ws.close(1008, "Authentication timeout");
      }
    }, this.authTimeout);

    this.authTimeouts.set(ws.data.clientId, timeout);
  }

  /**
   * Clear authentication timeout (call after successful auth)
   */
  protected clearAuthTimeout(clientId: string): void {
    const timeout = this.authTimeouts.get(clientId);
    if (timeout) {
      clearTimeout(timeout);
      this.authTimeouts.delete(clientId);
    }
  }

  // ===== NATS Integration =====

  /**
   * Setup NATS subscriptions
   * Override in subclass to subscribe to NATS subjects
   */
  protected async setupNatsSubscriptions(): Promise<void> {
    // Override in subclass
  }

  /**
   * Publish event to NATS
   */
  protected async publishToNats(subject: string, data: unknown): Promise<void> {
    if (!this.natsClient) {
      this.logger.warn("NATS client not available, cannot publish event", {
        subject,
      });
      return;
    }

    try {
      await this.natsClient.publish(subject, JSON.stringify(data));
      this.logger.debug("Published event to NATS", { subject });
    } catch (error) {
      this.logger.error("Failed to publish to NATS", {
        subject,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Subscribe to NATS subject and broadcast to WebSocket clients
   */
  protected async subscribeNatsAndBroadcast(
    subject: string,
    channel: string
  ): Promise<void> {
    if (!this.natsClient) {
      this.logger.warn("NATS client not available, cannot subscribe", {
        subject,
      });
      return;
    }

    try {
      await this.natsClient.subscribe(subject, (msg: string) => {
        try {
          const data = JSON.parse(msg);
          this.broadcastToChannel(channel, data);
        } catch (error) {
          this.logger.error("Failed to parse NATS message", {
            subject,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return Promise.resolve();
      });

      this.logger.info("Subscribed to NATS subject", { subject, channel });
    } catch (error) {
      this.logger.error("Failed to subscribe to NATS", {
        subject,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
