/**
 * Optimization Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";

export function setupOptimizationRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * POST /api/portfolio/:id/optimize - Optimize portfolio weights
   */
  app.post("/api/portfolio/:id/optimize", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    try {
      const body = await c.req.json<{
        assets: string[];
        days?: number;
        constraints?: {
          minWeight?: number;
          maxWeight?: number;
          targetReturn?: number;
          maxRisk?: number;
          allowShorts?: boolean;
        };
      }>();

      const optimized = await service.optimizePortfolio({
        portfolioId: id,
        userId,
        assets: body.assets,
        days: body.days,
        constraints: body.constraints,
      });

      return c.json(createSuccessResponse(optimized));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "OPTIMIZATION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });
}
