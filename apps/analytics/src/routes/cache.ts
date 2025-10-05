/**
 * Cache Management Routes
 */

import type { CacheService } from "@aladdin/cache";
import type { Hono } from "hono";

export function setupCacheRoutes(app: Hono, cache?: CacheService): void {
  /**
   * GET /api/analytics/cache/stats - Get cache statistics
   */
  app.get("/api/analytics/cache/stats", (c) => {
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
    return c.json({
      success: true,
      data: {
        ...stats,
        enabled: true,
      },
      timestamp: Date.now(),
    });
  });

  /**
   * POST /api/analytics/cache/flush - Flush cache
   */
  app.post("/api/analytics/cache/flush", async (c) => {
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
    return c.json({
      success: true,
      data: {
        message: "Cache flushed successfully",
      },
      timestamp: Date.now(),
    });
  });
}
