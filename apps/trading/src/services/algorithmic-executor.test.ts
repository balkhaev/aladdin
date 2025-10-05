/**
 * Algorithmic Executor Tests
 *
 * Test suite for VWAP, TWAP, and Iceberg execution strategies
 */

import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/logger";
import { AlgorithmicExecutor } from "./algorithmic-executor";

// Mock logger for tests
const createMockLogger = (): Logger => ({
  debug: () => {
    // Empty mock implementation
  },
  info: () => {
    // Empty mock implementation
  },
  warn: () => {
    // Empty mock implementation
  },
  error: () => {
    // Empty mock implementation
  },
  http: () => {
    // Empty mock implementation
  },
  nats: () => {
    // Empty mock implementation
  },
  db: () => {
    // Empty mock implementation
  },
});

// Test constants
const ONE_HOUR_SECONDS = 3600;
const TEN_MINUTES_SECONDS = 600;
const FIVE_MINUTES_SECONDS = 300;
const THIRTY_MINUTES_SECONDS = 1800;
const SIXTY_SECONDS = 60;
const ONE_HUNDRED_SECONDS = 100;
const ONE_THOUSAND_SECONDS = 1000;
const MILLISECONDS_TO_SECONDS = 1000;
const TEST_PRECISION = 5;
const TEST_PRECISION_LOW = 1;
const TEST_PRECISION_ZERO = 0;
const CLOSE_TO_PRECISION = 100;
const HALF_THRESHOLD = 0.5;
const POINT_SIX_COMPLETION = 0.6;
const NINE_REMAINING = 9;

