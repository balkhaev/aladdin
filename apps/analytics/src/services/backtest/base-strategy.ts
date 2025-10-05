/**
 * Base class for backtest strategies
 * All trading strategies should extend this class
 */

import type { Candle } from "@aladdin/core";

/**
 * Trade signal
 */
export type TradeSignal = "BUY" | "SELL" | "HOLD";

/**
 * Strategy trade
 */
export type StrategyTrade = {
  timestamp: number;
  type: "BUY" | "SELL";
  price: number;
  quantity: number;
  reason?: string;
};

/**
 * Strategy parameters
 */
export type StrategyParams = Record<string, unknown>;

/**
 * Abstract base class for trading strategies
 */
export abstract class BaseStrategy<
  TParams extends StrategyParams = StrategyParams,
> {
  protected params: TParams;

  constructor(params: TParams) {
    this.params = params;
    this.validateParams(params);
  }

  /**
   * Get strategy name
   */
  abstract getName(): string;

  /**
   * Analyze candles and generate trading signal
   * @param candles - Historical candle data
   * @param currentIndex - Current candle index
   * @returns Trading signal (BUY, SELL, or HOLD)
   */
  abstract analyze(candles: Candle[], currentIndex: number): TradeSignal;

  /**
   * Validate strategy parameters
   * Override in subclass to add custom validation
   */
  protected validateParams(params: TParams): void {
    if (!params) {
      throw new Error(`${this.getName()}: params are required`);
    }
  }

  /**
   * Get minimum required candles for strategy
   */
  abstract getMinimumCandles(): number;

  /**
   * Get strategy description
   */
  getDescription(): string {
    return `${this.getName()} trading strategy`;
  }

  /**
   * Calculate position size based on balance and risk
   * @param balance - Available balance
   * @param price - Entry price
   * @param riskPercent - Risk percentage (default: 1%)
   * @returns Position size (quantity to buy/sell)
   */
  calculatePositionSize(
    balance: number,
    price: number,
    riskPercent = 1
  ): number {
    const riskAmount = balance * (riskPercent / 100);
    return riskAmount / price;
  }

  /**
   * Check if we have enough candles to analyze
   */
  protected canAnalyze(candles: Candle[], currentIndex: number): boolean {
    return currentIndex >= this.getMinimumCandles() - 1;
  }
}
