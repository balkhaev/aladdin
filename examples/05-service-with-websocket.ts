/**
 * Example 5: Service with WebSocket Support
 *
 * This example shows how to add real-time WebSocket functionality using
 * BaseWebSocketHandler.
 */

import { createSuccessResponse } from "@aladdin/http/responses";
import { BaseService, initializeService } from "@aladdin/service";
import {
  type BaseWebSocketData,
  BaseWebSocketHandler,
} from "@aladdin/websocket";
import type { ServerWebSocket } from "bun";
import type { Hono } from "hono";

// Define WebSocket data type
type NotificationWebSocketData = BaseWebSocketData & {
  userId?: string;
  subscriptions: Set<string>;
};

// Define message types
type ClientMessage = {
  type: "subscribe" | "unsubscribe";
  channel?: string;
};

// WebSocket handler
class NotificationWebSocketHandler extends BaseWebSocketHandler<
  NotificationWebSocketData,
  ClientMessage
> {
  protected handleSubscribe(
    ws: ServerWebSocket<NotificationWebSocketData>,
    data: ClientMessage
  ): void {
    if (!data.channel) {
      this.sendError(ws, "Channel is required");
      return;
    }

    // Add to subscriptions
    ws.data.subscriptions.add(data.channel);
    this.subscribeToChannel(ws.data.clientId, data.channel);

    this.sendMessage(ws, {
      type: "subscribed",
      channel: data.channel,
      timestamp: Date.now(),
    });
  }

  protected handleUnsubscribe(
    ws: ServerWebSocket<NotificationWebSocketData>,
    data: ClientMessage
  ): void {
    if (!data.channel) {
      this.sendError(ws, "Channel is required");
      return;
    }

    // Remove from subscriptions
    ws.data.subscriptions.delete(data.channel);
    this.unsubscribeFromChannel(ws.data.clientId, data.channel);

    this.sendMessage(ws, {
      type: "unsubscribed",
      channel: data.channel,
      timestamp: Date.now(),
    });
  }

  // Setup NATS subscriptions
  protected override async setupNatsSubscriptions(): Promise<void> {
    // Subscribe to notification events
    await this.subscribeNatsAndBroadcast("notifications.*", "notifications");
  }
}

// Service class
class NotificationService extends BaseService {
  getServiceName(): string {
    return "notification-service";
  }

  // Send notification (publishes to NATS, broadcasted to WebSocket clients)
  async sendNotification(userId: string, message: string) {
    const notification = {
      userId,
      message,
      timestamp: new Date().toISOString(),
      id: `notif-${Date.now()}`,
    };

    // Publish to NATS (will be broadcasted to WebSocket clients)
    await this.publishEvent("notifications.sent", notification);

    this.logger.info("Notification sent", {
      userId,
      notificationId: notification.id,
    });

    return notification;
  }
}

// WebSocket handler instance (initialized in afterInit)
let wsHandler: NotificationWebSocketHandler;

await initializeService<NotificationService, NotificationWebSocketData>({
  serviceName: "notification-service",
  port: 3024,

  createService: (deps) =>
    new NotificationService({
      ...deps,
      enableCache: false,
      enableServiceClient: false,
    }),

  // Initialize WebSocket handler
  afterInit: async (_service, deps) => {
    wsHandler = new NotificationWebSocketHandler({
      logger: deps.logger,
      natsClient: deps.natsClient,
      requireAuth: false,
    });

    await wsHandler.initialize();
    deps.logger.info("WebSocket handler initialized");
  },

  setupRoutes: (app: Hono, service: NotificationService) => {
    // POST /api/notifications - Send notification
    app.post("/api/notifications", async (c) => {
      const { userId, message } = await c.req.json<{
        userId: string;
        message: string;
      }>();

      const notification = await service.sendNotification(userId, message);

      return c.json(createSuccessResponse(notification), 201);
    });

    // GET /api/notifications/stats - Get WebSocket stats
    app.get("/api/notifications/stats", async (c) => {
      const stats = {
        connectedClients: wsHandler ? (wsHandler as any).clients.size : 0,
        timestamp: Date.now(),
      };

      return c.json(createSuccessResponse(stats));
    });
  },

  // Configure WebSocket
  websocket: {
    enabled: true,
    path: "/ws/notifications",
    handlers: {
      open: (ws) => wsHandler.onOpen(ws),
      message: (ws, message) => wsHandler.onMessage(ws, message),
      close: (ws, code, reason) => wsHandler.onClose(ws, code, reason),
    },
    createWebSocketData: () => ({
      clientId: crypto.randomUUID(),
      messageCount: 0,
      lastMessageTime: Date.now(),
      lastPingTime: Date.now(),
      subscriptions: new Set<string>(),
    }),
  },

  dependencies: {
    nats: true,
    postgres: false,
    clickhouse: false,
  },
});
