/**
 * Tests for Stress Testing Engine
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { StressTestingEngine } from "./stress-testing";

// Mock logger
const mockLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe("StressTestingEngine", () => {
  let engine: StressTestingEngine;

  beforeEach(() => {
    engine = new StressTestingEngine(
      mockLogger as Parameters<
        typeof StressTestingEngine.prototype.constructor
      >[0]
    );
  });

  describe("runStressTest", () => {
    it("should run stress test with default scenarios", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
        { symbol: "ETHUSDT", quantity: 10, currentPrice: 3000 },
      ];

      const result = engine.runStressTest({ positions });

      expect(result).toBeDefined();
      expect(result.scenarios).toBeDefined();
      expect(result.scenarios.length).toBeGreaterThan(0);
      expect(result.worstCase).toBeDefined();
      expect(result.bestCase).toBeDefined();
      expect(result.averageLoss).toBeGreaterThan(0);
      expect(result.resilienceScore).toBeGreaterThanOrEqual(0);
      expect(result.resilienceScore).toBeLessThanOrEqual(100);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it("should show higher losses for leveraged positions", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
      ];

      const LEVERAGE_1 = 1;
      const LEVERAGE_5 = 5;
      const resultNoLeverage = engine.runStressTest({
        positions,
        leverage: LEVERAGE_1,
      });
      const resultWithLeverage = engine.runStressTest({
        positions,
        leverage: LEVERAGE_5,
      });

      expect(resultWithLeverage.averageLoss).toBeGreaterThan(
        resultNoLeverage.averageLoss
      );
      expect(resultWithLeverage.worstCase.loss).toBeGreaterThan(
        resultNoLeverage.worstCase.loss
      );
    });

    it("should detect liquidation risk", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
      ];

      // With high leverage, some scenarios should trigger liquidation risk
      const HIGH_LEVERAGE = 10;
      const result = engine.runStressTest({
        positions,
        leverage: HIGH_LEVERAGE,
      });

      const scenariosWithLiquidationRisk = result.scenarios.filter(
        (s) => s.liquidationRisk
      );
      expect(scenariosWithLiquidationRisk.length).toBeGreaterThan(0);
    });

    it("should detect margin call risk", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
      ];

      const MODERATE_LEVERAGE = 3;
      const result = engine.runStressTest({
        positions,
        leverage: MODERATE_LEVERAGE,
      });

      const scenariosWithMarginCallRisk = result.scenarios.filter(
        (s) => s.marginCallRisk
      );
      expect(scenariosWithMarginCallRisk.length).toBeGreaterThan(0);
    });

    it("should provide lower resilience score for high-risk portfolios", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
      ];

      const LOW_LEVERAGE = 1;
      const HIGH_LEVERAGE = 10;
      const lowRiskResult = engine.runStressTest({
        positions,
        leverage: LOW_LEVERAGE,
      });
      const highRiskResult = engine.runStressTest({
        positions,
        leverage: HIGH_LEVERAGE,
      });

      expect(lowRiskResult.resilienceScore).toBeGreaterThan(
        highRiskResult.resilienceScore
      );
    });
  });

  describe("getHistoricalScenarios", () => {
    it("should return predefined scenarios", () => {
      const scenarios = engine.getHistoricalScenarios();

      expect(scenarios).toBeDefined();
      expect(scenarios.length).toBeGreaterThan(0);

      // Check that scenarios have required properties
      for (const scenario of scenarios) {
        expect(scenario.name).toBeDefined();
        expect(scenario.description).toBeDefined();
        expect(scenario.priceShocks).toBeDefined();
        expect(scenario.priceShocks.size).toBeGreaterThan(0);
      }

      // Check for some known scenarios
      const scenarioNames = scenarios.map((s) => s.name);
      expect(scenarioNames).toContain("COVID-19 Crash (Mar 2020)");
      expect(scenarioNames).toContain("Crypto Winter 2022");
      expect(scenarioNames).toContain("Flash Crash");
    });
  });

  describe("createCustomScenario", () => {
    it("should create custom scenario", () => {
      const SHOCK_MINUS_30 = -30;
      const SHOCK_MINUS_40 = -40;
      const VOLUME_SHOCK_200 = 200;
      const scenario = engine.createCustomScenario({
        name: "Custom Test Scenario",
        description: "A test scenario",
        priceShocks: {
          BTCUSDT: SHOCK_MINUS_30,
          ETHUSDT: SHOCK_MINUS_40,
        },
        volumeShock: VOLUME_SHOCK_200,
      });

      expect(scenario.name).toBe("Custom Test Scenario");
      expect(scenario.description).toBe("A test scenario");
      expect(scenario.priceShocks.get("BTCUSDT")).toBe(SHOCK_MINUS_30);
      expect(scenario.priceShocks.get("ETHUSDT")).toBe(SHOCK_MINUS_40);
      expect(scenario.volumeShock).toBe(VOLUME_SHOCK_200);
    });

    it("should use custom scenarios in stress test", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
      ];

      const SHOCK_MINUS_50 = -50;
      const customScenario = engine.createCustomScenario({
        name: "Custom Crash",
        description: "50% drop",
        priceShocks: { BTCUSDT: SHOCK_MINUS_50 },
      });

      const result = engine.runStressTest({
        positions,
        scenarios: [customScenario],
      });

      expect(result.scenarios).toHaveLength(1);
      expect(result.scenarios[0].scenario).toBe("Custom Crash");
    });
  });

  describe("scenario calculations", () => {
    it("should calculate losses correctly for single position", () => {
      const INITIAL_PRICE = 50_000;
      const QUANTITY = 1;
      const positions = [
        { symbol: "BTCUSDT", quantity: QUANTITY, currentPrice: INITIAL_PRICE },
      ];

      const SHOCK_MINUS_50 = -50;
      const scenario = engine.createCustomScenario({
        name: "50% Drop",
        description: "BTC drops 50%",
        priceShocks: { BTCUSDT: SHOCK_MINUS_50 },
      });

      const result = engine.runStressTest({
        positions,
        scenarios: [scenario],
      });

      const EXPECTED_LOSS_PERCENTAGE = 50;
      const EXPECTED_LOSS = INITIAL_PRICE * 0.5;
      expect(result.scenarios[0].lossPercentage).toBeCloseTo(
        EXPECTED_LOSS_PERCENTAGE
      );
      expect(result.scenarios[0].loss).toBeCloseTo(EXPECTED_LOSS);
    });

    it("should handle multiple positions correctly", () => {
      const positions = [
        { symbol: "BTCUSDT", quantity: 1, currentPrice: 50_000 },
        { symbol: "ETHUSDT", quantity: 10, currentPrice: 3000 },
      ];

      const SHOCK_MINUS_30 = -30;
      const SHOCK_MINUS_40 = -40;
      const scenario = engine.createCustomScenario({
        name: "Mixed Crash",
        description: "BTC -30%, ETH -40%",
        priceShocks: {
          BTCUSDT: SHOCK_MINUS_30,
          ETHUSDT: SHOCK_MINUS_40,
        },
      });

      const result = engine.runStressTest({
        positions,
        scenarios: [scenario],
      });

      expect(result.scenarios[0].positionImpacts).toHaveLength(2);

      const btcImpact = result.scenarios[0].positionImpacts.find(
        (p) => p.symbol === "BTCUSDT"
      );
      const ethImpact = result.scenarios[0].positionImpacts.find(
        (p) => p.symbol === "ETHUSDT"
      );

      expect(btcImpact).toBeDefined();
      expect(ethImpact).toBeDefined();

      if (btcImpact && ethImpact) {
        const EXPECTED_BTC_LOSS = 30;
        const EXPECTED_ETH_LOSS = 40;
        expect(btcImpact.lossPercentage).toBeCloseTo(EXPECTED_BTC_LOSS);
        expect(ethImpact.lossPercentage).toBeCloseTo(EXPECTED_ETH_LOSS);
      }
    });
  });
});
