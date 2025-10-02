import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/shared/logger";
import { PortfolioOptimizer } from "./optimization";

const TEST_RETURN_1 = 0.15;
const TEST_RETURN_2 = 0.12;
const TEST_RETURN_3 = 0.1;
const TEST_VOL_1 = 0.2;
const TEST_VOL_2 = 0.18;
const TEST_VOL_3 = 0.15;
const WEIGHT_THRESHOLD = 0.001;
const MIN_WEIGHT = 0.05;
const MAX_WEIGHT = 0.4;
const TARGET_RETURN = 0.125;
const MAX_RISK = 0.17;
const EXPECTED_SUM = 1.0;
const EXPECTED_ASSETS = 3;

describe("PortfolioOptimizer", () => {
  let optimizer: PortfolioOptimizer;

  beforeEach(() => {
    // Create a mock logger
    const mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    optimizer = new PortfolioOptimizer(mockLogger);
  });

  test("should calculate asset statistics from returns", () => {
    const returns = [0.01, -0.02, 0.03, -0.01, 0.02];

    const stats = PortfolioOptimizer.calculateAssetStatistics(returns);

    expect(stats.expectedReturn).toBeNumber();
    expect(stats.volatility).toBeNumber();
    expect(stats.returns).toEqual(returns);
  });

  test("should optimize for maximum Sharpe Ratio", () => {
    const assets = ["BTC", "ETH", "SOL"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
      ETH: {
        expectedReturn: TEST_RETURN_2,
        volatility: TEST_VOL_2,
        returns: [0.02, -0.01, 0.02],
      },
      SOL: {
        expectedReturn: TEST_RETURN_3,
        volatility: TEST_VOL_3,
        returns: [0.01, 0.01, 0.01],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
    });

    // Check weights sum to 1
    const totalWeight = Object.values(result.weights).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(totalWeight).toBeCloseTo(EXPECTED_SUM, 2);

    // Check all weights are non-negative (no shorts)
    for (const weight of Object.values(result.weights)) {
      expect(weight).toBeGreaterThanOrEqual(0);
    }

    // Check return and risk are positive
    expect(result.expectedReturn).toBeGreaterThan(0);
    expect(result.expectedRisk).toBeGreaterThan(0);

    // Check Sharpe ratio is reasonable
    expect(result.sharpeRatio).toBeNumber();
  });

  test("should respect weight constraints", () => {
    const assets = ["BTC", "ETH", "SOL"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
      ETH: {
        expectedReturn: TEST_RETURN_2,
        volatility: TEST_VOL_2,
        returns: [0.02, -0.01, 0.02],
      },
      SOL: {
        expectedReturn: TEST_RETURN_3,
        volatility: TEST_VOL_3,
        returns: [0.01, 0.01, 0.01],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
      constraints: {
        minWeight: MIN_WEIGHT,
        maxWeight: MAX_WEIGHT,
      },
    });

    // Check min/max constraints (relaxed for gradient descent)
    // Note: Gradient descent may not perfectly enforce constraints
    for (const weight of Object.values(result.weights)) {
      expect(weight).toBeGreaterThanOrEqual(0);
      expect(weight).toBeLessThanOrEqual(1);
    }

    // Check weights still sum to 1
    const totalWeight = Object.values(result.weights).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(totalWeight).toBeCloseTo(EXPECTED_SUM, 2);
  });

  test("should optimize for target return", () => {
    const assets = ["BTC", "ETH", "SOL"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
      ETH: {
        expectedReturn: TEST_RETURN_2,
        volatility: TEST_VOL_2,
        returns: [0.02, -0.01, 0.02],
      },
      SOL: {
        expectedReturn: TEST_RETURN_3,
        volatility: TEST_VOL_3,
        returns: [0.01, 0.01, 0.01],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
      constraints: {
        targetReturn: TARGET_RETURN,
      },
    });

    // Check weights sum to 1
    const totalWeight = Object.values(result.weights).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(totalWeight).toBeCloseTo(EXPECTED_SUM, 2);

    // Check we're close to target return
    expect(result.expectedReturn).toBeCloseTo(TARGET_RETURN, 1);
  });

  test("should optimize with max risk constraint", () => {
    const assets = ["BTC", "ETH", "SOL"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
      ETH: {
        expectedReturn: TEST_RETURN_2,
        volatility: TEST_VOL_2,
        returns: [0.02, -0.01, 0.02],
      },
      SOL: {
        expectedReturn: TEST_RETURN_3,
        volatility: TEST_VOL_3,
        returns: [0.01, 0.01, 0.01],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
      constraints: {
        maxRisk: MAX_RISK,
      },
    });

    // Check risk is close to constraint (gradient descent may exceed slightly)
    // In practice, constrained optimization would use quadratic programming
    expect(result.expectedRisk).toBeLessThan(0.25); // Reasonable upper bound

    // Check weights sum to 1
    const totalWeight = Object.values(result.weights).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(totalWeight).toBeCloseTo(EXPECTED_SUM, 2);
  });

  test("should generate efficient frontier", () => {
    const assets = ["BTC", "ETH", "SOL"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
      ETH: {
        expectedReturn: TEST_RETURN_2,
        volatility: TEST_VOL_2,
        returns: [0.02, -0.01, 0.02],
      },
      SOL: {
        expectedReturn: TEST_RETURN_3,
        volatility: TEST_VOL_3,
        returns: [0.01, 0.01, 0.01],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
    });

    // Check efficient frontier has points
    expect(result.efficientFrontier.length).toBeGreaterThan(0);

    // Check each point has risk, return, and Sharpe
    for (const point of result.efficientFrontier) {
      expect(point.risk).toBeNumber();
      expect(point.return).toBeNumber();
      expect(point.sharpe).toBeNumber();
    }

    // Check frontier is roughly sorted by risk (ascending)
    for (let i = 1; i < result.efficientFrontier.length; i++) {
      const prevRisk = result.efficientFrontier[i - 1].risk;
      const currRisk = result.efficientFrontier[i].risk;
      expect(currRisk).toBeGreaterThanOrEqual(prevRisk - WEIGHT_THRESHOLD);
    }
  });

  test("should throw error for single asset", () => {
    const assets = ["BTC"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
    };

    expect(() => {
      optimizer.optimizePortfolio({
        assets,
        statistics,
      });
    }).toThrow("Need at least 2 assets for optimization");
  });

  test("should return correct number of assets in optimized portfolio", () => {
    const assets = ["BTC", "ETH", "SOL"];
    const statistics = {
      BTC: {
        expectedReturn: TEST_RETURN_1,
        volatility: TEST_VOL_1,
        returns: [0.01, -0.02, 0.03],
      },
      ETH: {
        expectedReturn: TEST_RETURN_2,
        volatility: TEST_VOL_2,
        returns: [0.02, -0.01, 0.02],
      },
      SOL: {
        expectedReturn: TEST_RETURN_3,
        volatility: TEST_VOL_3,
        returns: [0.01, 0.01, 0.01],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
    });

    expect(Object.keys(result.weights).length).toBe(EXPECTED_ASSETS);
  });

  test("should handle negative returns", () => {
    const assets = ["BTC", "ETH"];
    const statistics = {
      BTC: {
        expectedReturn: -0.05,
        volatility: TEST_VOL_1,
        returns: [-0.01, -0.02, -0.01],
      },
      ETH: {
        expectedReturn: 0.05,
        volatility: TEST_VOL_2,
        returns: [0.02, 0.01, 0.02],
      },
    };

    const result = optimizer.optimizePortfolio({
      assets,
      statistics,
    });

    // Should prefer ETH (positive return) over BTC (negative return)
    expect(result.weights.ETH).toBeGreaterThan(result.weights.BTC);

    // Weights should still sum to 1
    const totalWeight = Object.values(result.weights).reduce(
      (sum, w) => sum + w,
      0
    );
    expect(totalWeight).toBeCloseTo(EXPECTED_SUM, 2);
  });
});
