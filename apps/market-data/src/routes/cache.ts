/**
 * Cache Management Routes
 */

import type { CacheService } from "@aladdin/shared/cache";
import { createSuccessResponse } from "@aladdin/shared/http";
import type { Hono } from "hono";

export function setupCacheRoutes(app: Hono, cache?: CacheService): void {
  /**
   * GET /api/market-data/cache/stats - Get cache statistics
   */
  app.get("/api/market-data/cache/stats", (c) => {
    if (!cache) {
      return c.json({
        success: false,
        error: {
          code: "CACHE_DISABLED",
          message: "Redis cache is not configured",
        },
        timestamp: Date.now(),
      });
    }

    const stats = cache.getStats();
    return c.json(
      createSuccessResponse({
        ...stats,
        enabled: true,
      })
    );
  });

  /**
   * POST /api/market-data/cache/flush - Flush cache
   */
  app.post("/api/market-data/cache/flush", async (c) => {
    if (!cache) {
      return c.json({
        success: false,
        error: {
          code: "CACHE_DISABLED",
          message: "Redis cache is not configured",
        },
        timestamp: Date.now(),
      });
    }

    await cache.flush();
    return c.json(
      createSuccessResponse({
        message: "Cache flushed successfully",
      })
    );
  });
}
