/**
 * Order Book Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { getOrderBookQuerySchema } from "@aladdin/shared/schemas/market-data";
import type { Hono } from "hono";
import { LIMITS } from "../config";
import type { MarketDataServiceWrapper } from "../services/market-data-wrapper";
import type { OrderBookCollector } from "../services/order-book-collector";
import type { OrderBookService } from "../services/order-book-service";

export function setupOrderBookRoutes(
  app: Hono,
  service: MarketDataServiceWrapper,
  orderBookService?: OrderBookService,
  orderBookCollector?: OrderBookCollector
): void {
  /**
   * GET /api/market-data/orderbook/:symbol - Get order book
   */
  app.get("/api/market-data/orderbook/:symbol", async (c) => {
    const { symbol } = c.req.param();
    const query = getOrderBookQuerySchema.parse({
      exchange: c.req.query("exchange"),
      limit: c.req.query("limit") ?? String(LIMITS.DEFAULT_ORDERBOOK_LIMIT),
    });

    const connector = service.getConnector();
    const orderBook = await connector.getOrderBook(
      symbol.toUpperCase(),
      query.limit
    );

    return c.json(createSuccessResponse(orderBook));
  });

  /**
   * GET /api/market-data/:symbol/orderbook - Get current order book snapshot
   */
  app.get("/api/market-data/:symbol/orderbook", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const exchange = c.req.query("exchange")?.toLowerCase() ?? "binance";

    if (!orderBookService) {
      return c.json(
        { success: false, error: "Order book service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const snapshot = await orderBookService.getOrderBook(symbol, exchange);
      const analysis = orderBookService.analyzeSnapshot(snapshot);

      return c.json(
        createSuccessResponse({
          snapshot,
          analysis,
        })
      );
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to fetch order book",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });

  /**
   * GET /api/market-data/:symbol/orderbook/history - Get historical order book data
   */
  app.get("/api/market-data/:symbol/orderbook/history", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const exchange = c.req.query("exchange")?.toLowerCase() ?? "binance";
    const hours = Number.parseInt(c.req.query("hours") ?? "1", 10);

    if (!orderBookService) {
      return c.json(
        { success: false, error: "Order book service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const snapshots = await orderBookService.getHistoricalSnapshots(
        symbol,
        exchange,
        hours
      );

      return c.json(
        createSuccessResponse({
          symbol,
          exchange,
          hours,
          count: snapshots.length,
          snapshots: snapshots.map((s) => ({
            timestamp: s.timestamp,
            spread: s.spread,
            spreadPercent: s.spreadPercent,
            bidDepth1Pct: s.bidDepth1Pct,
            askDepth1Pct: s.askDepth1Pct,
            bidAskImbalance: s.bidAskImbalance,
          })),
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

  /**
   * GET /api/market-data/orderbook/status - Get order book collector status
   */
  app.get("/api/market-data/orderbook/status", (c) => {
    if (!orderBookCollector) {
      return c.json(
        { success: false, error: "Order book collector not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    const status = orderBookCollector.getStatus();
    return c.json(createSuccessResponse(status));
  });

  /**
   * POST /api/market-data/:symbol/orderbook/collect - Manually trigger collection
   */
  app.post("/api/market-data/:symbol/orderbook/collect", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const exchange = c.req.query("exchange")?.toLowerCase() ?? "binance";

    if (!orderBookService) {
      return c.json(
        { success: false, error: "Order book service not initialized" },
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    try {
      const snapshot = await orderBookService.getOrderBook(symbol, exchange);
      await orderBookService.saveSnapshot(snapshot);
      const analysis = orderBookService.analyzeSnapshot(snapshot);

      return c.json(
        createSuccessResponse({
          message: "Order book collected successfully",
          snapshot,
          analysis,
        })
      );
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: errorAny.message ?? "Failed to collect order book",
        },
        HTTP_STATUS.INTERNAL_ERROR
      );
    }
  });
}
