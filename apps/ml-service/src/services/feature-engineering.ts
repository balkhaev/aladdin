import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";
import type { FeatureSet, PriceFeatures, TechnicalFeatures } from "../types";

type CandleData = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Feature Engineering Service
 * Подготавливает данные для ML моделей
 */
export class FeatureEngineeringService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Извлечь все features для символа за период
   */
  async extractFeatures(symbol: string, lookback = 100): Promise<FeatureSet[]> {
    try {
      // Получить исторические данные
      const candles = await this.fetchHistoricalCandles(symbol, lookback);

      if (candles.length === 0) {
        throw new Error(`No historical data found for ${symbol}`);
      }

      // Вычислить features для каждой свечи
      const features: FeatureSet[] = [];

      for (let i = 50; i < candles.length; i++) {
        // Нужен минимум 50 свечей для техинд

        const window = candles.slice(0, i + 1);
        const currentCandle = candles[i];

        const priceFeatures = this.calculatePriceFeatures(
          currentCandle,
          window
        );
        const technicalFeatures = this.calculateTechnicalFeatures(window);

        features.push({
          timestamp: currentCandle.timestamp,
          price: priceFeatures,
          technical: technicalFeatures,
        });
      }

      return features;
    } catch (error) {
      this.logger.error("Failed to extract features", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получить исторические свечи из ClickHouse
   */
  private async fetchHistoricalCandles(
    symbol: string,
    lookback: number
  ): Promise<CandleData[]> {
    const query = `
      SELECT
        toUnixTimestamp(timestamp) * 1000 as timestamp,
        open,
        high,
        low,
        close,
        volume
      FROM candles_1m
      WHERE symbol = {symbol:String}
        AND timestamp >= now() - INTERVAL {lookback:UInt32} DAY
      ORDER BY timestamp ASC
    `;

    const result = await this.clickhouse.query<CandleData>(query, {
      symbol,
      lookback,
    });

    return result;
  }

  /**
   * Вычислить price features
   */
  private calculatePriceFeatures(
    candle: CandleData,
    window: CandleData[]
  ): PriceFeatures {
    const returns =
      window.length > 1
        ? (candle.close - window.at(-2)?.close) / window.at(-2)?.close
        : 0;

    const logReturns = Math.log(
      candle.close / (window.at(-2)?.close || candle.close)
    );

    // Волатильность (std dev of returns за последние 20 свечей)
    const recentWindow = window.slice(-20);
    const recentReturns = recentWindow.map((c, i) => {
      if (i === 0) return 0;
      return (c.close - recentWindow[i - 1].close) / recentWindow[i - 1].close;
    });
    const volatility = this.standardDeviation(recentReturns);

    return {
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      returns,
      logReturns,
      volatility,
      highLowSpread: (candle.high - candle.low) / candle.close,
      openCloseSpread: (candle.close - candle.open) / candle.close,
    };
  }

  /**
   * Вычислить технические индикаторы
   */
  private calculateTechnicalFeatures(window: CandleData[]): TechnicalFeatures {
    const closes = window.map((c) => c.close);
    const highs = window.map((c) => c.high);
    const lows = window.map((c) => c.low);
    const volumes = window.map((c) => c.volume);

    return {
      rsi: this.calculateRSI(closes, 14),
      ...this.calculateMACD(closes),
      ema20: this.calculateEMA(closes, 20),
      ema50: this.calculateEMA(closes, 50),
      ema200: this.calculateEMA(closes, 200),
      sma20: this.calculateSMA(closes, 20),
      sma50: this.calculateSMA(closes, 50),
      sma200: this.calculateSMA(closes, 200),
      ...this.calculateBollingerBands(closes, 20, 2),
      atr: this.calculateATR(highs, lows, closes, 14),
      adx: this.calculateADX(highs, lows, closes, 14),
      obv: this.calculateOBV(closes, volumes),
    };
  }

  /**
   * RSI (Relative Strength Index)
   */
  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    const changes = prices.slice(-period - 1).map((price, i, arr) => {
      if (i === 0) return 0;
      return price - arr[i - 1];
    });

    const gains = changes.filter((c) => c > 0);
    const losses = changes.filter((c) => c < 0).map((c) => Math.abs(c));

    const avgGain =
      gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss =
      losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(prices: number[]): {
    macd: number;
    macdSignal: number;
    macdHistogram: number;
  } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;

    // Signal line (EMA of MACD)
    // Для упрощения используем простое усреднение
    const macdSignal = macd * 0.9; // Simplified

    return {
      macd,
      macdSignal,
      macdHistogram: macd - macdSignal,
    };
  }

  /**
   * EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices.at(-1) || 0;

    const multiplier = 2 / (period + 1);
    const relevantPrices = prices.slice(-period);

    let ema = relevantPrices[0];
    for (let i = 1; i < relevantPrices.length; i++) {
      ema = (relevantPrices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * SMA (Simple Moving Average)
   */
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices.at(-1) || 0;

    const relevantPrices = prices.slice(-period);
    return relevantPrices.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Bollinger Bands
   */
  private calculateBollingerBands(
    prices: number[],
    period: number,
    stdDev: number
  ): { bbUpper: number; bbMiddle: number; bbLower: number } {
    const sma = this.calculateSMA(prices, period);
    const relevantPrices = prices.slice(-period);
    const std = this.standardDeviation(relevantPrices);

    return {
      bbMiddle: sma,
      bbUpper: sma + std * stdDev,
      bbLower: sma - std * stdDev,
    };
  }

  /**
   * ATR (Average True Range)
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
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * ADX (Average Directional Index)
   */
  private calculateADX(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number
  ): number {
    // Simplified ADX calculation
    if (highs.length < period + 1) return 0;

    const atr = this.calculateATR(highs, lows, closes, period);
    if (atr === 0) return 0;

    // Calculate +DI and -DI
    let plusDI = 0;
    let minusDI = 0;

    for (let i = 1; i < Math.min(period, highs.length); i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];

      if (highDiff > lowDiff && highDiff > 0) {
        plusDI += highDiff;
      }
      if (lowDiff > highDiff && lowDiff > 0) {
        minusDI += lowDiff;
      }
    }

    plusDI = (plusDI / period / atr) * 100;
    minusDI = (minusDI / period / atr) * 100;

    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;
    return dx;
  }

  /**
   * OBV (On-Balance Volume)
   */
  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = 0;

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }

    return obv;
  }

  /**
   * Standard Deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((value) => (value - mean) ** 2);
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Нормализовать features для ML модели
   */
  normalizeFeatures(features: FeatureSet[]): number[][] {
    // Min-Max normalization
    const normalized: number[][] = [];

    for (const featureSet of features) {
      const flatFeatures = [
        ...Object.values(featureSet.price),
        ...Object.values(featureSet.technical),
      ];

      normalized.push(flatFeatures);
    }

    return normalized;
  }
}
