/**
 * Technical Indicators Calculation
 * Client-side calculation for chart overlays
 */

import type { UTCTimestamp } from "lightweight-charts";

const MILLISECONDS_TO_SECONDS = 1000;
const MILLISECONDS_THRESHOLD = 10_000_000_000;
const EMA_MULTIPLIER_DIVISOR = 2;
const EMA_MULTIPLIER_OFFSET = 1;
const POWER_OF_TWO = 2;

export type CandleData = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorData = {
  time: UTCTimestamp;
  value: number;
};

/**
 * Convert timestamp to Unix timestamp in seconds
 * Handles both milliseconds and seconds format
 */
function convertTimestamp(ts: number): number {
  // If timestamp is in milliseconds (greater than threshold), convert to seconds
  if (ts > MILLISECONDS_THRESHOLD) {
    return Math.floor(ts / MILLISECONDS_TO_SECONDS);
  }
  // Already in seconds
  return ts;
}

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(
  candles: CandleData[],
  period: number
): IndicatorData[] {
  const result: IndicatorData[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
    const avg = sum / period;

    result.push({
      time: convertTimestamp(candles[i].timestamp) as UTCTimestamp,
      value: avg,
    });
  }

  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 */
export function calculateEMA(
  candles: CandleData[],
  period: number
): IndicatorData[] {
  const result: IndicatorData[] = [];
  const multiplier = EMA_MULTIPLIER_DIVISOR / (period + EMA_MULTIPLIER_OFFSET);

  // Start with SMA for the first value
  let ema = 0;
  for (let i = 0; i < period && i < candles.length; i++) {
    ema += candles[i].close;
  }
  ema /= Math.min(period, candles.length);

  // Calculate EMA for remaining values
  for (let i = period - 1; i < candles.length; i++) {
    if (i === period - 1) {
      result.push({
        time: convertTimestamp(candles[i].timestamp) as UTCTimestamp,
        value: ema,
      });
    } else {
      ema = (candles[i].close - ema) * multiplier + ema;
      result.push({
        time: convertTimestamp(candles[i].timestamp) as UTCTimestamp,
        value: ema,
      });
    }
  }

  return result;
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(
  candles: CandleData[],
  period = 20,
  stdDev = 2
): {
  upper: IndicatorData[];
  middle: IndicatorData[];
  lower: IndicatorData[];
} {
  const upper: IndicatorData[] = [];
  const middle: IndicatorData[] = [];
  const lower: IndicatorData[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);

    // Calculate SMA (middle band)
    const sum = slice.reduce((acc, candle) => acc + candle.close, 0);
    const sma = sum / period;

    // Calculate standard deviation
    const squaredDiffs = slice.map(
      (candle) => (candle.close - sma) ** POWER_OF_TWO
    );
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const time = convertTimestamp(candles[i].timestamp) as UTCTimestamp;

    middle.push({ time, value: sma });
    upper.push({ time, value: sma + stdDev * standardDeviation });
    lower.push({ time, value: sma - stdDev * standardDeviation });
  }

  return { upper, middle, lower };
}
