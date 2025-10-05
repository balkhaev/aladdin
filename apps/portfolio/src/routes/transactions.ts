/**
 * Transactions Routes
 */

import { createSuccessResponse } from "@aladdin/shared/http";
import { validateQuery } from "@aladdin/shared/middleware/validation";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";
import {
  type GetTransactionsQuery,
  getTransactionsQuerySchema,
} from "../validation/schemas";

export function setupTransactionsRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * GET /api/portfolio/:id/transactions - Get portfolio transactions
   */
  app.get(
    "/api/portfolio/:id/transactions",
    validateQuery(getTransactionsQuerySchema),
    async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";
      const query = c.get("validatedQuery") as GetTransactionsQuery;

      const transactions = await service.getTransactions(id, userId, {
        from: query.from,
        to: query.to,
        limit: query.limit,
      });

      return c.json(createSuccessResponse(transactions));
    }
  );
}
