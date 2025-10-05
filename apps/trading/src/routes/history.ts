/**
 * Trade History Routes
 */

import { createSuccessResponse } from "@aladdin/http/responses";
import { validateQuery } from "@aladdin/validation/middleware";
import type { Hono } from "hono";
import type { TradingService } from "../services/trading";
import {
  type GetTradesQuery,
  getTradesQuerySchema,
} from "../validation/schemas";

export function setupHistoryRoutes(app: Hono, service: TradingService): void {
  /**
   * GET /api/trading/trades - Get trade history
   */
  app.get(
    "/api/trading/trades",
    validateQuery(getTradesQuerySchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const query = c.get("validatedQuery") as GetTradesQuery;

      const trades = await service.getTrades(
        userId,
        query.portfolioId,
        query.symbol,
        query.limit
      );

      return c.json(
        createSuccessResponse({
          trades,
          count: trades.length,
        })
      );
    }
  );
}
