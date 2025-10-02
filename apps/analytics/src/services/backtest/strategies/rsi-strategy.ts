/**
 * RSI Strategy
 * Buy when RSI is oversold, sell when RSI is overbought
 */

import type { Candle } from "@aladdin/shared/types";
import { RSICalculator } from "../../indicators/rsi-calculator";
import { BaseStrategy, type TradeSignal } from "../base-strategy";

export type RSIStrategyParams = {
  period: number; // RSI period (default: 14)
  oversoldThreshold: number; // Buy signal (default: 30)
  overboughtThreshold: number; // Sell signal (default: 70)
};

const DEFAULT_PERIOD = 14;
const DEFAULT_OVERSOLD = 30;
const DEFAULT_OVERBOUGHT = 70;

/**
 * RSI Mean Reversion Strategy
 */
export class RSIStrategy extends BaseStrategy<RSIStrategyParams> {
  private rsiCalculator: RSICalculator;
  private inPosition = false;

  constructor(params: Partial<RSIStrategyParams> = {}) {
    super({
      period: params.period ?? DEFAULT_PERIOD,
      oversoldThreshold: params.oversoldThreshold ?? DEFAULT_OVERSOLD,
      overboughtThreshold: params.overboughtThreshold ?? DEFAULT_OVERBOUGHT,
    });

    this.rsiCalculator = new RSICalculator({ period: this.params.period });
  }

  getName(): string {
    return "RSI";
  }

  getMinimumCandles(): number {
    return this.params.period + 1;
  }

  protected validateParams(params: RSIStrategyParams): void {
    super.validateParams(params);

    if (params.oversoldThreshold >= params.overboughtThreshold) {
      throw new Error(
        "RSI Strategy: oversoldThreshold must be less than overboughtThreshold"
      );
    }

    if (params.oversoldThreshold < 0 || params.overboughtThreshold > 100) {
      throw new Error("RSI Strategy: thresholds must be between 0 and 100");
    }
  }

  analyze(candles: Candle[], currentIndex: number): TradeSignal {
    if (!this.canAnalyze(candles, currentIndex)) {
      return "HOLD";
    }

    // Calculate RSI up to current index
    const relevantCandles = candles.slice(0, currentIndex + 1);
    const rsiResults = this.rsiCalculator.calculate(relevantCandles);

    if (rsiResults.length === 0) {
      return "HOLD";
    }

    // Get latest RSI value
    const latestRSI = rsiResults[rsiResults.length - 1].value.rsi;

    // Generate signals
    if (!this.inPosition && latestRSI <= this.params.oversoldThreshold) {
      // RSI is oversold - buy signal
      this.inPosition = true;
      return "BUY";
    }

    if (this.inPosition && latestRSI >= this.params.overboughtThreshold) {
      // RSI is overbought - sell signal
      this.inPosition = false;
      return "SELL";
    }

    return "HOLD";
  }

  getDescription(): string {
    return `RSI Mean Reversion Strategy (period=${this.params.period}, oversold=${this.params.oversoldThreshold}, overbought=${this.params.overboughtThreshold})`;
  }
}
