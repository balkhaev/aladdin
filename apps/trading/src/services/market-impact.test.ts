import { beforeEach, describe, expect, test } from "bun:test";
import type { Logger } from "@aladdin/shared/logger";
import { MarketImpactModel, type MarketImpactParams } from "./market-impact";

const DEFAULT_PRICE = 50_000;
const DAILY_VOLUME_1M = 1_000_000;
const DAILY_VOLUME_10M = 10_000_000;
const SPREAD_01_PERCENT = 0.001;
const ORDER_SIZE_10K = 10_000;
const ORDER_SIZE_100K = 100_000;
const ORDER_SIZE_500K = 500_000;
const VOLATILITY_2_PERCENT = 0.02;
const EXPECTED_ZERO = 0;
const EXPECTED_ONE = 1;

describe("MarketImpactModel", () => {
  let model: MarketImpactModel;

  beforeEach(() => {
    // Create a mock logger
    const mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    model = new MarketImpactModel(mockLogger);
  });

  test("should calculate market impact for small order", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_10K,
      side: "BUY",
      urgency: "medium",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);

    expect(impact.participationRate).toBeCloseTo(0.01, 2); // 1% of volume
    expect(impact.expectedSlippage).toBeGreaterThan(0);
    expect(impact.temporaryImpact).toBeGreaterThan(0);
    expect(impact.permanentImpact).toBeGreaterThan(0);
    expect(impact.estimatedCost).toBeGreaterThan(0);
    expect(impact.recommendation.shouldSplit).toBe(false); // Small order
  });

  test("should recommend splitting for large order", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_500K,
      side: "BUY",
      urgency: "low",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);

    expect(impact.participationRate).toBeCloseTo(0.5, 2); // 50% of volume
    expect(impact.recommendation.shouldSplit).toBe(true); // Large order
    expect(impact.recommendation.optimalChunks).toBeGreaterThan(EXPECTED_ONE);
    expect(impact.recommendation.timeHorizon).toBeGreaterThan(0);
  });

  test("should calculate higher impact for urgent orders", () => {
    const baseParams: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_100K,
      side: "BUY",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const lowUrgency = model.calculateImpact({
      ...baseParams,
      urgency: "low",
    });

    const highUrgency = model.calculateImpact({
      ...baseParams,
      urgency: "high",
    });

    expect(highUrgency.temporaryImpact).toBeGreaterThan(
      lowUrgency.temporaryImpact
    );
    expect(highUrgency.expectedSlippage).toBeGreaterThan(
      lowUrgency.expectedSlippage
    );
  });

  test("should generate splitting strategy", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_500K,
      side: "BUY",
      urgency: "low",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);
    const strategy = model.generateSplittingStrategy({
      impact,
      orderSize: ORDER_SIZE_500K,
      volatility: VOLATILITY_2_PERCENT,
    });

    expect(strategy.chunks.length).toBeGreaterThan(EXPECTED_ONE);
    expect(strategy.totalTime).toBeGreaterThan(0);
    expect(strategy.savingsVsImmediate).toBeGreaterThan(0); // Should save money
    expect(strategy.totalSlippage).toBeLessThan(impact.expectedSlippage); // Better than immediate
  });

  test("should not split small orders", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_10K,
      side: "BUY",
      urgency: "medium",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_10M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);
    const strategy = model.generateSplittingStrategy({
      impact,
      orderSize: ORDER_SIZE_10K,
      volatility: VOLATILITY_2_PERCENT,
    });

    expect(strategy.chunks.length).toBe(EXPECTED_ONE); // No splitting
    expect(strategy.totalTime).toBe(EXPECTED_ZERO); // Immediate execution
  });

  test("should calculate price impact in basis points", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_100K,
      side: "BUY",
      urgency: "medium",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);

    expect(impact.priceImpactBps).toBeGreaterThan(0);
    // Price impact in bps should be expectedSlippage * 10000
    expect(impact.priceImpactBps).toBeCloseTo(
      impact.expectedSlippage * 10_000,
      1
    );
  });

  test("should handle different order sides", () => {
    const baseParams: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_100K,
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const buyImpact = model.calculateImpact({
      ...baseParams,
      side: "BUY",
      urgency: "medium",
    });

    const sellImpact = model.calculateImpact({
      ...baseParams,
      side: "SELL",
      urgency: "medium",
    });

    // Impact should be similar for both sides
    expect(buyImpact.expectedSlippage).toBeCloseTo(
      sellImpact.expectedSlippage,
      4
    );
  });

  test("should predict slippage from order book", () => {
    const orderBook = {
      bids: [
        { price: 49_990, quantity: 0.1 },
        { price: 49_980, quantity: 0.2 },
        { price: 49_970, quantity: 0.3 },
      ],
      asks: [
        { price: 50_010, quantity: 0.1 },
        { price: 50_020, quantity: 0.2 },
        { price: 50_030, quantity: 0.3 },
      ],
    };

    const result = model.predictSlippageFromOrderBook({
      orderSize: 5000, // $5000
      side: "BUY",
      orderBook,
    });

    expect(result.avgFillPrice).toBeGreaterThan(0);
    expect(result.slippage).toBeGreaterThanOrEqual(0);
    expect(result.filledQuantity).toBeGreaterThan(0);
  });

  test("should calculate implementation shortfall", () => {
    const shortfall = model.calculateImplementationShortfall({
      decisionPrice: 50_000,
      actualFillPrice: 50_100,
      orderSize: 10_000,
      side: "BUY",
    });

    expect(shortfall.shortfall).toBeGreaterThan(0); // Price moved against us
    expect(shortfall.shortfallBps).toBeGreaterThan(0);
    expect(shortfall.cost).toBeGreaterThan(0);
  });

  test("should calculate negative shortfall for favorable execution", () => {
    const shortfall = model.calculateImplementationShortfall({
      decisionPrice: 50_000,
      actualFillPrice: 49_900,
      orderSize: 10_000,
      side: "BUY",
    });

    expect(shortfall.shortfall).toBeLessThan(0); // Got better price
    expect(shortfall.cost).toBeLessThan(0); // Saved money
  });

  test("should estimate optimal time horizon", () => {
    const timeHorizon = model.estimateOptimalTimeHorizon({
      orderSize: ORDER_SIZE_100K,
      dailyVolume: DAILY_VOLUME_1M,
      volatility: VOLATILITY_2_PERCENT,
      riskAversion: 0.5,
    });

    expect(timeHorizon).toBeGreaterThan(0);
    expect(timeHorizon).toBeLessThanOrEqual(240); // Max 4 hours
  });

  test("should increase time horizon for risk-averse traders", () => {
    const baseParams = {
      orderSize: ORDER_SIZE_100K,
      dailyVolume: DAILY_VOLUME_1M,
      volatility: VOLATILITY_2_PERCENT,
    };

    const lowRisk = model.estimateOptimalTimeHorizon({
      ...baseParams,
      riskAversion: 0.2,
    });

    const highRisk = model.estimateOptimalTimeHorizon({
      ...baseParams,
      riskAversion: 0.8,
    });

    expect(highRisk).toBeGreaterThan(lowRisk);
  });

  test("should handle zero daily volume", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_10K,
      side: "BUY",
      urgency: "medium",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: EXPECTED_ZERO,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);

    // Should handle edge case gracefully
    expect(impact).toBeDefined();
    expect(impact.participationRate).toBe(Number.POSITIVE_INFINITY);
  });

  test("should recommend immediate execution for high urgency small orders", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_10K,
      side: "BUY",
      urgency: "high",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_10M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);

    expect(impact.recommendation.shouldSplit).toBe(false);
    expect(impact.recommendation.timeHorizon).toBe(EXPECTED_ZERO);
  });

  test("should split chunks evenly", () => {
    const params: MarketImpactParams = {
      symbol: "BTCUSDT",
      orderSize: ORDER_SIZE_500K,
      side: "BUY",
      urgency: "low",
      currentPrice: DEFAULT_PRICE,
      dailyVolume: DAILY_VOLUME_1M,
      spread: SPREAD_01_PERCENT,
      volatility: VOLATILITY_2_PERCENT,
    };

    const impact = model.calculateImpact(params);
    const strategy = model.generateSplittingStrategy({
      impact,
      orderSize: ORDER_SIZE_500K,
      volatility: VOLATILITY_2_PERCENT,
    });

    // All chunks should be similar size
    const chunkSizes = strategy.chunks.map((c) => c.size);
    const avgSize = chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length;

    for (const size of chunkSizes) {
      expect(size).toBeCloseTo(avgSize, 0);
    }

    // Total should equal original order size
    const totalSize = chunkSizes.reduce((a, b) => a + b, 0);
    expect(totalSize).toBeCloseTo(ORDER_SIZE_500K, 0);
  });
});
