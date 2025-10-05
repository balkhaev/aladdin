/**
 * Orders Management Routes
 */

import type { OrderStatus } from "@aladdin/core";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import { validateBody, validateQuery } from "@aladdin/validation/middleware";
import type { Hono } from "hono";
import type { TradingService } from "../services/trading";
import {
  type CancelAllOrdersInput,
  type CreateOrderInput,
  cancelAllOrdersSchema,
  createOrderSchema,
  type GetOrdersQuery,
  getOrderQuerySchema,
  getOrdersQuerySchema,
  type UpdateOrderInput,
  updateOrderSchema,
} from "../validation/schemas";

export function setupOrdersRoutes(app: Hono, service: TradingService): void {
  /**
   * POST /api/trading/orders - Create order
   */
  app.post(
    "/api/trading/orders",
    validateBody(createOrderSchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const validatedData = c.get("validatedBody") as CreateOrderInput;

      const order = await service.createOrder({
        userId,
        portfolioId: validatedData.portfolioId,
        symbol: validatedData.symbol,
        type: validatedData.type,
        side: validatedData.side,
        quantity: validatedData.quantity,
        price: validatedData.price,
        stopPrice: validatedData.stopPrice,
        exchange: validatedData.exchange,
        exchangeCredentialsId: validatedData.exchangeCredentialsId,
      });

      return c.json(createSuccessResponse(order), HTTP_STATUS.CREATED);
    }
  );

  /**
   * DELETE /api/trading/orders/:id - Cancel order
   */
  app.delete("/api/trading/orders/:id", async (c) => {
    // TODO: Get userId from auth middleware
    const userId = c.req.header("x-user-id") ?? "test-user";
    const orderId = c.req.param("id");

    const order = await service.cancelOrder(orderId, userId);

    return c.json(createSuccessResponse(order));
  });

  /**
   * GET /api/trading/orders - Get orders with filters
   */
  app.get(
    "/api/trading/orders",
    validateQuery(getOrdersQuerySchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const query = c.get("validatedQuery") as GetOrdersQuery;

      const result = await service.getOrders({
        userId,
        portfolioId: query.portfolioId,
        status: query.status as OrderStatus | undefined,
        symbol: query.symbol,
        exchange: query.exchange,
        limit: query.limit,
        offset: query.offset,
      });

      return c.json(
        createSuccessResponse({
          orders: result.orders,
          total: result.total,
          count: result.orders.length,
        })
      );
    }
  );

  /**
   * GET /api/trading/orders/:id - Get order by ID
   */
  app.get(
    "/api/trading/orders/:id",
    validateQuery(getOrderQuerySchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const orderId = c.req.param("id");

      const order = await service.getOrderById(orderId, userId);

      if (!order) {
        return c.json(
          {
            success: false,
            error: {
              code: "ORDER_NOT_FOUND",
              message: `Order ${orderId} not found`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      return c.json(createSuccessResponse(order));
    }
  );

  /**
   * PATCH /api/trading/orders/:id - Update order
   */
  app.patch(
    "/api/trading/orders/:id",
    validateBody(updateOrderSchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const orderId = c.req.param("id");
      const validatedData = c.get("validatedBody") as UpdateOrderInput;

      const order = await service.updateOrder(
        orderId,
        userId,
        validatedData.quantity,
        validatedData.price
      );

      return c.json(createSuccessResponse(order));
    }
  );

  /**
   * POST /api/trading/orders/cancel-all - Cancel all orders
   */
  app.post(
    "/api/trading/orders/cancel-all",
    validateBody(cancelAllOrdersSchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const validatedData = c.get("validatedBody") as CancelAllOrdersInput;

      const result = await service.cancelAllOrders(
        userId,
        validatedData.portfolioId,
        validatedData.symbol
      );

      return c.json(createSuccessResponse(result));
    }
  );
}
