import { describe, expect, test } from "bun:test";
import {
  cancelOrderSchema,
  createOrderSchema,
  getOrdersQuerySchema,
} from "./schemas";

describe("Trading Validation Schemas", () => {
  describe("createOrderSchema", () => {
    test("should validate a valid MARKET BUY order", () => {
      const validOrder = {
        symbol: "btcusdt",
        side: "BUY",
        type: "MARKET",
        quantity: 0.01,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbol).toBe("BTCUSDT"); // should be transformed to uppercase
        expect(result.data.exchange).toBe("binance");
      }
    });

    test("should validate a valid LIMIT SELL order with price", () => {
      const validOrder = {
        symbol: "ETHUSDT",
        side: "SELL",
        type: "LIMIT",
        quantity: 1.5,
        price: 2500.0,
        exchange: "bybit",
      };

      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(2500.0);
        expect(result.data.exchange).toBe("bybit");
      }
    });

    test("should validate a STOP_LOSS order with stopPrice", () => {
      const validOrder = {
        symbol: "BTCUSDT",
        side: "SELL",
        type: "STOP_LOSS",
        quantity: 0.5,
        stopPrice: 30_000.0,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopPrice).toBe(30_000.0);
      }
    });

    test("should validate a TAKE_PROFIT order with stopPrice", () => {
      const validOrder = {
        symbol: "ETHUSDT",
        side: "SELL",
        type: "TAKE_PROFIT",
        quantity: 2.0,
        stopPrice: 3000.0,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stopPrice).toBe(3000.0);
      }
    });

    test("should reject LIMIT order without price", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: 0.01,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "LIMIT orders must include a price"
        );
      }
    });

    test("should reject STOP_LOSS order without stopPrice", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "SELL",
        type: "STOP_LOSS",
        quantity: 0.5,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "STOP_LOSS and TAKE_PROFIT orders must include a stopPrice"
        );
      }
    });

    test("should reject TAKE_PROFIT order without stopPrice", () => {
      const invalidOrder = {
        symbol: "ETHUSDT",
        side: "BUY",
        type: "TAKE_PROFIT",
        quantity: 1.0,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          "TAKE_PROFIT orders must include a stopPrice"
        );
      }
    });

    test("should reject order with invalid symbol (too short)", () => {
      const invalidOrder = {
        symbol: "BT",
        side: "BUY",
        type: "MARKET",
        quantity: 0.01,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should reject order with zero quantity", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: 0,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should reject order with negative quantity", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: -0.5,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should reject order with negative price", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: 0.01,
        price: -100,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should reject order with invalid side", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "INVALID",
        type: "MARKET",
        quantity: 0.01,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should reject order with invalid type", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "INVALID_TYPE",
        quantity: 0.01,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should reject order with unsupported exchange", () => {
      const invalidOrder = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: 0.01,
        exchange: "kraken",
      };

      const result = createOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    test("should default to binance exchange if not provided", () => {
      const order = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: 0.01,
      };

      const result = createOrderSchema.safeParse(order);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exchange).toBe("binance");
      }
    });

    test("should accept portfolioId as optional CUID", () => {
      const order = {
        portfolioId: "cljn3q8zy0000356lhk3h5z9k",
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: 0.01,
        exchange: "binance",
      };

      const result = createOrderSchema.safeParse(order);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.portfolioId).toBe("cljn3q8zy0000356lhk3h5z9k");
      }
    });
  });

  describe("cancelOrderSchema", () => {
    test("should validate valid orderId", () => {
      const params = {
        orderId: "cljn3q8zy0000356lhk3h5z9k",
      };

      const result = cancelOrderSchema.safeParse(params);
      expect(result.success).toBe(true);
    });

    test("should reject invalid orderId format", () => {
      const params = {
        orderId: "invalid-id",
      };

      const result = cancelOrderSchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    test("should reject empty orderId", () => {
      const params = {
        orderId: "",
      };

      const result = cancelOrderSchema.safeParse(params);
      expect(result.success).toBe(false);
    });
  });

  describe("getOrdersQuerySchema", () => {
    test("should validate query with all parameters", () => {
      const query = {
        symbol: "BTCUSDT",
        status: "OPEN",
        exchange: "binance",
        limit: "20",
        offset: "10",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20); // should be coerced to number
        expect(result.data.offset).toBe(10);
        expect(result.data.status).toBe("OPEN");
      }
    });

    test("should use default values when not provided", () => {
      const query = {
        exchange: "binance",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50); // default
        expect(result.data.offset).toBe(0); // default
      }
    });

    test("should reject limit > 1000", () => {
      const query = {
        exchange: "binance",
        limit: "1500",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should reject negative limit", () => {
      const query = {
        exchange: "binance",
        limit: "-10",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should reject negative offset", () => {
      const query = {
        exchange: "binance",
        offset: "-5",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should validate all valid order statuses", () => {
      const statuses = [
        "PENDING",
        "OPEN",
        "PARTIALLY_FILLED",
        "FILLED",
        "CANCELLED",
        "REJECTED",
        "EXPIRED",
      ];

      for (const status of statuses) {
        const query = {
          exchange: "binance",
          status,
        };

        const result = getOrdersQuerySchema.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe(status);
        }
      }
    });

    test("should reject invalid status", () => {
      const query = {
        exchange: "binance",
        status: "INVALID_STATUS",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should transform symbol to uppercase", () => {
      const query = {
        exchange: "binance",
        symbol: "btcusdt",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbol).toBe("BTCUSDT");
      }
    });

    test("should use default exchange if not provided", () => {
      const query = {
        symbol: "BTCUSDT",
      };

      const result = getOrdersQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exchange).toBe("binance"); // default
      }
    });
  });
});
