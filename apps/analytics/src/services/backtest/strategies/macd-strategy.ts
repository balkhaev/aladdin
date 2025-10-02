/**
 * MACD Strategy
 * Buy on bullish crossover, sell on bearish crossover
 */

import type { Candle } from "@aladdin/shared/types";
import { MACDCalculator } from "../../indicators/macd-calculator";
import { BaseStrategy, type TradeSignal } from "../base-strategy";

export type MACDStrategyParams = {
  fastPeriod: number; // Default: 12
  slowPeriod: number; // Default: 26
  signalPeriod: number; // Default: 9
};

const DEFAULT_FAST = 12;
const DEFAULT_SLOW = 26;
const DEFAULT_SIGNAL = 9;

/**
 * MACD Crossover Strategy
 */
export class MACDStrategy extends BaseStrategy<MACDStrategyParams> {
  private macdCalculator: MACDCalculator;
  private inPosition = false;
  private previousHistogram: number | null = null;

  constructor(params: Partial<MACDStrategyParams> = {}) {
    super({
      fastPeriod: params.fastPeriod ?? DEFAULT_FAST,
      slowPeriod: params.slowPeriod ?? DEFAULT_SLOW,
      signalPeriod: params.signalPeriod ?? DEFAULT_SIGNAL,
    });

    this.macdCalculator = new MACDCalculator({
      fastPeriod: this.params.fastPeriod,
      slowPeriod: this.params.slowPeriod,
      signalPeriod: this.params.signalPeriod,
    });
  }

  getName(): string {
    return "MACD";
  }

  getMinimumCandles(): number {
    return this.params.slowPeriod + this.params.signalPeriod;
  }

  analyze(candles: Candle[], currentIndex: number): TradeSignal {
    if (!this.canAnalyze(candles, currentIndex)) {
      return "HOLD";
    }

    // Calculate MACD up to current index
    const relevantCandles = candles.slice(0, currentIndex + 1);
    const macdResults = this.macdCalculator.calculate(relevantCandles);

    if (macdResults.length < 2) {
      return "HOLD";
    }

    // Get current and previous histogram values
    const currentMACD = macdResults[macdResults.length - 1].value;
    const previousMACD = macdResults[macdResults.length - 2].value;

    const currentHistogram = currentMACD.histogram;
    const previousHistogram = previousMACD.histogram;

    // Detect crossovers
    const bullishCrossover = previousHistogram <= 0 && currentHistogram > 0;
    const bearishCrossover = previousHistogram >= 0 && currentHistogram < 0;

    // Generate signals
    if (!this.inPosition && bullishCrossover) {
      // MACD crosses above signal line - buy
      this.inPosition = true;
      return "BUY";
    }

    if (this.inPosition && bearishCrossover) {
      // MACD crosses below signal line - sell
      this.inPosition = false;
      return "SELL";
    }

    return "HOLD";
  }

  getDescription(): string {
    return `MACD Crossover Strategy (fast=${this.params.fastPeriod}, slow=${this.params.slowPeriod}, signal=${this.params.signalPeriod})`;
  }
}
