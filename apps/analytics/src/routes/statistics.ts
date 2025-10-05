/**
 * Statistics and Metrics Routes
 */

import type { CacheService } from "@aladdin/cache";
import { validateQuery } from "@aladdin/validation/middleware";
import {
  type GetStatisticsQuery,
  getStatisticsQuerySchema,
} from "@aladdin/validation/schemas/analytics";
import type { Hono } from "hono";
import { CACHE_TTL, DEFAULTS, SERVICES, TIME } from "../config";
import type { AnalyticsService } from "../services/analytics";

export function setupStatisticsRoutes(
  app: Hono,
  service: AnalyticsService,
  cache?: CacheService
): void {
  /**
   * GET /api/analytics/statistics - Get trading statistics
   */
  app.get(
    "/api/analytics/statistics",
    validateQuery(getStatisticsQuerySchema),
    async (c) => {
      // TODO: Get portfolioId from auth or query
      const query = c.get("validatedQuery") as GetStatisticsQuery;
      const portfolioId = query.portfolioId ?? "default-portfolio";

      const statistics = await service.getStatistics(
        portfolioId,
        query.from,
        query.to
      );

      return c.json({
        success: true,
        data: statistics,
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/analytics/market-overview - Get market overview
   */
  app.get("/api/analytics/market-overview", async (c) => {
    // Try cache first
    if (cache) {
      const cacheKey = "market-overview";
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json({
          success: true,
          data: cached,
          timestamp: Date.now(),
        });
      }
    }

    const marketOverview = await service.getMarketOverview();

    // Cache for configured TTL
    if (cache) {
      const cacheKey = "market-overview";
      await cache.set(cacheKey, marketOverview, CACHE_TTL.MARKET_OVERVIEW);
    }

    return c.json({
      success: true,
      data: marketOverview,
      timestamp: Date.now(),
    });
  });

  /**
   * GET /api/analytics/portfolio/:portfolioId/advanced-metrics
   * Get advanced performance metrics
   */
  app.get(
    "/api/analytics/portfolio/:portfolioId/advanced-metrics",
    async (c) => {
      const portfolioId = c.req.param("portfolioId");
      const fromQuery = c.req.query("from");
      const toQuery = c.req.query("to");
      const benchmark = c.req.query("benchmark") ?? DEFAULTS.BENCHMARK;

      // Default to last N days if not specified
      const from = fromQuery
        ? new Date(fromQuery)
        : new Date(
            Date.now() - DEFAULTS.DAYS_LOOKBACK * TIME.MILLISECONDS_PER_DAY
          );
      const to = toQuery ? new Date(toQuery) : new Date();

      // Try cache first (longer TTL for historical data)
      if (cache) {
        const cacheKey = `advanced-metrics:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${benchmark}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
          return c.json({
            success: true,
            data: cached,
            timestamp: Date.now(),
          });
        }
      }

      // Get advanced metrics from service
      const metrics = await service.getAdvancedMetrics(
        portfolioId,
        from,
        to,
        benchmark
      );

      // Cache for configured TTL
      if (cache) {
        const cacheKey = `advanced-metrics:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${benchmark}`;
        await cache.set(cacheKey, metrics, CACHE_TTL.ADVANCED_METRICS);
      }

      return c.json({
        success: true,
        data: metrics,
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/analytics/portfolio/:portfolioId/summary
   * Get comprehensive portfolio summary
   */
  app.get("/api/analytics/portfolio/:portfolioId/summary", async (c) => {
    const portfolioId = c.req.param("portfolioId");
    const fromQuery = c.req.query("from");
    const toQuery = c.req.query("to");
    const window =
      (c.req.query("window") as "7d" | "30d" | "90d" | "1y") ?? DEFAULTS.WINDOW;

    // Default to last N days if not specified
    const from = fromQuery
      ? new Date(fromQuery)
      : new Date(
          Date.now() - DEFAULTS.DAYS_LOOKBACK * TIME.MILLISECONDS_PER_DAY
        );
    const to = toQuery ? new Date(toQuery) : new Date();

    // Try cache first
    if (cache) {
      const cacheKey = `summary:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${window}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json({
          success: true,
          data: cached,
          timestamp: Date.now(),
        });
      }
    }

    // Fetch all data in parallel for maximum performance
    const [advancedMetrics, marketOverview, riskMetrics, correlations] =
      await Promise.allSettled([
        // Advanced performance metrics
        service.getAdvancedMetrics(portfolioId, from, to, DEFAULTS.BENCHMARK),

        // Market overview
        service.getMarketOverview(),

        // Risk metrics (VaR) - call external Risk service
        fetch(
          `${SERVICES.RISK_URL}/api/risk/var?portfolioId=${portfolioId}&confidenceLevel=${DEFAULTS.VAR_CONFIDENCE}&timeHorizon=${DEFAULTS.VAR_TIME_WINDOW}`
        )
          .then((res) => res.json())
          .then((data: { success: boolean; data?: unknown }) =>
            data.success ? data.data : null
          )
          .catch(() => null),

        // Correlations - call external Risk service
        fetch(
          `${SERVICES.RISK_URL}/api/risk/portfolio/${portfolioId}/correlations?window=${window}`
        )
          .then((res) => res.json())
          .then((data: { success: boolean; data?: unknown }) =>
            data.success ? data.data : null
          )
          .catch(() => null),
      ]);

    // Build summary response with error handling
    const summary = {
      portfolioId,
      period: {
        from,
        to,
      },
      performance:
        advancedMetrics.status === "fulfilled"
          ? (advancedMetrics.value as { performance?: unknown }).performance
          : null,
      trading:
        advancedMetrics.status === "fulfilled"
          ? (advancedMetrics.value as { trading?: unknown }).trading
          : null,
      risk: {
        var95:
          riskMetrics.status === "fulfilled" && riskMetrics.value
            ? (riskMetrics.value as { var95?: number }).var95
            : null,
        var99:
          riskMetrics.status === "fulfilled" && riskMetrics.value
            ? (riskMetrics.value as { var99?: number }).var99
            : null,
        sharpeRatio:
          riskMetrics.status === "fulfilled" && riskMetrics.value
            ? (riskMetrics.value as { sharpeRatio?: number }).sharpeRatio
            : null,
        maxDrawdown:
          riskMetrics.status === "fulfilled" && riskMetrics.value
            ? (riskMetrics.value as { maxDrawdown?: number }).maxDrawdown
            : null,
      },
      correlations:
        correlations.status === "fulfilled" && correlations.value
          ? {
              diversificationScore: (
                correlations.value as {
                  diversificationScore?: number;
                }
              ).diversificationScore,
              avgCorrelation: (
                correlations.value as {
                  avgCorrelation?: number;
                }
              ).avgCorrelation,
              highlyCorrelated:
                (
                  correlations.value as {
                    highlyCorrelated?: unknown[];
                  }
                ).highlyCorrelated?.slice(0, DEFAULTS.TOP_ITEMS_LIMIT) ?? [],
            }
          : null,
      market:
        marketOverview.status === "fulfilled"
          ? {
              topGainers: (
                marketOverview.value as {
                  topGainers: unknown[];
                }
              ).topGainers.slice(0, DEFAULTS.TOP_ITEMS_LIMIT),
              topLosers: (
                marketOverview.value as {
                  topLosers: unknown[];
                }
              ).topLosers.slice(0, DEFAULTS.TOP_ITEMS_LIMIT),
              totalVolume24h: (
                marketOverview.value as {
                  marketStats: { totalVolume24h: number };
                }
              ).marketStats.totalVolume24h,
              avgVolatility: (
                marketOverview.value as {
                  marketStats: { avgVolatility: number };
                }
              ).marketStats.avgVolatility,
            }
          : null,
      generatedAt: new Date(),
    };

    // Cache for configured TTL
    if (cache) {
      const cacheKey = `summary:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${window}`;
      await cache.set(cacheKey, summary, CACHE_TTL.SUMMARY);
    }

    return c.json({
      success: true,
      data: summary,
      timestamp: Date.now(),
    });
  });
}
