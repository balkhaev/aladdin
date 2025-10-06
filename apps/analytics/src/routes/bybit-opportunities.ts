/**
 * Bybit Opportunities API Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Hono } from "hono";
import type { OpportunitiesService } from "../services/bybit-opportunities/opportunities";

export function setupBybitOpportunitiesRoutes(
  app: Hono,
  opportunitiesService: OpportunitiesService
): void {
  /**
   * GET /api/analytics/bybit-opportunities/list - Get opportunities with filters
   */
  app.get("/api/analytics/bybit-opportunities/list", async (c) => {
    try {
      const limit = c.req.query("limit")
        ? Number(c.req.query("limit"))
        : undefined;
      const minScore = c.req.query("minScore")
        ? Number(c.req.query("minScore"))
        : undefined;
      const signal = c.req.query("signal") || undefined;
      const minConfidence = c.req.query("minConfidence")
        ? Number(c.req.query("minConfidence"))
        : undefined;

      const opportunities = await opportunitiesService.getOpportunities({
        limit,
        minScore,
        signal,
        minConfidence,
      });

      return c.json(
        createSuccessResponse({
          opportunities,
          count: opportunities.length,
        })
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "FETCH_ERROR",
            message: "Failed to fetch opportunities",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/analytics/bybit-opportunities/:symbol - Get opportunities for specific symbol
   */
  app.get("/api/analytics/bybit-opportunities/:symbol", async (c) => {
    try {
      const { symbol } = c.req.param();
      const limit = c.req.query("limit")
        ? Number(c.req.query("limit"))
        : undefined;

      const opportunities = await opportunitiesService.getOpportunities({
        limit,
      });

      // Filter by symbol
      const filtered = opportunities.filter((opp) => opp.symbol === symbol);

      return c.json(
        createSuccessResponse({
          symbol,
          opportunities: filtered,
          count: filtered.length,
        })
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "FETCH_ERROR",
            message: "Failed to fetch symbol opportunities",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/analytics/bybit-opportunities/stats - Get statistics
   */
  app.get("/api/analytics/bybit-opportunities/stats", async (c) => {
    try {
      const stats = await opportunitiesService.getStats();

      return c.json(createSuccessResponse(stats));
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "FETCH_ERROR",
            message: "Failed to fetch statistics",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/analytics/bybit-opportunities/symbols - Get monitored symbols
   */
  app.get("/api/analytics/bybit-opportunities/symbols", (c) => {
    try {
      const symbols = opportunitiesService.getSymbols();

      return c.json(
        createSuccessResponse({
          symbols,
          count: symbols.length,
        })
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "FETCH_ERROR",
            message: "Failed to fetch symbols",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * POST /api/analytics/bybit-opportunities/analyze/:symbol - Manually trigger analysis
   */
  app.post("/api/analytics/bybit-opportunities/analyze/:symbol", async (c) => {
    try {
      const { symbol } = c.req.param();

      await opportunitiesService.analyzeSymbolManually(symbol);

      return c.json(
        createSuccessResponse({
          message: "Analysis triggered",
          symbol,
        })
      );
    } catch {
      return c.json(
        {
          success: false,
          error: {
            code: "ANALYSIS_ERROR",
            message: "Failed to trigger analysis",
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });
}
