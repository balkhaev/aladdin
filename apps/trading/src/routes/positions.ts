/**
 * Positions Management Routes
 */

import { createSuccessResponse } from "@aladdin/shared/http";
import { validateQuery } from "@aladdin/shared/middleware/validation";
import type { Hono } from "hono";
import type { TradingService } from "../services/trading";
import {
  type GetPositionsQuery,
  getPositionsQuerySchema,
} from "../validation/schemas";

export function setupPositionsRoutes(app: Hono, service: TradingService): void {
  /**
   * GET /api/trading/positions - Get positions
   */
  app.get(
    "/api/trading/positions",
    validateQuery(getPositionsQuerySchema),
    async (c) => {
      // TODO: Get userId from auth middleware
      const userId = c.req.header("x-user-id") ?? "test-user";
      const query = c.get("validatedQuery") as GetPositionsQuery;

      const positions = await service.getPositions(
        userId,
        query.portfolioId,
        query.symbol
      );

      return c.json(
        createSuccessResponse({
          positions,
          count: positions.length,
        })
      );
    }
  );
}
