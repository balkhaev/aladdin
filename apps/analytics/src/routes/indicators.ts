/**
 * Indicators Routes
 */

import type { CacheService } from "@aladdin/shared/cache";
import { validateQuery } from "@aladdin/shared/middleware/validation";
import { getIndicatorsQuerySchema } from "@aladdin/shared/schemas/analytics";
import type { Context, Hono } from "hono";
import { CACHE_TTL } from "../config";
import type { AnalyticsService } from "../services/analytics";

export function setupIndicatorsRoutes(
  app: Hono,
  service: AnalyticsService,
  cache?: CacheService
): void {
  /**
   * GET /api/analytics/indicators/:symbol - Get technical indicators
   */
  app.get(
    "/api/analytics/indicators/:symbol",
    validateQuery(getIndicatorsQuerySchema),
    async (c: Context) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const query = c.get("validatedQuery");

      // Try cache first
      if (cache) {
        const cacheKey = `indicators:${symbol}:${query.timeframe}:${query.indicators.join(",")}:${query.limit}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
          return c.json({
            success: true,
            data: cached,
            timestamp: Date.now(),
          });
        }
      }

      const indicators = await service.calculateIndicators(
        symbol,
        query.indicators,
        query.timeframe,
        query.limit
      );

      // Cache for configured TTL
      if (cache) {
        const cacheKey = `indicators:${symbol}:${query.timeframe}:${query.indicators.join(",")}:${query.limit}`;
        await cache.set(cacheKey, indicators, CACHE_TTL.INDICATORS);
      }

      return c.json({
        success: true,
        data: indicators,
        timestamp: Date.now(),
      });
    }
  );
}
