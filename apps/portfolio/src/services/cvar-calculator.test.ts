/**
 * Tests for CVaR Calculator
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { CVaRCalculator } from "./cvar-calculator";

// Mock logger
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe("CVaRCalculator", () => {
  let calculator: CVaRCalculator;

  beforeEach(() => {
    calculator = new CVaRCalculator(
      mockLogger as Parameters<typeof CVaRCalculator.prototype.constructor>[0]
    );
  });

  describe("calculate", () => {
    it("should calculate CVaR correctly for normal returns", () => {
      // Generate sample returns: mix of positive and negative
      const returns = [
        -0.05, -0.03, -0.08, -0.02, 0.01, 0.03, 0.02, -0.01, 0.04, -0.06, 0.02,
        -0.04, 0.05, -0.07, 0.03, -0.01, 0.02, -0.03, 0.04, -0.02, 0.01, -0.05,
        0.03, -0.01, 0.02, -0.04, 0.05, -0.02, 0.01, -0.03,
      ];
      const portfolioValue = 100_000;

      const result = calculator.calculate(returns, portfolioValue);

      // Basic validations
      expect(result).toBeDefined();
      expect(result.cvar95).toBeGreaterThan(0);
      expect(result.cvar99).toBeGreaterThan(0);
      expect(result.var95).toBeGreaterThan(0);
      expect(result.var99).toBeGreaterThan(0);

      // CVaR should always be >= VaR
      expect(result.cvar95).toBeGreaterThanOrEqual(result.var95);
      expect(result.cvar99).toBeGreaterThanOrEqual(result.var99);

      // CVaR99 should be > CVaR95 (more extreme)
      expect(result.cvar99).toBeGreaterThanOrEqual(result.cvar95);

      // Tail risk should be >= 1 (CVaR >= VaR)
      expect(result.tailRisk95).toBeGreaterThanOrEqual(1);
      expect(result.tailRisk99).toBeGreaterThanOrEqual(1);

      expect(result.portfolioValue).toBe(portfolioValue);
      expect(result.historicalReturns).toHaveLength(returns.length);
    });

    it("should handle all negative returns correctly", () => {
      const returns = [
        -0.05, -0.03, -0.08, -0.02, -0.01, -0.03, -0.02, -0.01, -0.04, -0.06,
        -0.02, -0.04, -0.05, -0.07, -0.03, -0.01, -0.02, -0.03, -0.04, -0.02,
      ];
      const portfolioValue = 50_000;

      const result = calculator.calculate(returns, portfolioValue);

      expect(result.cvar95).toBeGreaterThan(0);
      expect(result.var95).toBeGreaterThan(0);
      expect(result.cvar95).toBeGreaterThanOrEqual(result.var95);
    });

    it("should throw error for insufficient data", () => {
      const returns = [-0.05, -0.03]; // Only 2 samples, need 10
      const portfolioValue = 100_000;

      expect(() => calculator.calculate(returns, portfolioValue)).toThrow(
        "Insufficient data for CVaR calculation"
      );
    });

    it("should support confidence level 99", () => {
      const returns = [
        -0.05, -0.03, -0.08, -0.02, 0.01, 0.03, 0.02, -0.01, 0.04, -0.06, 0.02,
        -0.04, 0.05, -0.07, 0.03, -0.01, 0.02, -0.03, 0.04, -0.02,
      ];
      const portfolioValue = 100_000;
      const CONFIDENCE_99 = 99;

      const result = calculator.calculate(
        returns,
        portfolioValue,
        CONFIDENCE_99
      );

      expect(result.cvar99).toBeGreaterThan(0);
      expect(result.var99).toBeGreaterThan(0);
    });
  });

  describe("calculateParametric", () => {
    it("should calculate parametric CVaR", () => {
      const returns = [
        -0.05, -0.03, -0.08, -0.02, 0.01, 0.03, 0.02, -0.01, 0.04, -0.06, 0.02,
        -0.04, 0.05, -0.07, 0.03, -0.01, 0.02, -0.03, 0.04, -0.02,
      ];
      const portfolioValue = 100_000;

      const cvar = calculator.calculateParametric(returns, portfolioValue);

      expect(cvar).toBeGreaterThan(0);
      expect(cvar).toBeLessThan(portfolioValue); // Should be a loss, not exceed portfolio
    });
  });

  describe("identifyWorstScenarios", () => {
    it("should identify worst 5% scenarios", () => {
      const returns = [
        -0.1, -0.08, -0.05, -0.03, -0.01, 0.01, 0.02, 0.03, 0.04, 0.05, 0.02,
        -0.02, 0.03, -0.01, 0.01, -0.03, 0.04, -0.04, 0.05, -0.02,
      ];

      const scenarios = calculator.identifyWorstScenarios(returns);

      // 5% of 20 = 1 scenario
      expect(scenarios.length).toBeGreaterThan(0);

      // All scenarios should be negative
      for (const scenario of scenarios) {
        expect(scenario.return).toBeLessThan(0);
      }

      // First scenario should be worst (most negative)
      if (scenarios.length > 1) {
        expect(scenarios[0].return).toBeLessThanOrEqual(scenarios[1].return);
      }
    });
  });

  describe("calculateCVaRContribution", () => {
    it("should calculate CVaR contribution by asset", () => {
      // Create sample returns for 2 assets
      const assetReturns = new Map<string, number[]>([
        [
          "BTC",
          [
            -0.05, -0.03, -0.08, -0.02, 0.01, 0.03, 0.02, -0.01, 0.04, -0.06,
            0.02, -0.04, 0.05, -0.07, 0.03, -0.01, 0.02, -0.03, 0.04, -0.02,
          ],
        ],
        [
          "ETH",
          [
            -0.06, -0.04, -0.09, -0.03, 0.02, 0.04, 0.03, -0.02, 0.05, -0.07,
            0.03, -0.05, 0.06, -0.08, 0.04, -0.02, 0.03, -0.04, 0.05, -0.03,
          ],
        ],
      ]);

      const portfolioWeights = new Map<string, number>([
        ["BTC", 0.6],
        ["ETH", 0.4],
      ]);

      const contributions = calculator.calculateCVaRContribution({
        assetReturns,
        portfolioWeights,
      });

      expect(contributions.size).toBe(2);
      expect(contributions.has("BTC")).toBe(true);
      expect(contributions.has("ETH")).toBe(true);

      const btcContribution = contributions.get("BTC");
      const ethContribution = contributions.get("ETH");

      expect(btcContribution).toBeGreaterThan(0);
      expect(ethContribution).toBeGreaterThan(0);
    });
  });
});
