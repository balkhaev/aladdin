/**
 * Snapshot Routes
 */

import { createSuccessResponse } from "@aladdin/shared/http";
import type { Hono } from "hono";
import type { PortfolioService } from "../services/portfolio";

export function setupSnapshotRoutes(
  app: Hono,
  service: PortfolioService
): void {
  /**
   * POST /api/portfolio/:id/snapshot - Take portfolio snapshot
   */
  app.post("/api/portfolio/:id/snapshot", async (c) => {
    const { id } = c.req.param();
    const userId = c.req.header("x-user-id") ?? "test-user";

    await service.takeSnapshot(id, userId);

    return c.json(createSuccessResponse({ message: "Snapshot taken" }));
  });
}
