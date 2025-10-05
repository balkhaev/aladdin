/**
 * Quotes and Prices Routes
 */

import type { CacheService } from "@aladdin/shared/cache";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import {
  getAggregatedQuerySchema,
  getArbitrageQuerySchema,
} from "@aladdin/shared/schemas/market-data";
import type { Hono } from "hono";
import { CACHE_TTL, LIMITS } from "../config";
import type { MarketDataServiceWrapper } from "../services/market-data-wrapper";

export function setupQuotesRoutes(
  app: Hono,
  service: MarketDataServiceWrapper,
  cache?: CacheService
): void {
  /**
   * GET /api/market-data/quote/:symbol - Get quote
   */
  app.get("/api/market-data/quote/:symbol", (c) => {
    const symbol = c.req.param("symbol").toUpperCase();
    const quote = service.getQuote(symbol);

    if (!quote) {
      return c.json(
        {
          success: false,
          error: {
            code: "QUOTE_NOT_FOUND",
            message: `Quote not found for ${symbol}`,
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.NOT_FOUND
      );
    }

    return c.json(createSuccessResponse(quote));
  });

  /**
   * GET /api/market-data/aggregated/:symbol - Get aggregated price
   */
  app.get("/api/market-data/aggregated/:symbol", async (c) => {
    const { symbol } = c.req.param();
    const query = getAggregatedQuerySchema.parse({
      limit: c.req.query("limit") ?? LIMITS.DEFAULT_LIMIT,
    });
    const upperSymbol = symbol.toUpperCase();

    // Try cache first
    if (cache) {
      const cacheKey = `aggregated:${upperSymbol}:${query.limit}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json(createSuccessResponse(cached));
      }
    }

    const prices = await service.getAggregatedPrices(
      [upperSymbol],
      query.limit
    );

    if (prices.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "NO_DATA",
            message: `No aggregated data found for ${symbol}`,
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.NOT_FOUND
      );
    }

    // Cache for configured TTL
    if (cache) {
      const cacheKey = `aggregated:${upperSymbol}:${query.limit}`;
      await cache.set(cacheKey, prices[0], CACHE_TTL.SHORT);
    }

    return c.json(createSuccessResponse(prices[0]));
  });

  /**
   * GET /api/market-data/comparison/:symbol - Get price comparison
   */
  app.get("/api/market-data/comparison/:symbol", async (c) => {
    const { symbol } = c.req.param();
    const upperSymbol = symbol.toUpperCase();

    // Try cache first
    if (cache) {
      const cacheKey = `comparison:${upperSymbol}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json(createSuccessResponse(cached));
      }
    }

    const prices = await service.getAggregatedPrices(
      [upperSymbol],
      LIMITS.DEFAULT_LIMIT
    );

    if (prices.length === 0) {
      return c.json(
        {
          success: false,
          error: {
            code: "NO_DATA",
            message: `No data found for ${symbol}`,
          },
          timestamp: Date.now(),
        },
        HTTP_STATUS.NOT_FOUND
      );
    }

    const price = prices[0];

    const result = {
      symbol: price.symbol,
      exchanges: {
        binance: {
          price: price.binance_price,
          volume: price.binance_volume,
          available: price.binance_price !== null,
        },
        bybit: {
          price: price.bybit_price,
          volume: price.bybit_volume,
          available: price.bybit_price !== null,
        },
        okx: {
          price: price.okx_price,
          volume: price.okx_volume,
          available: price.okx_price !== null,
        },
      },
      aggregated: {
        vwap: price.vwap,
        avgPrice: price.avg_price,
        totalVolume: price.total_volume,
      },
      spread: {
        percent: price.max_spread_percent,
        highExchange: price.max_spread_exchange_high,
        lowExchange: price.max_spread_exchange_low,
      },
      timestamp: price.timestamp,
    };

    // Cache for configured TTL
    if (cache) {
      const cacheKey = `comparison:${upperSymbol}`;
      await cache.set(cacheKey, result, CACHE_TTL.SHORT);
    }

    return c.json(createSuccessResponse(result));
  });

  /**
   * GET /api/market-data/arbitrage - Get arbitrage opportunities
   */
  app.get("/api/market-data/arbitrage", async (c) => {
    const query = getArbitrageQuerySchema.parse({
      minSpread: c.req.query("minSpread") ?? "0.1",
      limit: c.req.query("limit") ?? String(LIMITS.DEFAULT_ARBIT_LIMIT_QUERY),
    });

    // Try cache first
    if (cache) {
      const cacheKey = `arbitrage:${query.minSpread}:${query.limit}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json(createSuccessResponse(cached));
      }
    }

    const opportunities = await service.getArbitrageOpportunities(
      query.minSpread,
      query.limit
    );

    // Cache for 10 seconds (arbitrage changes frequently)
    if (cache) {
      const cacheKey = `arbitrage:${query.minSpread}:${query.limit}`;
      await cache.set(cacheKey, opportunities, 10);
    }

    return c.json(createSuccessResponse(opportunities));
  });
}
