/**
 * Base class for technical indicators
 * All indicator calculators should extend this class
 */

import type { Candle } from "@aladdin/shared/types";

/**
 * Base indicator parameters
 */
export type BaseIndicatorParams = Record<string, unknown>;

/**
 * Indicator calculation result
 */
export type IndicatorResult<T = unknown> = {
  timestamp: number;
  value: T;
};

/**
 * Abstract base class for indicators
 */
export abstract class BaseIndicator<
  TParams extends BaseIndicatorParams,
  TResult,
> {
  protected params: TParams;

  constructor(params: TParams) {
    this.params = params;
    this.validateParams(params);
  }

  /**
   * Get indicator name
   */
  abstract getName(): string;

  /**
   * Calculate indicator values
   * @param candles - Historical candle data
   * @returns Array of indicator results
   */
  abstract calculate(candles: Candle[]): IndicatorResult<TResult>[];

  /**
   * Validate indicator parameters
   * Override in subclass to add custom validation
   */
  protected validateParams(params: TParams): void {
    if (!params) {
      throw new Error(`${this.getName()}: params are required`);
    }
  }

  /**
   * Get minimum required candles
   * Override in subclass to specify required data points
   */
  getMinimumCandles(): number {
    return 1;
  }

  /**
   * Validate that we have enough candles
   */
  protected validateCandleCount(candles: Candle[]): void {
    const minRequired = this.getMinimumCandles();
    if (candles.length < minRequired) {
      throw new Error(
        `${this.getName()}: Requires at least ${minRequired} candles, got ${candles.length}`
      );
    }
  }

  /**
   * Helper: Sort candles by timestamp ascending
   */
  protected sortCandles(candles: Candle[]): Candle[] {
    return [...candles].sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Helper: Extract close prices from candles
   */
  protected extractClosePrices(candles: Candle[]): number[] {
    return candles.map((c) => c.close);
  }

  /**
   * Helper: Calculate Simple Moving Average
   */
  protected calculateSMA(values: number[], period: number): number {
    if (values.length < period) {
      throw new Error(
        `Not enough data for SMA calculation (need ${period}, got ${values.length})`
      );
    }
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  /**
   * Helper: Calculate Exponential Moving Average multiplier
   */
  protected getEMAMultiplier(period: number): number {
    return 2 / (period + 1);
  }
}
