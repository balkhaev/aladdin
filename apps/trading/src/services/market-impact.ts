/**
 * Market Impact Modeling
 *
 * Оценка влияния крупных ордеров на рынок:
 * - Temporary Impact (краткосрочное влияние)
 * - Permanent Impact (долгосрочное влияние)
 * - Slippage Prediction (прогноз проскальзывания)
 * - Optimal Order Splitting (разбиение ордеров)
 *
 * Based on:
 * - Almgren-Chriss model (2000)
 * - Kyle model (1985)
 * - Empirical market microstructure research
 */

import type { Logger } from "@aladdin/shared/logger";

export type MarketImpactParams = {
  symbol: string;
  orderSize: number; // USD value
  side: "BUY" | "SELL";
  urgency?: "low" | "medium" | "high"; // How fast to execute
  currentPrice: number;
  dailyVolume: number; // USD value
  spread: number; // Bid-ask spread
  volatility?: number; // Historical volatility
};

export type MarketImpactResult = {
  temporaryImpact: number; // Immediate price impact (%)
  permanentImpact: number; // Lasting price impact (%)
  expectedSlippage: number; // Total expected slippage (%)
  estimatedCost: number; // Total cost in USD
  participationRate: number; // Order size / daily volume
  priceImpactBps: number; // Price impact in basis points
  recommendation: {
    shouldSplit: boolean;
    optimalChunks: number;
    timeHorizon: number; // Suggested execution time in minutes
    reason: string;
  };
};

export type OrderSplittingStrategy = {
  chunks: Array<{
    size: number; // USD value
    delayMinutes: number; // Delay before execution
    estimatedSlippage: number;
  }>;
  totalSlippage: number;
  totalTime: number; // Total execution time in minutes
  savingsVsImmediate: number; // Savings compared to immediate execution
};

// Constants
const PERCENT_MULTIPLIER = 100;
const BPS_MULTIPLIER = 10_000; // Basis points
const PARTICIPATION_RATE_THRESHOLD = 0.01; // 1% of daily volume
const HIGH_URGENCY_THRESHOLD = 0.05; // 5% of daily volume
const MEDIUM_URGENCY_THRESHOLD = 0.02; // 2% of daily volume
const SQRT_PARTICIPATION_FACTOR = 0.5; // Square root impact coefficient
const PERMANENT_IMPACT_FACTOR = 0.1; // Permanent impact is ~10% of temporary
const SPREAD_IMPACT_FACTOR = 0.5; // Spread contributes 50% to immediate impact
const MIN_CHUNKS = 2;
const MAX_CHUNKS = 20;
const LOW_URGENCY_TIME = 60; // 60 minutes
const MEDIUM_URGENCY_TIME = 30; // 30 minutes
const HIGH_URGENCY_TIME = 10; // 10 minutes
const URGENCY_FACTOR_LOW = 1.0;
const URGENCY_FACTOR_MEDIUM = 1.5;
const URGENCY_FACTOR_HIGH = 2.5;
const MAX_CHUNKS_MEDIUM = 10; // MAX_CHUNKS / 2
const TIME_HORIZON_MULTIPLIER = 2;
const MIN_EXECUTION_TIME = 5; // minutes
const MAX_EXECUTION_TIME = 240; // minutes (4 hours)
const PRECISION_COST = 2; // Decimal places for costs
const PRECISION_SLIPPAGE = 3; // Decimal places for slippage

export class MarketImpactModel {
  constructor(private logger: Logger) {}

  /**
   * Calculate market impact for an order
   *
   * Uses Almgren-Chriss inspired model with square-root law
   */
  calculateImpact(params: MarketImpactParams): MarketImpactResult {
    const {
      symbol,
      orderSize,
      side,
      urgency = "medium",
      currentPrice,
      dailyVolume,
      spread,
      volatility = 0.02, // Default 2% daily volatility
    } = params;

    this.logger.info("Calculating market impact", {
      symbol,
      orderSize,
      side,
      urgency,
    });

    // Calculate participation rate (order size as % of daily volume)
    const participationRate = orderSize / dailyVolume;

    // Temporary impact (square-root law)
    // Impact ≈ σ * sqrt(participation_rate) * urgency_factor
    const urgencyFactor = this.getUrgencyFactor(urgency);
    const temporaryImpact =
      volatility *
      Math.sqrt(participationRate) *
      SQRT_PARTICIPATION_FACTOR *
      urgencyFactor;

    // Permanent impact (linear with participation rate)
    // Smaller than temporary, represents information leakage
    const permanentImpact =
      participationRate * volatility * PERMANENT_IMPACT_FACTOR;

    // Spread crossing cost (for market orders)
    const spreadCost = (spread / currentPrice) * SPREAD_IMPACT_FACTOR;

    // Total expected slippage
    const expectedSlippage = temporaryImpact + permanentImpact + spreadCost;

    // Estimated cost in USD
    const estimatedCost = orderSize * expectedSlippage;

    // Price impact in basis points
    const priceImpactBps = expectedSlippage * BPS_MULTIPLIER;

    // Determine if order should be split
    const recommendation = this.getRecommendation({
      participationRate,
      expectedSlippage,
      urgency,
      orderSize,
      dailyVolume,
    });

    this.logger.info("Market impact calculated", {
      symbol,
      participationRate: (participationRate * PERCENT_MULTIPLIER).toFixed(
        PRECISION_COST
      ),
      expectedSlippage: (expectedSlippage * PERCENT_MULTIPLIER).toFixed(
        PRECISION_SLIPPAGE
      ),
      estimatedCost: estimatedCost.toFixed(PRECISION_COST),
    });

    return {
      temporaryImpact,
      permanentImpact,
      expectedSlippage,
      estimatedCost,
      participationRate,
      priceImpactBps,
      recommendation,
    };
  }

