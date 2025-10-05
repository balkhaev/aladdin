/**
 * Candles and Historical Data Routes
 */

import { createSuccessResponse } from "@aladdin/http/responses";
import {
  getCandlesQuerySchema,
  getTradesQuerySchema,
} from "@aladdin/validation/schemas/market-data";
import type { Hono } from "hono";
import { LIMITS } from "../config";
import type { MarketDataServiceWrapper } from "../services/market-data-wrapper";

export function setupCandlesRoutes(
  app: Hono,
  service: MarketDataServiceWrapper
): void {
  /**
   * GET /api/market-data/candles/:symbol - Get historical candles
   */
  app.get("/api/market-data/candles/:symbol", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const query = getCandlesQuerySchema.parse({
      timeframe: c.req.query("timeframe") ?? "1h",
      limit: c.req.query("limit") ?? String(LIMITS.DEFAULT_HISTORY_LIMIT),
    });

    const candles = await service.getCandles(
      symbol,
      query.timeframe,
      query.limit
    );

    return c.json(createSuccessResponse(candles));
  });

  /**
   * GET /api/market-data/ticks/:symbol - Get recent ticks
   */
  app.get("/api/market-data/ticks/:symbol", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const limit = Number(
      c.req.query("limit") ?? String(LIMITS.DEFAULT_HISTORY_LIMIT)
    );

    const ticks = await service.getRecentTicks(symbol, limit);

    return c.json(createSuccessResponse(ticks));
  });

  /**
   * GET /api/market-data/trades/:symbol - Get recent trades
   */
  app.get("/api/market-data/trades/:symbol", async (c) => {
    const { symbol } = c.req.param();
    const query = getTradesQuerySchema.parse({
      limit: c.req.query("limit") ?? String(LIMITS.DEFAULT_TRADES_LIMIT),
    });

    const connector = service.getConnector();
    const trades = await connector.getRecentTrades(
      symbol.toUpperCase(),
      query.limit
    );

    return c.json(
      createSuccessResponse({
        symbol: symbol.toUpperCase(),
        trades,
      })
    );
  });
}
