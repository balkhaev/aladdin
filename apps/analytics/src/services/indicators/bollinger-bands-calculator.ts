/**
 * Bollinger Bands Calculator
 * Volatility indicator with upper and lower bands
 */

import type { Candle } from "@aladdin/core";
import { BaseIndicator, type IndicatorResult } from "./base-indicator";
import { SMACalculator } from "./sma-calculator";

export type BollingerBandsParams = {
  period: number; // Default: 20
  standardDeviations: number; // Default: 2
};

export type BollingerBandsResult = {
  upper: number; // Upper band (SMA + stdDev * multiplier)
  middle: number; // Middle band (SMA)
  lower: number; // Lower band (SMA - stdDev * multiplier)
  bandwidth: number; // (upper - lower) / middle * 100
};

const DEFAULT_PERIOD = 20;
const DEFAULT_STD_DEV = 2;

/**
 * Bollinger Bands Calculator
 */
export class BollingerBandsCalculator extends BaseIndicator<
  BollingerBandsParams,
  BollingerBandsResult
> {
  constructor(params: Partial<BollingerBandsParams> = {}) {
    super({
      period: params.period ?? DEFAULT_PERIOD,
      standardDeviations: params.standardDeviations ?? DEFAULT_STD_DEV,
    });
  }

  getName(): string {
    return "BollingerBands";
  }

  getMinimumCandles(): number {
    return this.params.period;
  }

  protected validateParams(params: BollingerBandsParams): void {
    super.validateParams(params);

    if (params.period < 2) {
      throw new Error("Bollinger Bands: period must be at least 2");
    }

    if (params.standardDeviations <= 0) {
      throw new Error("Bollinger Bands: standardDeviations must be positive");
    }
  }

  calculate(candles: Candle[]): IndicatorResult<BollingerBandsResult>[] {
    this.validateCandleCount(candles);

    const sorted = this.sortCandles(candles);
    const closes = this.extractClosePrices(sorted);

    // Calculate SMA (middle band)
    const smaCalculator = new SMACalculator({ period: this.params.period });
    const smaResults = smaCalculator.calculate(sorted);

    const results: IndicatorResult<BollingerBandsResult>[] = [];

    // Calculate bands for each SMA point
    for (let i = 0; i < smaResults.length; i++) {
      const dataIndex = i + this.params.period - 1;
      const window = closes.slice(
        dataIndex - this.params.period + 1,
        dataIndex + 1
      );
      const sma = smaResults[i].value.sma;

      // Calculate standard deviation
      const stdDev = this.calculateStandardDeviation(window, sma);

      // Calculate bands
      const upper = sma + this.params.standardDeviations * stdDev;
      const lower = sma - this.params.standardDeviations * stdDev;
      const bandwidth = ((upper - lower) / sma) * 100;

      results.push({
        timestamp: smaResults[i].timestamp,
        value: {
          upper,
          middle: sma,
          lower,
          bandwidth,
        },
      });
    }

    return results;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    const squaredDiffs = values.map((val) => {
      const diff = val - mean;
      return diff * diff;
    });

    const variance =
      squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
}
