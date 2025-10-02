import { describe, expect, test } from "bun:test";
import {
  getBalancesQuerySchema,
  getPortfoliosQuerySchema,
  getPositionsQuerySchema,
} from "./schemas";

describe("Portfolio Validation Schemas", () => {
  describe("getPortfoliosQuerySchema", () => {
    test("should validate query with all parameters", () => {
      const query = {
        includeBalances: true,
        includePositions: true,
      };

      const result = getPortfoliosQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeBalances).toBe(true);
        expect(result.data.includePositions).toBe(true);
      }
    });

    test("should use default values when not provided", () => {
      const query = {};

      const result = getPortfoliosQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeBalances).toBe(false); // default
        expect(result.data.includePositions).toBe(false); // default
      }
    });

    test("should validate query with only includeBalances", () => {
      const query = {
        includeBalances: true,
      };

      const result = getPortfoliosQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeBalances).toBe(true);
        expect(result.data.includePositions).toBe(false);
      }
    });

    test("should validate query with only includePositions", () => {
      const query = {
        includePositions: true,
      };

      const result = getPortfoliosQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeBalances).toBe(false);
        expect(result.data.includePositions).toBe(true);
      }
    });

    test("should reject query with invalid types", () => {
      const query = {
        includeBalances: "true", // should be boolean
        includePositions: "false", // should be boolean
      };

      const result = getPortfoliosQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should reject query with extra fields", () => {
      const query = {
        includeBalances: true,
        includePositions: true,
        extraField: "not allowed",
      };

      const result = getPortfoliosQuerySchema.safeParse(query);
      expect(result.success).toBe(false); // strict mode
    });
  });

  describe("getBalancesQuerySchema", () => {
    test("should validate query with portfolioId", () => {
      const query = {
        portfolioId: "cljn3q8zy0000356lhk3h5z9k",
      };

      const result = getBalancesQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.portfolioId).toBe("cljn3q8zy0000356lhk3h5z9k");
      }
    });

    test("should validate query without portfolioId", () => {
      const query = {};

      const result = getBalancesQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.portfolioId).toBeUndefined();
      }
    });

    test("should reject invalid portfolioId format", () => {
      const query = {
        portfolioId: "invalid-id",
      };

      const result = getBalancesQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should reject empty portfolioId", () => {
      const query = {
        portfolioId: "",
      };

      const result = getBalancesQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe("getPositionsQuerySchema", () => {
    test("should validate query with all parameters", () => {
      const query = {
        portfolioId: "cljn3q8zy0000356lhk3h5z9k",
        symbol: "BTCUSDT",
      };

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.portfolioId).toBe("cljn3q8zy0000356lhk3h5z9k");
        expect(result.data.symbol).toBe("BTCUSDT");
      }
    });

    test("should validate query without parameters", () => {
      const query = {};

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    test("should validate query with only portfolioId", () => {
      const query = {
        portfolioId: "cljn3q8zy0000356lhk3h5z9k",
      };

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
    });

    test("should validate query with only symbol", () => {
      const query = {
        symbol: "ETHUSDT",
      };

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbol).toBe("ETHUSDT");
      }
    });

    test("should reject invalid portfolioId format", () => {
      const query = {
        portfolioId: "invalid-id",
        symbol: "BTCUSDT",
      };

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should reject empty symbol", () => {
      const query = {
        symbol: "",
      };

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });

    test("should reject symbol too long", () => {
      const query = {
        symbol: "A".repeat(21),
      };

      const result = getPositionsQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });
});
