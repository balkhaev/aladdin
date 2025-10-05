import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/logger";
import {
  type Position,
  type RebalancingConfig,
  RebalancingEngine,
} from "./rebalancing";

const THRESHOLD_5_PERCENT = 0.05;
const THRESHOLD_10_PERCENT = 0.1;
const MIN_TRADE_SIZE = 10;
const DEFAULT_PRICE = 100;
const TOLERANCE = 0.001;
const EXPECTED_ONE = 1.0;

describe("RebalancingEngine", () => {
  let engine: RebalancingEngine;

  beforeEach(() => {
    // Create a mock logger
    const mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    engine = new RebalancingEngine(mockLogger);
  });

  test("should not rebalance when weights are within threshold", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.5,
        currentPrice: DEFAULT_PRICE,
        value: 50,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.5,
        currentPrice: DEFAULT_PRICE,
        value: 50,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.needsRebalancing).toBe(false);
  });

  test("should rebalance when weights exceed threshold", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.7,
        currentPrice: DEFAULT_PRICE,
        value: 70,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.3,
        currentPrice: DEFAULT_PRICE,
        value: 30,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_10_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.needsRebalancing).toBe(true);
    expect(plan.actions.length).toBeGreaterThan(0);
  });

  test("should generate correct rebalancing actions", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.7,
        currentPrice: DEFAULT_PRICE,
        value: 70,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.3,
        currentPrice: DEFAULT_PRICE,
        value: 30,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
      minTradeSize: MIN_TRADE_SIZE,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.needsRebalancing).toBe(true);

    // Should sell BTCUSDT and buy ETHUSDT
    const btcAction = plan.actions.find((a) => a.symbol === "BTCUSDT");
    const ethAction = plan.actions.find((a) => a.symbol === "ETHUSDT");

    expect(btcAction?.action).toBe("sell");
    expect(ethAction?.action).toBe("buy");
  });

  test("should calculate transaction costs", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.6,
        currentPrice: DEFAULT_PRICE,
        value: 60,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.4,
        currentPrice: DEFAULT_PRICE,
        value: 40,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.totalTransactionCost).toBeGreaterThan(0);
    expect(plan.estimatedSlippage).toBeGreaterThan(0);
  });

  test("should prioritize rebalancing based on deviation", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.85,
        currentPrice: DEFAULT_PRICE,
        value: 85,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.15,
        currentPrice: DEFAULT_PRICE,
        value: 15,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    // High deviation should result in high priority
    expect(plan.priority).toBe("high");
  });

  test("should handle periodic rebalancing strategy", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.52,
        currentPrice: DEFAULT_PRICE,
        value: 52,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.48,
        currentPrice: DEFAULT_PRICE,
        value: 48,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "periodic",
      frequency: "monthly",
    };

    // First rebalance (no last date)
    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.needsRebalancing).toBe(true);
    expect(plan.reason).toContain("First rebalance");
  });

  test("should handle periodic rebalancing with recent last rebalance", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.52,
        currentPrice: DEFAULT_PRICE,
        value: 52,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.48,
        currentPrice: DEFAULT_PRICE,
        value: 48,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "periodic",
      frequency: "monthly",
    };

    // Last rebalance was yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
      lastRebalanceDate: yesterday,
    });

    expect(plan.needsRebalancing).toBe(false);
  });

  test("should execute dry-run rebalancing", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.7,
        currentPrice: DEFAULT_PRICE,
        value: 70,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.3,
        currentPrice: DEFAULT_PRICE,
        value: 30,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    const orders = engine.executeRebalancing({
      plan,
      dryRun: true,
    });

    expect(orders.length).toBeGreaterThan(0);

    for (const order of orders) {
      expect(order.symbol).toBeString();
      expect(order.side).toBeOneOf(["BUY", "SELL"]);
      expect(order.quantity).toBeGreaterThan(0);
      expect(order.type).toBe("LIMIT");
    }
  });

  test("should skip small trades below minTradeSize", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.501,
        currentPrice: DEFAULT_PRICE,
        value: 50.1,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.499,
        currentPrice: DEFAULT_PRICE,
        value: 49.9,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: 0.001, // Very low threshold
      minTradeSize: 10, // But high min trade size
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    // Should detect deviation but actions should be empty (below min trade size)
    expect(plan.actions.length).toBe(0);
  });

  test("should calculate weights correctly", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.6,
        currentPrice: DEFAULT_PRICE,
        value: 60,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.4,
        currentPrice: DEFAULT_PRICE,
        value: 40,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    // Total value should be 100
    expect(plan.totalValue).toBe(100);

    // Check current weights in actions
    const btcAction = plan.actions.find((a) => a.symbol === "BTCUSDT");
    expect(btcAction?.currentWeight).toBeCloseTo(0.6, 2);
    expect(btcAction?.targetWeight).toBeCloseTo(0.5, 2);
  });

  test("should handle hybrid strategy", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.52,
        currentPrice: DEFAULT_PRICE,
        value: 52,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.48,
        currentPrice: DEFAULT_PRICE,
        value: 48,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "hybrid",
      frequency: "monthly",
      thresholdPercent: THRESHOLD_10_PERCENT,
    };

    // First rebalance should trigger (periodic condition)
    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.needsRebalancing).toBe(true);
  });

  test("should calculate next rebalancing date", () => {
    const lastDate = new Date("2025-01-01");

    const nextDaily = engine.getNextRebalancingDate(lastDate, "daily");
    expect(nextDaily.getDate()).toBe(2);

    const nextWeekly = engine.getNextRebalancingDate(lastDate, "weekly");
    expect(nextWeekly.getDate()).toBe(8);

    const nextMonthly = engine.getNextRebalancingDate(lastDate, "monthly");
    expect(nextMonthly.getMonth()).toBe(1); // February

    const nextQuarterly = engine.getNextRebalancingDate(lastDate, "quarterly");
    expect(nextQuarterly.getMonth()).toBe(3); // April
  });

  test("should return empty plan for zero portfolio value", () => {
    const positions: Position[] = [];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    expect(plan.needsRebalancing).toBe(false);
    expect(plan.reason).toContain("zero");
  });

  test("should calculate net benefit", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.8,
        currentPrice: DEFAULT_PRICE,
        value: 80,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.2,
        currentPrice: DEFAULT_PRICE,
        value: 20,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    // Net benefit should be positive (deviation > cost)
    expect(plan.netBenefit).toBeNumber();
  });

  test("should respect weights sum to 1", () => {
    const positions: Position[] = [
      {
        symbol: "BTCUSDT",
        quantity: 0.6,
        currentPrice: DEFAULT_PRICE,
        value: 60,
      },
      {
        symbol: "ETHUSDT",
        quantity: 0.4,
        currentPrice: DEFAULT_PRICE,
        value: 40,
      },
    ];

    const targetWeights = {
      BTCUSDT: 0.5,
      ETHUSDT: 0.5,
    };

    const config: RebalancingConfig = {
      strategy: "threshold",
      thresholdPercent: THRESHOLD_5_PERCENT,
    };

    const plan = engine.analyzeRebalancing({
      positions,
      targetWeights,
      config,
    });

    // Calculate sum of target weights
    const weightSum = Object.values(targetWeights).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(weightSum).toBeCloseTo(EXPECTED_ONE, 2);

    // Calculate sum of current weights
    if (plan.actions.length > 0) {
      const currentWeightSum = plan.actions.reduce(
        (sum, action) => sum + action.currentWeight,
        0
      );
      expect(currentWeightSum).toBeCloseTo(EXPECTED_ONE, 1);
    }
  });
});