  /**
   * Generate optimal order splitting strategy
   */
  generateSplittingStrategy(params: {
    impact: MarketImpactResult;
    orderSize: number;
    volatility?: number;
  }): OrderSplittingStrategy {
    const { impact, orderSize, volatility = 0.02 } = params;

    if (!impact.recommendation.shouldSplit) {
      // No need to split - execute immediately
      return {
        chunks: [
          {
            size: orderSize,
            delayMinutes: 0,
            estimatedSlippage: impact.expectedSlippage,
          },
        ],
        totalSlippage: impact.expectedSlippage,
        totalTime: 0,
        savingsVsImmediate: 0,
      };
    }

    // Calculate optimal number of chunks
    const numChunks = Math.min(impact.recommendation.optimalChunks, MAX_CHUNKS);
    const chunkSize = orderSize / numChunks;
    const timeHorizon = impact.recommendation.timeHorizon;
    const delayBetweenChunks = timeHorizon / numChunks;

    // Generate chunks with decreasing slippage
    const chunks: Array<{
      size: number;
      delayMinutes: number;
      estimatedSlippage: number;
    }> = [];
    let cumulativeTime = 0;
    let totalSlippage = 0;

    for (let i = 0; i < numChunks; i++) {
      // Each chunk has lower impact due to smaller size
      const chunkParticipation = impact.participationRate / numChunks;
      const chunkImpact =
        volatility * Math.sqrt(chunkParticipation) * SQRT_PARTICIPATION_FACTOR;

      chunks.push({
        size: chunkSize,
        delayMinutes: cumulativeTime,
        estimatedSlippage: chunkImpact,
      });

      totalSlippage += chunkImpact * chunkSize;
      cumulativeTime += delayBetweenChunks;
    }

    // Normalize total slippage to percentage
    const avgSlippage = totalSlippage / orderSize;

    // Calculate savings compared to immediate execution
    const immediateCost = orderSize * impact.expectedSlippage;
    const splitCost = totalSlippage;
    const savingsVsImmediate = immediateCost - splitCost;

    this.logger.info("Order splitting strategy generated", {
      numChunks,
      totalTime: timeHorizon,
      avgSlippage: (avgSlippage * PERCENT_MULTIPLIER).toFixed(
        PRECISION_SLIPPAGE
      ),
      savings: savingsVsImmediate.toFixed(PRECISION_COST),
    });

    return {
      chunks,
      totalSlippage: avgSlippage,
      totalTime: timeHorizon,
      savingsVsImmediate,
    };
  }

  /**
   * Predict slippage based on order book depth
   */
  predictSlippageFromOrderBook(params: {
    orderSize: number;
    side: "BUY" | "SELL";
    orderBook: {
      bids: Array<{ price: number; quantity: number }>;
      asks: Array<{ price: number; quantity: number }>;
    };
  }): {
    avgFillPrice: number;
    slippage: number;
    filledQuantity: number;
  } {
    const { orderSize, side, orderBook } = params;

    const levels = side === "BUY" ? orderBook.asks : orderBook.bids;

    if (levels.length === 0) {
      return {
        avgFillPrice: 0,
        slippage: 0,
        filledQuantity: 0,
      };
    }

    let remainingSize = orderSize;
    let totalCost = 0;
    let filledQuantity = 0;
    const bestPrice = levels[0].price;

    // Walk through order book levels
    for (const level of levels) {
      if (remainingSize <= 0) break;

      const levelValue = level.price * level.quantity;
      const fillSize = Math.min(remainingSize, levelValue);

      totalCost += fillSize;
      filledQuantity += fillSize / level.price;
      remainingSize -= fillSize;
    }

    const avgFillPrice = filledQuantity > 0 ? totalCost / filledQuantity : 0;
    const slippage =
      bestPrice > 0 ? Math.abs(avgFillPrice - bestPrice) / bestPrice : 0;

    return {
      avgFillPrice,
      slippage,
      filledQuantity,
    };
  }

