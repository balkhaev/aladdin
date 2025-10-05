import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import { CorrelationAnalysisService } from "./correlation-analysis";

// Constants for tests
const MOCK_DATA_LENGTH = 30;
const ROLLING_WINDOW_DAYS = 7;
const TEST_YEAR = 2025;
const TEST_MONTH = 9; // October (0-indexed)

// Mock dependencies
const createMockLogger = (): Logger => ({
  info: mock(() => {
    // Mock implementation
  }),
  error: mock(() => {
    // Mock implementation
  }),
  warn: mock(() => {
    // Mock implementation
  }),
  debug: mock(() => {
    // Mock implementation
  }),
});

const createMockClickHouse = (): ClickHouseClient => ({
  query: mock(() => {
    // Mock implementation - will be overridden in tests
    return Promise.resolve([]);
  }),
  insert: mock(() => {
    // Mock implementation
    return Promise.resolve();
  }),
  ping: mock(() => Promise.resolve(true)),
  close: mock(() => {
    // Mock implementation
    return Promise.resolve();
  }),
});

describe("CorrelationAnalysisService", () => {
  let service: CorrelationAnalysisService;
  let mockClickHouse: ClickHouseClient;
  let mockLogger: Logger;

  beforeEach(() => {
    mockClickHouse = createMockClickHouse();
    mockLogger = createMockLogger();
    service = new CorrelationAnalysisService(mockClickHouse, mockLogger);
  });

  describe("calculateCorrelationMatrix", () => {
    test("should handle zero values in price data without division by zero error", async () => {
      // Mock data with zero values
      mockClickHouse.query = mock(async () => [
        { date: "2025-10-01", close: "100", return: "0" },
        { date: "2025-10-02", close: "110", return: "0.1" },
        { date: "2025-10-03", close: "105", return: "-0.045" },
      ]);

      const result = await service.calculateCorrelationMatrix({
        symbols: ["BTCUSDT", "ETHUSDT"],
        window: "7d",
      });

      expect(result).toBeDefined();
      expect(result.symbols).toEqual(["BTCUSDT", "ETHUSDT"]);
      expect(result.matrix).toBeDefined();
      expect(mockClickHouse.query).toHaveBeenCalled();
    });

    test("should handle NULL returns from lag function", async () => {
      // Mock data where first row has NULL return (due to lag)
      mockClickHouse.query = mock(async () => [
        { date: "2025-10-02", close: "110", return: "0.1" },
        { date: "2025-10-03", close: "105", return: "-0.045" },
        { date: "2025-10-04", close: "115", return: "0.095" },
      ]);

      const result = await service.calculateCorrelationMatrix({
        symbols: ["BTCUSDT"],
        window: "7d",
      });

      expect(result).toBeDefined();
      expect(result.symbols).toEqual(["BTCUSDT"]);
      expect(mockClickHouse.query).toHaveBeenCalled();
    });

    test("should throw error for portfolio with less than 2 positions", async () => {
      mockClickHouse.query = mock(async () => [
        { positions: JSON.stringify([{ symbol: "BTCUSDT", quantity: 1 }]) },
      ]);

      await expect(
        service.getPortfolioCorrelations({
          portfolioId: "test-portfolio",
          window: "30d",
        })
      ).rejects.toThrow(
        "Portfolio must have at least 2 positions for correlation analysis"
      );
    });

    test("should calculate correlation matrix correctly", async () => {
      // Mock returns data for multiple symbols
      mockClickHouse.query = mock((query: string) => {
        if (query.includes("portfolio_snapshots")) {
          // Mock portfolio query
          return Promise.resolve([
            {
              positions: JSON.stringify([
                { symbol: "BTCUSDT", quantity: 1 },
                { symbol: "ETHUSDT", quantity: 10 },
              ]),
            },
          ]);
        }
        // Mock returns query
        return Promise.resolve([
          { date: "2025-10-01", close: "100", return: "0.05" },
          { date: "2025-10-02", close: "105", return: "0.03" },
          { date: "2025-10-03", close: "108", return: "0.02" },
        ]);
      });

      const result = await service.getPortfolioCorrelations({
        portfolioId: "test-portfolio",
        window: "30d",
      });

      expect(result).toBeDefined();
      expect(result.symbols.length).toBe(2);
      expect(result.matrix.length).toBe(2);
      expect(result.matrix[0].length).toBe(2);

      // Self-correlation should be 1
      expect(result.matrix[0][0]).toBe(1);
      expect(result.matrix[1][1]).toBe(1);
    });
  });

  describe("calculateRollingCorrelation", () => {
    test("should handle insufficient data gracefully", async () => {
      mockClickHouse.query = mock(async () => [
        { timestamp: "2025-10-01", return: "0.05" },
      ]);

      const result = await service.calculateRollingCorrelation({
        symbol1: "BTCUSDT",
        symbol2: "ETHUSDT",
        window: MOCK_DATA_LENGTH,
        rollingWindow: ROLLING_WINDOW_DAYS,
      });

      // Should return empty array when insufficient data
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    test("should calculate rolling correlation with valid data", async () => {
      const RANDOM_MULTIPLIER = 0.1;
      const RANDOM_OFFSET = 0.05;
      const DAY_OFFSET = 1;

      const mockData = Array.from({ length: MOCK_DATA_LENGTH }, (_, i) => ({
        timestamp: new Date(TEST_YEAR, TEST_MONTH, i + DAY_OFFSET),
        return: Math.random() * RANDOM_MULTIPLIER - RANDOM_OFFSET,
      }));

      mockClickHouse.query = mock(async () => mockData);

      const result = await service.calculateRollingCorrelation({
        symbol1: "BTCUSDT",
        symbol2: "ETHUSDT",
        window: 30,
        rollingWindow: 7,
      });

      expect(result.length).toBeGreaterThan(0);
      for (const point of result) {
        expect(point).toHaveProperty("timestamp");
        expect(point).toHaveProperty("correlation");
        expect(typeof point.correlation).toBe("number");
        expect(Number.isFinite(point.correlation)).toBe(true);
      }
    });
  });
});
