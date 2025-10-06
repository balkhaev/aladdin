/**
 * Example 4: Service with NATS Event Publishing and Subscription
 *
 * This example demonstrates event-driven architecture using NATS messaging.
 */

import { createSuccessResponse } from "@aladdin/http/responses";
import { BaseService, initializeService } from "@aladdin/service";
import type { Hono } from "hono";

// Define event types
type OrderCreatedEvent = {
  orderId: string;
  userId: string;
  total: number;
  items: Array<{ productId: string; quantity: number }>;
  timestamp: string;
};

type OrderUpdatedEvent = {
  orderId: string;
  status: string;
  timestamp: string;
};

class OrderService extends BaseService {
  private orders = new Map<string, OrderCreatedEvent>();

  getServiceName(): string {
    return "order-service";
  }

  // Subscribe to events on startup
  protected override async onStart(): Promise<void> {
    // Subscribe to payment events
    await this.subscribeToEvents(
      "payment.completed",
      this.handlePaymentCompleted.bind(this)
    );

    // Subscribe to inventory events
    await this.subscribeToEvents(
      "inventory.reserved",
      this.handleInventoryReserved.bind(this)
    );

    this.logger.info("Order service subscribed to events");
  }

  // Create order and publish event
  async createOrder(data: {
    userId: string;
    items: Array<{ productId: string; quantity: number }>;
  }) {
    const orderId = `order-${Date.now()}`;
    const total = data.items.reduce(
      (sum, item) => sum + item.quantity * 100,
      0
    );

    const order: OrderCreatedEvent = {
      orderId,
      userId: data.userId,
      total,
      items: data.items,
      timestamp: new Date().toISOString(),
    };

    // Store order
    this.orders.set(orderId, order);

    // Publish event
    await this.publishEvent("orders.created", order);

    this.logger.info("Order created", { orderId });

    return order;
  }

  // Update order status and publish event
  async updateOrderStatus(orderId: string, status: string) {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const event: OrderUpdatedEvent = {
      orderId,
      status,
      timestamp: new Date().toISOString(),
    };

    // Publish status update event
    await this.publishEvent("orders.updated", event);

    this.logger.info("Order status updated", { orderId, status });

    return event;
  }

  // Event handlers
  private async handlePaymentCompleted(data: unknown) {
    const { orderId } = data as { orderId: string };
    this.logger.info("Payment completed for order", { orderId });

    // Update order status
    await this.updateOrderStatus(orderId, "paid");
  }

  private async handleInventoryReserved(data: unknown) {
    const { orderId } = data as { orderId: string };
    this.logger.info("Inventory reserved for order", { orderId });

    // Update order status
    await this.updateOrderStatus(orderId, "reserved");
  }

  getOrder(orderId: string) {
    return this.orders.get(orderId);
  }
}

await initializeService({
  serviceName: "order-service",
  port: 3023,

  createService: (deps) =>
    new OrderService({
      ...deps,
      enableCache: false,
      enableServiceClient: false,
    }),

  setupRoutes: (app: Hono, service: OrderService) => {
    // POST /api/orders - Create new order
    app.post("/api/orders", async (c) => {
      const body = await c.req.json<{
        userId: string;
        items: Array<{ productId: string; quantity: number }>;
      }>();

      const order = await service.createOrder(body);

      return c.json(createSuccessResponse(order), 201);
    });

    // GET /api/orders/:id - Get order
    app.get("/api/orders/:id", async (c) => {
      const { id } = c.req.param();
      const order = service.getOrder(id);

      if (!order) {
        return c.json(
          {
            success: false,
            error: {
              code: "ORDER_NOT_FOUND",
              message: "Order not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      return c.json(createSuccessResponse(order));
    });

    // POST /api/orders/:id/status - Update order status
    app.post("/api/orders/:id/status", async (c) => {
      const { id } = c.req.param();
      const { status } = await c.req.json<{ status: string }>();

      const event = await service.updateOrderStatus(id, status);

      return c.json(createSuccessResponse(event));
    });
  },

  // Enable NATS for event messaging
  dependencies: {
    nats: true,
    postgres: false,
    clickhouse: false,
  },
});
