/**
 * Futures Data Routes (Funding Rate, Open Interest)
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import {
  getFundingRateQuerySchema,
  getOpenInterestQuerySchema,
} from "@aladdin/validation/schemas/market-data";
import type { Hono } from "hono";
import type { FundingRateService } from "../services/funding-rate-service";
import type { OpenInterestService } from "../services/open-interest-service";

export function setupFuturesRoutes(
  app: Hono,
  fundingRateService?: FundingRateService,
  openInterestService?: OpenInterestService
): void {
  // ===== Funding Rate Endpoints =====

  /**
   * GET /api/market-data/:symbol/funding-rate - Get current funding rate
   */
  app.get("/api/market-data/:symbol/funding-rate", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const exchange = c.req.query("exchange")?.toLowerCase() ?? "binance";

    if (!fundingRateService) {
      return c.json(
        { success: false, error: "Funding rate service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const data = await fundingRateService.getFundingRate(symbol, exchange);
      return c.json(createSuccessResponse(data));
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch funding rate",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/market-data/:symbol/funding-rate/all - Get funding rate across all exchanges
   */
  app.get("/api/market-data/:symbol/funding-rate/all", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();

    if (!fundingRateService) {
      return c.json(
        { success: false, error: "Funding rate service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const dataMap =
        await fundingRateService.getAllExchangesFundingRate(symbol);
      const result = Object.fromEntries(dataMap);

      return c.json(createSuccessResponse(result));
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch funding rates",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/market-data/:symbol/funding-rate/history - Get historical funding rates
   */
  app.get("/api/market-data/:symbol/funding-rate/history", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const query = getFundingRateQuerySchema.parse({
      exchange: c.req.query("exchange"),
      hours: c.req.query("hours") ?? "24",
    });

    const exchange = query.exchange ?? "binance";

    if (!fundingRateService) {
      return c.json(
        { success: false, error: "Funding rate service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const history = await fundingRateService.getHistoricalFundingRates(
        symbol,
        exchange,
        query.hours
      );

      return c.json(
        createSuccessResponse({
          symbol,
          exchange,
          hours: query.hours,
          count: history.length,
          data: history,
        })
      );
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch history",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  // ===== Open Interest Endpoints =====

  /**
   * GET /api/market-data/:symbol/open-interest - Get current open interest
   */
  app.get("/api/market-data/:symbol/open-interest", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const exchange = c.req.query("exchange")?.toLowerCase() ?? "binance";

    if (!openInterestService) {
      return c.json(
        { success: false, error: "Open interest service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const data = await openInterestService.getOpenInterest(symbol, exchange);

      return c.json(createSuccessResponse(data));
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch open interest",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/market-data/:symbol/open-interest/all - Get open interest across all exchanges
   */
  app.get("/api/market-data/:symbol/open-interest/all", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();

    if (!openInterestService) {
      return c.json(
        { success: false, error: "Open interest service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const dataMap = await openInterestService.getAllExchangesOI(symbol);
      const result = Object.fromEntries(dataMap);

      return c.json(createSuccessResponse(result));
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch open interest",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/market-data/:symbol/open-interest/history - Get historical open interest
   */
  app.get("/api/market-data/:symbol/open-interest/history", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const query = getOpenInterestQuerySchema.parse({
      exchange: c.req.query("exchange"),
      hours: c.req.query("hours") ?? "24",
    });

    const exchange = query.exchange ?? "binance";

    if (!openInterestService) {
      return c.json(
        { success: false, error: "Open interest service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const history = await openInterestService.getHistoricalOI(
        symbol,
        exchange,
        query.hours
      );

      return c.json(
        createSuccessResponse({
          symbol,
          exchange,
          hours: query.hours,
          count: history.length,
          data: history,
        })
      );
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch history",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });
}
