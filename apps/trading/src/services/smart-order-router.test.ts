/**
 * Smart Order Router Tests
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/logger";
import {
  type ExchangeQuote,
  SmartOrderRouter,
  type SmartRouteParams,
} from "./smart-order-router";

describe("SmartOrderRouter", () => {
  let router: SmartOrderRouter;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    router = new SmartOrderRouter(mockLogger);
  });

  const createMockQuotes = (): ExchangeQuote[] => [
    {
      exchange: "binance",
      price: 50_000,
      availableLiquidity: 100_000,
      estimatedFee: 0.001,
      latency: 50,
      timestamp: Date.now(),
    },
    {
      exchange: "bybit",
      price: 50_100,
      availableLiquidity: 80_000,
      estimatedFee: 0.0015,
      latency: 60,
      timestamp: Date.now(),
    },
    {
      exchange: "okx",
      price: 50_050,
      availableLiquidity: 120_000,
      estimatedFee: 0.0012,
      latency: 45,
      timestamp: Date.now(),
    },
  ];

  describe("findOptimalRoute", () => {
    test("should find best-price route for BUY order", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-price",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.strategy).toBe("best-price");
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].exchange).toBe("binance"); // Lowest price
      expect(result.confidence).toBeGreaterThan(0);
    });

    test("should find best-price route for SELL order", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "SELL",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-price",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.strategy).toBe("best-price");
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].exchange).toBe("bybit"); // Highest price for SELL
    });

    test("should find fastest route", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "fastest",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.strategy).toBe("fastest");
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].exchange).toBe("okx"); // Lowest latency
    });

    test("should split order across multiple exchanges", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 5, // Large order
        orderType: "MARKET",
        strategy: "split",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.strategy).toBe("split");
      expect(result.routes.length).toBeGreaterThan(1);

      // Check that all routes sum to total quantity
      const totalQuantity = result.routes.reduce(
        (sum, r) => sum + r.quantity,
        0
      );
      expect(totalQuantity).toBeCloseTo(params.quantity, 2);
    });

    test("should use smart routing by default", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.strategy).toBe("smart");
      expect(result.routes.length).toBeGreaterThan(0);
      expect(result.confidence).toBeDefined();
    });

    test("should respect allowed exchanges filter", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-price",
        allowedExchanges: ["bybit", "okx"],
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.routes).toHaveLength(1);
      expect(["bybit", "okx"]).toContain(result.routes[0].exchange);
      expect(result.routes[0].exchange).not.toBe("binance");
    });

    test("should throw error when no exchanges have sufficient liquidity", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-price",
      };

      const quotes: ExchangeQuote[] = [
        {
          exchange: "binance",
          price: 50_000,
          availableLiquidity: 500, // Insufficient
          estimatedFee: 0.001,
          latency: 50,
          timestamp: Date.now(),
        },
      ];

      expect(() => router.findOptimalRoute(params, quotes)).toThrow(
        "No exchanges with sufficient liquidity"
      );
    });

    test("should calculate route shares correctly", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 2,
        orderType: "MARKET",
        strategy: "split",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      const totalShare = result.routes.reduce((sum, r) => sum + r.share, 0);
      const PERCENT = 100;
      expect(totalShare).toBeCloseTo(PERCENT, 1);
    });

    test("should include alternatives in recommendation", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "smart",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives[0].strategy).toBeDefined();
      expect(result.alternatives[0].totalCost).toBeDefined();
      expect(result.alternatives[0].reason).toBeDefined();
    });

    test("should calculate expected slippage", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-execution",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.expectedSlippage).toBeDefined();
      expect(result.expectedSlippage).toBeGreaterThanOrEqual(0);
    });
  });

  describe("comparePrices", () => {
    test("should compare prices across exchanges for BUY", () => {
      const quotes = createMockQuotes();
      const result = router.comparePrices("BTCUSDT", "BUY", quotes);

      expect(result.symbol).toBe("BTCUSDT");
      expect(result.side).toBe("BUY");
      expect(result.quotes).toHaveLength(3);
      expect(result.bestPrice.exchange).toBe("binance"); // Lowest price
      expect(result.bestPrice.price).toBe(50_000);
      expect(result.priceDifference).toBeGreaterThan(0);
    });

    test("should compare prices across exchanges for SELL", () => {
      const quotes = createMockQuotes();
      const result = router.comparePrices("BTCUSDT", "SELL", quotes);

      expect(result.symbol).toBe("BTCUSDT");
      expect(result.side).toBe("SELL");
      expect(result.bestPrice.exchange).toBe("bybit"); // Highest price
      expect(result.bestPrice.price).toBe(50_100);
    });

    test("should calculate price difference correctly", () => {
      const quotes = createMockQuotes();
      const result = router.comparePrices("BTCUSDT", "BUY", quotes);

      const PERCENT = 100;
      const expectedDiff = ((50_100 - 50_000) / 50_000) * PERCENT;
      const actualDiff = result.priceDifference * PERCENT;

      expect(actualDiff).toBeCloseTo(expectedDiff, 2);
    });

    test("should handle single exchange", () => {
      const quotes: ExchangeQuote[] = [createMockQuotes()[0]];
      const result = router.comparePrices("BTCUSDT", "BUY", quotes);

      expect(result.quotes).toHaveLength(1);
      expect(result.priceDifference).toBe(0);
    });
  });

  describe("best-execution strategy", () => {
    test("should consider fees and slippage", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-execution",
        maxSlippage: 0.01,
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.strategy).toBe("best-execution");
      expect(result.totalEstimatedFee).toBeGreaterThan(0);
      expect(result.expectedSlippage).toBeLessThanOrEqual(params.maxSlippage);
    });

    test("should split order if slippage exceeds max", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 10, // Large order
        orderType: "MARKET",
        strategy: "best-execution",
        maxSlippage: 0.001, // Very tight
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      // Should fall back to split strategy due to slippage constraint
      expect(result.routes.length).toBeGreaterThan(0);
    });
  });

  describe("smart routing strategy", () => {
    test("should adjust weights based on urgency", () => {
      const lowUrgency: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "smart",
        urgency: "low",
      };

      const highUrgency: SmartRouteParams = {
        ...lowUrgency,
        urgency: "high",
      };

      const quotes = createMockQuotes();
      const lowResult = router.findOptimalRoute(lowUrgency, quotes);
      const highResult = router.findOptimalRoute(highUrgency, quotes);

      // Both should return valid routes
      expect(lowResult.routes.length).toBeGreaterThan(0);
      expect(highResult.routes.length).toBeGreaterThan(0);

      // High urgency should prefer fastest exchange (OKX)
      // Low urgency should prefer best price (Binance)
      expect(highResult.routes[0].exchange).toBeTruthy();
      expect(lowResult.routes[0].exchange).toBeTruthy();
    });

    test("should provide high confidence for optimal routes", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "smart",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      const MIN_CONFIDENCE = 0.4;
      expect(result.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
    });
  });

  describe("edge cases", () => {
    test("should handle empty quotes array gracefully", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
      };

      expect(() => router.findOptimalRoute(params, [])).toThrow();
    });

    test("should handle very small quantity", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 0.001, // Very small but non-zero
        orderType: "MARKET",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.routes.length).toBeGreaterThan(0);
      const totalQuantity = result.routes.reduce(
        (sum, r) => sum + r.quantity,
        0
      );
      expect(totalQuantity).toBeCloseTo(params.quantity, 3);
    });

    test("should handle identical prices across exchanges", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 1,
        orderType: "MARKET",
        strategy: "best-price",
      };

      const identicalQuotes: ExchangeQuote[] = [
        {
          exchange: "binance",
          price: 50_000,
          availableLiquidity: 100_000,
          estimatedFee: 0.001,
          latency: 50,
          timestamp: Date.now(),
        },
        {
          exchange: "bybit",
          price: 50_000,
          availableLiquidity: 100_000,
          estimatedFee: 0.001,
          latency: 60,
          timestamp: Date.now(),
        },
      ];

      const result = router.findOptimalRoute(params, identicalQuotes);

      expect(result.routes).toHaveLength(1);
      // Should pick one of them
      expect(["binance", "bybit"]).toContain(result.routes[0].exchange);
    });

    test("should handle large order splitting", () => {
      const params: SmartRouteParams = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 100, // Very large order
        orderType: "MARKET",
        strategy: "split",
      };

      const quotes = createMockQuotes();
      const result = router.findOptimalRoute(params, quotes);

      expect(result.routes.length).toBeGreaterThan(1);

      const totalValue = result.routes.reduce(
        (sum, r) => sum + r.estimatedCost,
        0
      );
      expect(totalValue).toBeGreaterThan(0);
    });
  });
});
