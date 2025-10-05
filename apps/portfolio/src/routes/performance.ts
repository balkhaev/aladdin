/**
 * Performance Routes
 */

import { createSuccessResponse } from "@aladdin/shared/http";
import { validateQuery } from "@aladdin/shared/middleware/validation";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";
import {
  type GetPerformanceQuery,
  getPerformanceQuerySchema,
} from "../validation/schemas";

export function setupPerformanceRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * GET /api/portfolio/:id/performance - Get portfolio performance
   */
  app.get(
    "/api/portfolio/:id/performance",
    validateQuery(getPerformanceQuerySchema),
    async (c) => {
      const { id } = c.req.param();
      const userId = c.req.header("x-user-id") ?? "test-user";
      const query = c.get("validatedQuery") as GetPerformanceQuery;

      const performance = await service.getPerformance(
        id,
        userId,
        query.days
      );

      return c.json(createSuccessResponse(performance));
    }
  );
}