describe("AlgorithmicExecutor", () => {
  let executor: AlgorithmicExecutor;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    executor = new AlgorithmicExecutor(mockLogger);
  });

  describe("VWAP Strategy", () => {
    test("should calculate VWAP slices based on historical volume profile", () => {
      const params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        totalQuantity: 10,
        duration: ONE_HOUR_SECONDS,
        strategy: "VWAP" as const,
      };

      // Mock historical volume data (hourly buckets)
      const volumeProfile = [
        { hour: 0, volume: 1000 },
        { hour: 1, volume: 1500 },
        { hour: 2, volume: 2000 },
        { hour: 3, volume: 2500 },
      ];

      const schedule = executor.calculateVWAPSchedule(params, volumeProfile);

      // Should have slices proportional to volume
      expect(schedule.slices.length).toBeGreaterThan(0);
      expect(schedule.strategy).toBe("VWAP");

      // Total quantity should match
      const totalScheduled = schedule.slices.reduce(
        (sum, s) => sum + s.quantity,
        0
      );
      expect(totalScheduled).toBeCloseTo(params.totalQuantity, TEST_PRECISION);

      // Higher volume periods should get larger slices
      const volumeWeighted = schedule.slices.map((s, i) => ({
        slice: s,
        volumeRatio: volumeProfile[i % volumeProfile.length].volume,
      }));

      const sortedByVolume = [...volumeWeighted].sort(
        (a, b) => b.volumeRatio - a.volumeRatio
      );
      expect(sortedByVolume.at(0)?.slice.quantity).toBeGreaterThanOrEqual(
        sortedByVolume.at(-1)?.slice.quantity ?? 0
      );
    });

    test("should handle missing volume data gracefully", () => {
      const params = {
        symbol: "ETHUSDT",
        side: "SELL" as const,
        totalQuantity: 5,
        duration: THIRTY_MINUTES_SECONDS,
        strategy: "VWAP" as const,
      };

      const schedule = executor.calculateVWAPSchedule(params, []);

      // Should fall back to TWAP when no volume data
      expect(schedule.slices.length).toBeGreaterThan(0);
      const quantities = schedule.slices.map((s) => s.quantity);
      const avgQuantity =
        quantities.reduce((a, b) => a + b, 0) / quantities.length;

      // All slices should be roughly equal (TWAP behavior)
      for (const q of quantities) {
        expect(q).toBeCloseTo(avgQuantity, TEST_PRECISION_LOW);
      }
    });

    test("should adjust slices to minimize market impact", () => {
      const maxSliceSize = 10;
      const params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        totalQuantity: 100,
        duration: ONE_HOUR_SECONDS,
        strategy: "VWAP" as const,
        maxSliceSize,
      };

      const volumeProfile = [{ hour: 0, volume: 10_000 }];
      const schedule = executor.calculateVWAPSchedule(params, volumeProfile);

      // No slice should exceed maxSliceSize
      for (const slice of schedule.slices) {
        expect(slice.quantity).toBeLessThanOrEqual(params.maxSliceSize);
      }
    });
  });

  describe("TWAP Strategy", () => {
    test("should split order evenly across time intervals", () => {
      const expectedSlices = 10;
      const params = {
        symbol: "ETHUSDT",
        side: "BUY" as const,
        totalQuantity: 20,
        duration: TEN_MINUTES_SECONDS,
        strategy: "TWAP" as const,
        sliceInterval: SIXTY_SECONDS,
      };

      const schedule = executor.calculateTWAPSchedule(params);

      // Should have ~10 slices (600s / 60s)
      expect(schedule.slices.length).toBe(expectedSlices);
      expect(schedule.strategy).toBe("TWAP");

      // Each slice should have equal quantity
      const expectedQuantity = params.totalQuantity / schedule.slices.length;
      for (const slice of schedule.slices) {
        expect(slice.quantity).toBeCloseTo(expectedQuantity, TEST_PRECISION);
      }

      // Slices should be evenly spaced
      for (let i = 1; i < schedule.slices.length; i++) {
        const timeDiff =
          schedule.slices[i].timestamp - schedule.slices[i - 1].timestamp;
        expect(timeDiff).toBeCloseTo(
          params.sliceInterval * MILLISECONDS_TO_SECONDS,
          CLOSE_TO_PRECISION
        );
      }
    });

    test("should handle odd quantity divisions", () => {
      const expectedSlices = 3;
      const params = {
        symbol: "BTCUSDT",
        side: "SELL" as const,
        totalQuantity: 7,
        duration: FIVE_MINUTES_SECONDS,
        strategy: "TWAP" as const,
        sliceInterval: ONE_HUNDRED_SECONDS,
      };

      const schedule = executor.calculateTWAPSchedule(params);

      expect(schedule.slices.length).toBe(expectedSlices);

      // Total should still match
      const total = schedule.slices.reduce((sum, s) => sum + s.quantity, 0);
      expect(total).toBeCloseTo(params.totalQuantity, TEST_PRECISION);
    });

    test("should respect minimum slice size", () => {
      const minSlice = 0.05;
      const params = {
        symbol: "SOLUSDT",
        side: "BUY" as const,
        totalQuantity: 1.0,
        duration: ONE_THOUSAND_SECONDS,
        strategy: "TWAP" as const,
        sliceInterval: ONE_HUNDRED_SECONDS,
        minSliceSize: minSlice,
      };

      const schedule = executor.calculateTWAPSchedule(params);

      // All slices should meet minimum
      for (const slice of schedule.slices) {
        expect(slice.quantity).toBeGreaterThanOrEqual(params.minSliceSize);
      }
    });
  });

  describe("Iceberg Strategy", () => {
    test("should show only visible portion of order", () => {
      const expectedSlices = 10;
      const params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        totalQuantity: 100,
        visibleQuantity: 10,
        strategy: "ICEBERG" as const,
      };

      const schedule = executor.calculateIcebergSchedule(params);

      expect(schedule.strategy).toBe("ICEBERG");
      expect(schedule.slices.length).toBe(expectedSlices);

      // Each slice shows only visible portion
      for (const slice of schedule.slices) {
        expect(slice.quantity).toBe(params.visibleQuantity);
        expect(slice.hidden).toBe(false);
      }
    });

    test("should handle partial fills with hidden quantity", () => {
      const params = {
        symbol: "ETHUSDT",
        side: "SELL" as const,
        totalQuantity: 50,
        visibleQuantity: 5,
        strategy: "ICEBERG" as const,
        refreshThreshold: HALF_THRESHOLD,
      };

      const schedule = executor.calculateIcebergSchedule(params);

      // Verify refresh logic
      expect(schedule.refreshThreshold).toBe(HALF_THRESHOLD);
      expect(schedule.slices.at(0)?.quantity).toBe(params.visibleQuantity);
    });

    test("should randomize slice timing to avoid detection", () => {
      const params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        totalQuantity: 100,
        visibleQuantity: 10,
        strategy: "ICEBERG" as const,
        randomizeInterval: true,
      };

      const schedule = executor.calculateIcebergSchedule(params);

      // Check that intervals are not all identical
      const intervals: number[] = [];
      for (let i = 1; i < schedule.slices.length; i++) {
        intervals.push(
          schedule.slices[i].timestamp - schedule.slices[i - 1].timestamp
        );
      }

      // Not all intervals should be the same
      const uniqueIntervals = new Set(intervals);
      expect(uniqueIntervals.size).toBeGreaterThan(1);
    });
  });

  describe("Execution Monitoring", () => {
    test("should track execution progress", () => {
      const params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        totalQuantity: 10,
        duration: TEN_MINUTES_SECONDS,
        strategy: "TWAP" as const,
      };

      const schedule = executor.calculateTWAPSchedule(params);
      const execution = executor.createExecution(schedule);

      expect(execution.status).toBe("PENDING");
      expect(execution.filled).toBe(0);
      expect(execution.remaining).toBe(params.totalQuantity);

      // Simulate partial fill
      executor.updateExecutionProgress(execution, {
        sliceIndex: 0,
        filled: 1,
      });

      expect(execution.filled).toBe(1);
      expect(execution.remaining).toBe(NINE_REMAINING);
      expect(execution.status).toBe("IN_PROGRESS");
    });

    test("should calculate execution performance metrics", () => {
      const params = {
        symbol: "ETHUSDT",
        side: "BUY" as const,
        totalQuantity: 5,
        duration: FIVE_MINUTES_SECONDS,
        strategy: "VWAP" as const,
      };

      const volumeProfile = [{ hour: 0, volume: 1000 }];
      const schedule = executor.calculateVWAPSchedule(params, volumeProfile);
      const execution = executor.createExecution(schedule);

      const priceOne = 2000;
      const priceTwo = 2010;
      const priceThree = 1990;

      // Simulate fills with prices
      executor.updateExecutionProgress(execution, {
        sliceIndex: 0,
        filled: 1,
        price: priceOne,
      });
      executor.updateExecutionProgress(execution, {
        sliceIndex: 1,
        filled: 1,
        price: priceTwo,
      });
      executor.updateExecutionProgress(execution, {
        sliceIndex: 2,
        filled: 1,
        price: priceThree,
      });

      const metrics = executor.calculateExecutionMetrics(execution, priceOne);

      expect(metrics.averagePrice).toBeCloseTo(priceOne, TEST_PRECISION_ZERO);
      expect(metrics.slippage).toBeDefined();
      expect(metrics.completion).toBeCloseTo(
        POINT_SIX_COMPLETION,
        TEST_PRECISION_LOW
      );
    });

    test("should detect and handle execution failures", () => {
      const failedSliceIndex = 2;
      const params = {
        symbol: "BTCUSDT",
        side: "SELL" as const,
        totalQuantity: 10,
        duration: TEN_MINUTES_SECONDS,
        strategy: "TWAP" as const,
      };

      const schedule = executor.calculateTWAPSchedule(params);
      const execution = executor.createExecution(schedule);

      // Simulate failure
      executor.handleSliceFailure(execution, {
        sliceIndex: failedSliceIndex,
        reason: "Insufficient liquidity",
      });

      expect(execution.failedSlices).toContain(failedSliceIndex);
      expect(execution.status).toBe("IN_PROGRESS");

      // Should still continue with other slices
      const nextSlice = executor.getNextSlice(execution);
      expect(nextSlice).not.toBe(failedSliceIndex);
    });
  });

  describe("Market Condition Adaptation", () => {
    test("should adjust execution speed based on volatility", () => {
      const highVolatility = 0.05;
      const lowVolatility = 0.01;
      const params = {
        symbol: "BTCUSDT",
        side: "BUY" as const,
        totalQuantity: 10,
        duration: TEN_MINUTES_SECONDS,
        strategy: "TWAP" as const,
        adaptToVolatility: true,
      };

      // High volatility scenario
      const highVolSchedule = executor.calculateAdaptiveTWAP(params, {
        volatility: highVolatility,
      });

      // Low volatility scenario
      const lowVolSchedule = executor.calculateAdaptiveTWAP(params, {
        volatility: lowVolatility,
      });

      // High volatility should result in faster execution (fewer, larger slices)
      expect(highVolSchedule.slices.length).toBeLessThan(
        lowVolSchedule.slices.length
      );
    });

    test("should pause execution during extreme market conditions", () => {
      const extremeVolatility = 0.1;
      const wideSpread = 0.05;
      const params = {
        symbol: "ETHUSDT",
        side: "BUY" as const,
        totalQuantity: 5,
        duration: FIVE_MINUTES_SECONDS,
        strategy: "VWAP" as const,
      };

      const schedule = executor.calculateVWAPSchedule(params, [
        { hour: 0, volume: 1000 },
      ]);
      const execution = executor.createExecution(schedule);

      // Simulate extreme conditions
      const shouldPause = executor.shouldPauseExecution(execution, {
        volatility: extremeVolatility,
        spread: wideSpread,
      });

      expect(shouldPause).toBe(true);
    });
  });
});
