/**
 * EMA (Exponential Moving Average) Calculator
 * Gives more weight to recent prices
 */

import type { Candle } from "@aladdin/core";
import { BaseIndicator, type IndicatorResult } from "./base-indicator";

export type EMAParams = {
  period: number;
};

export type EMAResult = {
  ema: number;
};

/**
 * EMA Calculator
 */
export class EMACalculator extends BaseIndicator<EMAParams, EMAResult> {
  constructor(params: EMAParams) {
    super(params);
  }

  getName(): string {
    return "EMA";
  }

  getMinimumCandles(): number {
    return this.params.period;
  }

  protected validateParams(params: EMAParams): void {
    super.validateParams(params);

    if (params.period < 1) {
      throw new Error("EMA: period must be at least 1");
    }
  }

  calculate(candles: Candle[]): IndicatorResult<EMAResult>[] {
    this.validateCandleCount(candles);

    const sorted = this.sortCandles(candles);
    const closes = this.extractClosePrices(sorted);
    const results: IndicatorResult<EMAResult>[] = [];

    const multiplier = this.getEMAMultiplier(this.params.period);

    // First EMA is SMA
    const firstEMA = this.calculateSMA(
      closes.slice(0, this.params.period),
      this.params.period
    );

    results.push({
      timestamp: sorted[this.params.period - 1].timestamp,
      value: { ema: firstEMA },
    });

    // Calculate subsequent EMAs
    let previousEMA = firstEMA;

    for (let i = this.params.period; i < closes.length; i++) {
      const ema = (closes[i] - previousEMA) * multiplier + previousEMA;

      results.push({
        timestamp: sorted[i].timestamp,
        value: { ema },
      });

      previousEMA = ema;
    }

    return results;
  }

  /**
   * Get single EMA value for latest candle
   */
  getSingleValue(candles: Candle[]): number | null {
    const results = this.calculate(candles);
    return results.length > 0 ? results[results.length - 1].value.ema : null;
  }
}
