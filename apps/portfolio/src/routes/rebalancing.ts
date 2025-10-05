/**
 * Rebalancing Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";

export function setupRebalancingRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * POST /api/portfolio/:id/rebalancing/analyze - Analyze rebalancing needs
   */
  app.post("/api/portfolio/:id/rebalancing/analyze", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    try {
      const body = await c.req.json<{
        targetWeights: Record<string, number>;
        config: {
          strategy: "periodic" | "threshold" | "opportunistic" | "hybrid";
          frequency?: "daily" | "weekly" | "monthly" | "quarterly";
          thresholdPercent?: number;
          minTradeSize?: number;
          maxTransactionCost?: number;
          allowPartialRebalance?: boolean;
        };
      }>();

      const plan = await service.analyzeRebalancing({
        portfolioId: id,
        userId,
        targetWeights: body.targetWeights,
        config: body.config,
      });

      return c.json(createSuccessResponse(plan));
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "REBALANCING_ANALYSIS_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });

  /**
   * POST /api/portfolio/:id/rebalancing/execute - Execute rebalancing
   */
  app.post("/api/portfolio/:id/rebalancing/execute", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    try {
      const body = await c.req.json<{
        plan: {
          needsRebalancing: boolean;
          reason: string;
          totalValue: number;
          actions: Array<{
            symbol: string;
            action: "buy" | "sell" | "hold";
            currentWeight: number;
            targetWeight: number;
            currentValue: number;
            targetValue: number;
            deltaValue: number;
            deltaQuantity: number;
            estimatedCost: number;
          }>;
          totalTransactionCost: number;
          estimatedSlippage: number;
          netBenefit: number;
          priority: "low" | "medium" | "high";
        };
        dryRun?: boolean;
      }>();

      const orders = await service.executeRebalancing({
        portfolioId: id,
        userId,
        plan: body.plan,
        dryRun: body.dryRun ?? true,
      });

      return c.json(
        createSuccessResponse({ orders, dryRun: body.dryRun ?? true })
      );
    } catch (error) {
      return c.json(
        {
          success: false,
          error: {
            code: "REBALANCING_EXECUTION_FAILED",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  });
}
