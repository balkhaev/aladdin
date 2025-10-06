/**
 * Technical Analysis Service
 * Calculates technical indicators from price data
 */

import type { Logger } from "@aladdin/logger";
import type { PriceData, TechnicalIndicators } from "./types";

export class TechnicalAnalyzer {
  constructor(private logger: Logger) {}

  /**
   * Calculate all technical indicators
   */
  calculateIndicators(priceData: PriceData[]): TechnicalIndicators | null {
    if (priceData.length < 200) {
      return null;
    }

    const closes = priceData.map((d) => d.price);
    const highs = priceData.map((d) => d.high || d.price);
    const lows = priceData.map((d) => d.low || d.price);

    try {
      return {
        rsi: this.calculateRSI(closes, 14),
        macd: this.calculateMACD(closes).macd,
        macdSignal: this.calculateMACD(closes).signal,
        macdHistogram: this.calculateMACD(closes).histogram,
        ema20: this.calculateEMA(closes, 20),
        ema50: this.calculateEMA(closes, 50),
        ema200: this.calculateEMA(closes, 200),
        bbUpper: this.calculateBollingerBands(closes, 20).upper,
        bbMiddle: this.calculateBollingerBands(closes, 20).middle,
        bbLower: this.calculateBollingerBands(closes, 20).lower,
        stochK: this.calculateStochastic(highs, lows, closes).k,
        stochD: this.calculateStochastic(highs, lows, closes).d,
        atr: this.calculateATR(highs, lows, closes, 14),
        adx: this.calculateADX(highs, lows, closes, 14),
      };
    } catch (error) {
      this.logger.error("Failed to calculate indicators", { error });
      return null;
    }
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // Initial average
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    // Smoothed averages
    for (let i = period; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = (avgGain * (period - 1) + changes[i]) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
      }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(closes: number[]): {
    macd: number;
    signal: number;
    histogram: number;
  } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;

    // Calculate signal line (9-period EMA of MACD)
    const macdValues: number[] = [];
    for (let i = 26; i < closes.length; i++) {
      const e12 = this.calculateEMA(closes.slice(0, i + 1), 12);
      const e26 = this.calculateEMA(closes.slice(0, i + 1), 26);
      macdValues.push(e12 - e26);
    }

    const signal = this.calculateEMA(macdValues, 9);
    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(values: number[], period: number): number {
    if (values.length < period) return values.at(-1) || 0;

    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
      ema = (values[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(
    closes: number[],
    period: number
  ): { upper: number; middle: number; lower: number } {
    const sma = closes.slice(-period).reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = closes
      .slice(-period)
      .map((price) => (price - sma) ** 2);
    const variance =
      squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);

    return {
      upper: sma + 2 * stdDev,
      middle: sma,
      lower: sma - 2 * stdDev,
    };
  }

  /**
   * Calculate Stochastic Oscillator
   */
  private calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period = 14
  ): { k: number; d: number } {
    if (highs.length < period) return { k: 50, d: 50 };

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes.at(-1) || 0;

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    const k =
      highestHigh === lowestLow
        ? 50
        : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // D is 3-period SMA of K
    const kValues: number[] = [];
    for (let i = closes.length - 3; i < closes.length; i++) {
      const h = Math.max(...highs.slice(i - period + 1, i + 1));
      const l = Math.min(...lows.slice(i - period + 1, i + 1));
      const c = closes[i];
      kValues.push(h === l ? 50 : ((c - l) / (h - l)) * 100);
    }

    const d = kValues.reduce((a, b) => a + b, 0) / kValues.length;

    return { k, d };
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (highs.length < period + 1) return 0;

    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }

    return this.calculateEMA(trueRanges, period);
  }

  /**
   * Calculate ADX (Average Directional Index)
   */
  private calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    if (highs.length < period + 1) return 0;

    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];

      plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);

      const trueRange = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      tr.push(trueRange);
    }

    const plusDI =
      (this.calculateEMA(plusDM, period) / this.calculateEMA(tr, period)) * 100;
    const minusDI =
      (this.calculateEMA(minusDM, period) / this.calculateEMA(tr, period)) *
      100;

    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

    return dx;
  }

  /**
   * Calculate technical score (0-100)
   */
  calculateScore(indicators: TechnicalIndicators): number {
    let score = 50; // Neutral starting point

    // RSI scoring
    if (indicators.rsi < 30)
      score += 15; // Oversold
    else if (indicators.rsi > 70)
      score -= 15; // Overbought
    else if (indicators.rsi < 40) score += 7;
    else if (indicators.rsi > 60) score -= 7;

    // MACD scoring
    if (indicators.macdHistogram > 0)
      score += 10; // Bullish
    else score -= 10; // Bearish

    // EMA trend scoring
    const currentPrice = indicators.ema20;
    if (
      currentPrice > indicators.ema50 &&
      indicators.ema50 > indicators.ema200
    ) {
      score += 15; // Strong uptrend
    } else if (
      currentPrice < indicators.ema50 &&
      indicators.ema50 < indicators.ema200
    ) {
      score -= 15; // Strong downtrend
    }

    // Bollinger Bands scoring
    const bbPosition =
      (currentPrice - indicators.bbLower) /
      (indicators.bbUpper - indicators.bbLower);
    if (bbPosition < 0.2)
      score += 10; // Near lower band
    else if (bbPosition > 0.8) score -= 10; // Near upper band

    // Stochastic scoring
    if (indicators.stochK < 20 && indicators.stochD < 20) score += 5;
    else if (indicators.stochK > 80 && indicators.stochD > 80) score -= 5;

    // ADX strength confirmation
    if (indicators.adx > 25) {
      // Strong trend - amplify score
      const amplification = (indicators.adx - 25) / 75;
      if (score > 50) score += amplification * 10;
      else if (score < 50) score -= amplification * 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}
