/**
 * Price Update Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";

export function setupPricesRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * POST /api/portfolio/:id/update-prices - Queue async price update for portfolio
   */
  app.post("/api/portfolio/:id/update-prices", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    const jobId = await service.queuePriceUpdate(id, userId);

    return c.json(
      createSuccessResponse({
        message: "Price update queued",
        jobId,
        portfolioId: id,
        statusUrl: `/api/portfolio/${id}/update-prices/${jobId}`,
      }),
      HTTP_STATUS.ACCEPTED
    );
  });

  /**
   * GET /api/portfolio/:id/update-prices/:jobId - Get price update job status
   */
  app.get("/api/portfolio/:id/update-prices/:jobId", async (c) => {
    const { jobId } = c.req.param();

    const status = await service.getPriceUpdateStatus(jobId);

    if (!status) {
      return c.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Job not found",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.NOT_FOUND
      );
    }

    return c.json(createSuccessResponse(status));
  });

  /**
   * GET /api/portfolio/queue/stats - Get queue statistics
   */
  app.get("/api/portfolio/queue/stats", async (c) => {
    const stats = await service.getQueueStats();
    return c.json(createSuccessResponse(stats));
  });
}
