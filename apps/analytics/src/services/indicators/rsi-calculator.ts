/**
 * RSI (Relative Strength Index) Calculator
 * Momentum oscillator that measures the speed and magnitude of price changes
 */

import type { Candle } from "@aladdin/shared/types";
import { BaseIndicator, type IndicatorResult } from "./base-indicator";

export type RSIParams = {
  period: number; // Default: 14
};

export type RSIResult = {
  rsi: number;
  signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
};

const DEFAULT_RSI_PERIOD = 14;
const OVERBOUGHT_THRESHOLD = 70;
const OVERSOLD_THRESHOLD = 30;

/**
 * RSI Calculator
 */
export class RSICalculator extends BaseIndicator<RSIParams, RSIResult> {
  constructor(params: Partial<RSIParams> = {}) {
    super({
      period: params.period ?? DEFAULT_RSI_PERIOD,
    });
  }

  getName(): string {
    return "RSI";
  }

  getMinimumCandles(): number {
    return this.params.period + 1;
  }

  protected validateParams(params: RSIParams): void {
    super.validateParams(params);

    if (params.period < 2) {
      throw new Error("RSI: period must be at least 2");
    }
  }

  calculate(candles: Candle[]): IndicatorResult<RSIResult>[] {
    this.validateCandleCount(candles);

    const sorted = this.sortCandles(candles);
    const closes = this.extractClosePrices(sorted);
    const results: IndicatorResult<RSIResult>[] = [];

    // Calculate price changes
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    // First RSI using SMA
    const { avgGain, avgLoss } = this.calculateInitialAverages(changes);
    let currentAvgGain = avgGain;
    let currentAvgLoss = avgLoss;

    // Calculate first RSI
    if (sorted.length >= this.params.period + 1) {
      const firstRSI = this.calculateRSI(currentAvgGain, currentAvgLoss);
      results.push({
        timestamp: sorted[this.params.period].timestamp,
        value: {
          rsi: firstRSI,
          signal: this.getSignal(firstRSI),
        },
      });
    }

    // Calculate subsequent RSI values using EMA
    for (let i = this.params.period + 1; i < sorted.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      // Smoothed averages (EMA-like)
      currentAvgGain =
        (currentAvgGain * (this.params.period - 1) + gain) / this.params.period;
      currentAvgLoss =
        (currentAvgLoss * (this.params.period - 1) + loss) / this.params.period;

      const rsi = this.calculateRSI(currentAvgGain, currentAvgLoss);

      results.push({
        timestamp: sorted[i].timestamp,
        value: {
          rsi,
          signal: this.getSignal(rsi),
        },
      });
    }

    return results;
  }

  /**
   * Calculate initial average gain and loss using SMA
   */
  private calculateInitialAverages(changes: number[]): {
    avgGain: number;
    avgLoss: number;
  } {
    let sumGain = 0;
    let sumLoss = 0;

    for (let i = 0; i < this.params.period; i++) {
      if (changes[i] > 0) {
        sumGain += changes[i];
      } else {
        sumLoss += -changes[i];
      }
    }

    return {
      avgGain: sumGain / this.params.period,
      avgLoss: sumLoss / this.params.period,
    };
  }

  /**
   * Calculate RSI from average gain and loss
   */
  private calculateRSI(avgGain: number, avgLoss: number): number {
    if (avgLoss === 0) {
      return 100;
    }

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Get RSI signal based on thresholds
   */
  private getSignal(rsi: number): "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL" {
    if (rsi >= OVERBOUGHT_THRESHOLD) {
      return "OVERBOUGHT";
    }
    if (rsi <= OVERSOLD_THRESHOLD) {
      return "OVERSOLD";
    }
    return "NEUTRAL";
  }
}
