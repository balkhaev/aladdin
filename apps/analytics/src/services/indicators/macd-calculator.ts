/**
 * MACD (Moving Average Convergence Divergence) Calculator
 * Trend-following momentum indicator
 */

import type { Candle } from "@aladdin/core";
import { BaseIndicator, type IndicatorResult } from "./base-indicator";
import { EMACalculator } from "./ema-calculator";

export type MACDParams = {
  fastPeriod: number; // Default: 12
  slowPeriod: number; // Default: 26
  signalPeriod: number; // Default: 9
};

export type MACDResult = {
  macd: number; // MACD line (fast EMA - slow EMA)
  signal: number; // Signal line (EMA of MACD)
  histogram: number; // MACD - Signal
};

const DEFAULT_FAST_PERIOD = 12;
const DEFAULT_SLOW_PERIOD = 26;
const DEFAULT_SIGNAL_PERIOD = 9;

/**
 * MACD Calculator
 */
export class MACDCalculator extends BaseIndicator<MACDParams, MACDResult> {
  constructor(params: Partial<MACDParams> = {}) {
    super({
      fastPeriod: params.fastPeriod ?? DEFAULT_FAST_PERIOD,
      slowPeriod: params.slowPeriod ?? DEFAULT_SLOW_PERIOD,
      signalPeriod: params.signalPeriod ?? DEFAULT_SIGNAL_PERIOD,
    });
  }

  getName(): string {
    return "MACD";
  }

  getMinimumCandles(): number {
    return this.params.slowPeriod + this.params.signalPeriod;
  }

  protected validateParams(params: MACDParams): void {
    super.validateParams(params);

    if (params.fastPeriod >= params.slowPeriod) {
      throw new Error("MACD: fastPeriod must be less than slowPeriod");
    }

    if (params.signalPeriod < 1) {
      throw new Error("MACD: signalPeriod must be at least 1");
    }
  }

  calculate(candles: Candle[]): IndicatorResult<MACDResult>[] {
    this.validateCandleCount(candles);

    const sorted = this.sortCandles(candles);

    // Calculate fast and slow EMAs
    const fastEMA = new EMACalculator({ period: this.params.fastPeriod });
    const slowEMA = new EMACalculator({ period: this.params.slowPeriod });

    const fastEMAResults = fastEMA.calculate(sorted);
    const slowEMAResults = slowEMA.calculate(sorted);

    // Calculate MACD line (fast EMA - slow EMA)
    const macdValues: number[] = [];
    const macdTimestamps: number[] = [];

    // Align EMAs by timestamp
    for (const slowResult of slowEMAResults) {
      const fastResult = fastEMAResults.find(
        (f) => f.timestamp === slowResult.timestamp
      );
      if (fastResult) {
        macdValues.push(fastResult.value.ema - slowResult.value.ema);
        macdTimestamps.push(slowResult.timestamp);
      }
    }

    // Calculate Signal line (EMA of MACD)
    const signalValues: number[] = [];
    const multiplier = this.getEMAMultiplier(this.params.signalPeriod);

    // First signal is SMA of first signalPeriod MACD values
    let previousSignal = this.calculateSMA(
      macdValues.slice(0, this.params.signalPeriod),
      this.params.signalPeriod
    );
    signalValues.push(previousSignal);

    // Calculate subsequent signals
    for (let i = this.params.signalPeriod; i < macdValues.length; i++) {
      const signal =
        (macdValues[i] - previousSignal) * multiplier + previousSignal;
      signalValues.push(signal);
      previousSignal = signal;
    }

    // Build results with histogram
    const results: IndicatorResult<MACDResult>[] = [];
    const startIndex = this.params.signalPeriod - 1;

    for (let i = 0; i < signalValues.length; i++) {
      const macdIndex = startIndex + i;
      const macd = macdValues[macdIndex];
      const signal = signalValues[i];
      const histogram = macd - signal;

      results.push({
        timestamp: macdTimestamps[macdIndex],
        value: {
          macd,
          signal,
          histogram,
        },
      });
    }

    return results;
  }
}
