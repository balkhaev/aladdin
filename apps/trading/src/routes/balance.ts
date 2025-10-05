/**
 * Balance Routes
 */

import { createSuccessResponse } from "@aladdin/shared/http";
import { validateQuery } from "@aladdin/shared/middleware/validation";
import type { Hono } from "hono";
import type { TradingService } from "../services/trading";
import {
  type GetBalancesQuery,
  getBalancesQuerySchema,
} from "../validation/schemas";

export function setupBalanceRoutes(app: Hono, service: TradingService): void {
  /**
   * GET /api/trading/balances - Get balances
   */
  app.get(
    "/api/trading/balances",
    validateQuery(getBalancesQuerySchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const query = c.get("validatedQuery") as GetBalancesQuery;

      const balances = await service.getBalances(userId, query.portfolioId);

      return c.json(
        createSuccessResponse({
          balances,
          count: balances.length,
        })
      );
    }
  );
}
