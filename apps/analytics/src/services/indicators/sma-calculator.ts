/**
 * SMA (Simple Moving Average) Calculator
 * Arithmetic mean of prices over a period
 */

import type { Candle } from "@aladdin/core";
import { BaseIndicator, type IndicatorResult } from "./base-indicator";

export type SMAParams = {
  period: number;
};

export type SMAResult = {
  sma: number;
};

/**
 * SMA Calculator
 */
export class SMACalculator extends BaseIndicator<SMAParams, SMAResult> {
  constructor(params: SMAParams) {
    super(params);
  }

  getName(): string {
    return "SMA";
  }

  getMinimumCandles(): number {
    return this.params.period;
  }

  protected validateParams(params: SMAParams): void {
    super.validateParams(params);

    if (params.period < 1) {
      throw new Error("SMA: period must be at least 1");
    }
  }

  calculate(candles: Candle[]): IndicatorResult<SMAResult>[] {
    this.validateCandleCount(candles);

    const sorted = this.sortCandles(candles);
    const closes = this.extractClosePrices(sorted);
    const results: IndicatorResult<SMAResult>[] = [];

    // Calculate SMA for each window
    for (let i = this.params.period - 1; i < closes.length; i++) {
      const window = closes.slice(i - this.params.period + 1, i + 1);
      const sma =
        window.reduce((sum, val) => sum + val, 0) / this.params.period;

      results.push({
        timestamp: sorted[i].timestamp,
        value: { sma },
      });
    }

    return results;
  }

  /**
   * Get single SMA value for latest candle
   */
  getSingleValue(candles: Candle[]): number | null {
    const results = this.calculate(candles);
    return results.length > 0 ? results[results.length - 1].value.sma : null;
  }
}