  /**
   * Get urgency factor for impact calculation
   */
  private getUrgencyFactor(urgency: "low" | "medium" | "high"): number {
    switch (urgency) {
      case "low": {
        return URGENCY_FACTOR_LOW;
      }
      case "medium": {
        return URGENCY_FACTOR_MEDIUM;
      }
      case "high": {
        return URGENCY_FACTOR_HIGH;
      }
      default: {
        return URGENCY_FACTOR_LOW;
      }
    }
  }

  /**
   * Generate recommendation for order execution
   */
  private getRecommendation(params: {
    participationRate: number;
    expectedSlippage: number;
    urgency: "low" | "medium" | "high";
    orderSize: number;
    dailyVolume: number;
  }): MarketImpactResult["recommendation"] {
    const { participationRate, urgency } = params;

    // Don't split if order is small relative to volume
    if (participationRate < PARTICIPATION_RATE_THRESHOLD) {
      return {
        shouldSplit: false,
        optimalChunks: 1,
        timeHorizon: 0,
        reason: "Order size is small relative to market volume",
      };
    }

    // High urgency - may need to accept higher impact
    if (urgency === "high") {
      if (participationRate < HIGH_URGENCY_THRESHOLD) {
        return {
          shouldSplit: false,
          optimalChunks: 1,
          timeHorizon: 0,
          reason: "High urgency - execute immediately",
        };
      }
      return {
        shouldSplit: true,
        optimalChunks: MIN_CHUNKS,
        timeHorizon: HIGH_URGENCY_TIME,
        reason: "Large order with high urgency - split minimally",
      };
    }

    // Medium urgency - balance speed and impact
    if (urgency === "medium") {
      if (participationRate < MEDIUM_URGENCY_THRESHOLD) {
        return {
          shouldSplit: false,
          optimalChunks: 1,
          timeHorizon: 0,
          reason: "Medium urgency - acceptable immediate execution",
        };
      }

      const optimalChunks = Math.ceil(
        Math.sqrt(participationRate * PERCENT_MULTIPLIER)
      );
      return {
        shouldSplit: true,
        optimalChunks: Math.min(optimalChunks, MAX_CHUNKS_MEDIUM),
        timeHorizon: MEDIUM_URGENCY_TIME,
        reason: "Medium urgency - balanced splitting strategy",
      };
    }

    // Low urgency - minimize impact
    const optimalChunks = Math.ceil(
      Math.sqrt(participationRate * PERCENT_MULTIPLIER) *
        TIME_HORIZON_MULTIPLIER
    );
    return {
      shouldSplit: true,
      optimalChunks: Math.min(optimalChunks, MAX_CHUNKS),
      timeHorizon: LOW_URGENCY_TIME,
      reason: "Low urgency - optimize for minimal market impact",
    };
  }

  /**
   * Calculate implementation shortfall
   *
   * Implementation Shortfall = Decision Price - Actual Execution Price
   */
  calculateImplementationShortfall(params: {
    decisionPrice: number;
    actualFillPrice: number;
    orderSize: number;
    side: "BUY" | "SELL";
  }): {
    shortfall: number;
    shortfallBps: number;
    cost: number;
  } {
    const { decisionPrice, actualFillPrice, orderSize, side } = params;

    const priceChange =
      side === "BUY"
        ? actualFillPrice - decisionPrice
        : decisionPrice - actualFillPrice;

    const shortfall = priceChange / decisionPrice;
    const shortfallBps = shortfall * BPS_MULTIPLIER;
    const cost = orderSize * shortfall;

    return {
      shortfall,
      shortfallBps,
      cost,
    };
  }

  /**
   * Estimate optimal execution time horizon (in minutes)
   *
   * Based on Almgren-Chriss model
   */
  estimateOptimalTimeHorizon(params: {
    orderSize: number;
    dailyVolume: number;
    volatility: number;
    riskAversion: number; // 0-1, higher = more risk averse
  }): number {
    const { orderSize, dailyVolume, volatility, riskAversion } = params;

    const participationRate = orderSize / dailyVolume;

    // Optimal time proportional to sqrt(participation_rate) and volatility
    // More risk averse → longer time horizon
    const baseTime = Math.sqrt(participationRate) * PERCENT_MULTIPLIER;
    const volatilityFactor = volatility * PERCENT_MULTIPLIER;
    const riskFactor = 1 + riskAversion;

    const optimalMinutes = baseTime * volatilityFactor * riskFactor;

    // Clamp between 5 minutes and 4 hours
    return Math.max(
      MIN_EXECUTION_TIME,
      Math.min(MAX_EXECUTION_TIME, optimalMinutes)
    );
  }
}
