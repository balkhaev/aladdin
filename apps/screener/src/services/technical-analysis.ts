import type { Logger } from "@aladdin/shared/logger";
import type { Candle } from "@aladdin/shared/types";
import {
  ADX,
  ATR,
  BollingerBands,
  EMA,
  MACD,
  RSI,
  SMA,
  Stochastic,
} from "technicalindicators";
import type { TechnicalAnalysisResult } from "../types";

// Константы для индикаторов
const RSI_PERIOD = 14;
const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const MACD_FAST_PERIOD = 12;
const MACD_SLOW_PERIOD = 26;
const MACD_SIGNAL_PERIOD = 9;
const EMA_SHORT = 20;
const EMA_MEDIUM = 50;
const EMA_LONG = 200;
const BB_PERIOD = 20;
const BB_STD_DEV = 2;
const STOCH_PERIOD = 14;
const STOCH_SIGNAL = 3;
const STOCH_OVERSOLD = 20;
const STOCH_OVERBOUGHT = 80;
const ATR_PERIOD = 14;
const ADX_PERIOD = 14;
const ADX_STRONG = 25;
const ADX_MODERATE = 15;
const MIN_CANDLES = 200;
const DEFAULT_RSI = 50;

// Константы для скоринга
const SCORE_NEUTRAL = 50;
const SCORE_RSI_OVERSOLD = 15;
const SCORE_RSI_OVERBOUGHT = -15;
const SCORE_MACD_BULLISH = 10;
const SCORE_MACD_BEARISH = -10;
const SCORE_STRONG_UPTREND = 20;
const SCORE_STRONG_DOWNTREND = -20;
const SCORE_UPTREND = 10;
const SCORE_DOWNTREND = -10;
const SCORE_BB_OVERSOLD = 10;
const SCORE_BB_OVERBOUGHT = -10;
const SCORE_STOCH_EXTREME = 5;
const SCORE_MIN = 0;
const SCORE_MAX = 100;
const SCORE_STRONG_BUY = 70;
const SCORE_BUY = 60;
const SCORE_HOLD = 40;
const SCORE_SELL = 30;

// Константы для волатильности
const ATR_HIGH_THRESHOLD = 3;
const ATR_MEDIUM_THRESHOLD = 1.5;
const HUNDRED_PERCENT = 100;

export class TechnicalAnalysisService {
  constructor(private logger: Logger) {}

  /**
   * Анализ свечей и расчет индикаторов
   */
  analyze(
    symbol: string,
    candles: Candle[],
    timeframe: string,
    stats: {
      priceChange: number;
      priceChangePercent: number;
      lastPrice: number;
      volume: number;
    }
  ): TechnicalAnalysisResult | null {
    try {
      if (candles.length < MIN_CANDLES) {
        this.logger.warn("Not enough candles for analysis", {
          symbol,
          candlesCount: candles.length,
        });
        return null;
      }

      const closes = candles.map((c) => c.close);
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);

      // RSI (Relative Strength Index)
      const rsiValues = RSI.calculate({ values: closes, period: RSI_PERIOD });
      const rsi = rsiValues.at(-1) ?? DEFAULT_RSI;

      // MACD
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: MACD_FAST_PERIOD,
        slowPeriod: MACD_SLOW_PERIOD,
        signalPeriod: MACD_SIGNAL_PERIOD,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const macd = macdValues.at(-1);

      // EMAs
      const ema20Values = EMA.calculate({ values: closes, period: EMA_SHORT });
      const ema50Values = EMA.calculate({ values: closes, period: EMA_MEDIUM });
      const ema200Values = EMA.calculate({ values: closes, period: EMA_LONG });

      // SMAs
      const sma20Values = SMA.calculate({ values: closes, period: EMA_SHORT });
      const sma50Values = SMA.calculate({ values: closes, period: EMA_MEDIUM });
      const sma200Values = SMA.calculate({ values: closes, period: EMA_LONG });

      // Bollinger Bands
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: BB_PERIOD,
        stdDev: BB_STD_DEV,
      });
      const bb = bbValues.at(-1);

      // Stochastic
      const stochValues = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: STOCH_PERIOD,
        signalPeriod: STOCH_SIGNAL,
      });
      const stoch = stochValues.at(-1);

      // ATR (Average True Range)
      const atrValues = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: ATR_PERIOD,
      });
      const atr = atrValues.at(-1) ?? 0;

      // ADX (Average Directional Index)
      const adxValues = ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: ADX_PERIOD,
      });
      const adx = adxValues.at(-1)?.adx ?? 0;

      // Определение тренда и сигналов
      const currentPrice = closes.at(-1) ?? 0;
      const ema20 = ema20Values.at(-1) ?? 0;
      const ema50 = ema50Values.at(-1) ?? 0;
      const ema200 = ema200Values.at(-1) ?? 0;

      const signals = this.generateSignals({
        currentPrice,
        rsi,
        macd,
        ema20,
        ema50,
        ema200,
        bb,
        stoch,
        adx,
        atr,
      });

      return {
        symbol,
        timestamp: Date.now(),
        timeframe,
        indicators: {
          rsi,
          macd: macd
            ? {
                macd: macd.MACD ?? 0,
                signal: macd.signal ?? 0,
                histogram: macd.histogram ?? 0,
              }
            : undefined,
          ema20,
          ema50,
          ema200,
          sma20: sma20Values.at(-1),
          sma50: sma50Values.at(-1),
          sma200: sma200Values.at(-1),
          bollingerBands: bb
            ? {
                upper: bb.upper ?? 0,
                middle: bb.middle ?? 0,
                lower: bb.lower ?? 0,
              }
            : undefined,
          stochastic: stoch
            ? {
                k: stoch.k ?? 0,
                d: stoch.d ?? 0,
              }
            : undefined,
          atr,
          adx,
        },
        signals,
        price: {
          current: currentPrice,
          change24h: stats.priceChange,
          changePercent24h: stats.priceChangePercent,
          volume24h: stats.volume,
        },
      };
    } catch (error) {
      this.logger.error("Failed to analyze symbol", { symbol, error });
      return null;
    }
  }

  /**
   * Генерация торговых сигналов на основе индикаторов
   */
  private generateSignals(params: {
    currentPrice: number;
    rsi: number;
    macd: { MACD?: number; signal?: number; histogram?: number } | undefined;
    ema20: number;
    ema50: number;
    ema200: number;
    bb:
      | {
          upper?: number;
          middle?: number;
          lower?: number;
        }
      | undefined;
    stoch: { k?: number; d?: number } | undefined;
    adx: number;
    atr: number;
  }): TechnicalAnalysisResult["signals"] {
    const {
      currentPrice,
      rsi,
      macd,
      ema20,
      ema50,
      ema200,
      bb,
      stoch,
      adx,
      atr,
    } = params;

    let score = SCORE_NEUTRAL;

    // RSI Analysis
    if (rsi < RSI_OVERSOLD) {
      score += SCORE_RSI_OVERSOLD;
    } else if (rsi > RSI_OVERBOUGHT) {
      score += SCORE_RSI_OVERBOUGHT;
    }

    // MACD Analysis
    if (macd?.MACD && macd?.signal) {
      if (macd.MACD > macd.signal) {
        score += SCORE_MACD_BULLISH;
      } else {
        score += SCORE_MACD_BEARISH;
      }
    }

    // EMA Trend Analysis
    if (currentPrice > ema20 && ema20 > ema50 && ema50 > ema200) {
      score += SCORE_STRONG_UPTREND;
    } else if (currentPrice < ema20 && ema20 < ema50 && ema50 < ema200) {
      score += SCORE_STRONG_DOWNTREND;
    } else if (currentPrice > ema50) {
      score += SCORE_UPTREND;
    } else if (currentPrice < ema50) {
      score += SCORE_DOWNTREND;
    }

    // Bollinger Bands
    if (bb?.lower && bb?.upper && bb?.middle) {
      if (currentPrice < bb.lower) {
        score += SCORE_BB_OVERSOLD;
      } else if (currentPrice > bb.upper) {
        score += SCORE_BB_OVERBOUGHT;
      }
    }

    // Stochastic
    if (stoch?.k !== undefined && stoch?.d !== undefined) {
      if (stoch.k < STOCH_OVERSOLD && stoch.d < STOCH_OVERSOLD) {
        score += SCORE_STOCH_EXTREME;
      } else if (stoch.k > STOCH_OVERBOUGHT && stoch.d > STOCH_OVERBOUGHT) {
        score -= SCORE_STOCH_EXTREME;
      }
    }

    // Determine trend
    const trend = this.determineTrend(score);
    const momentum = this.determineMomentum(adx);
    const volatility = this.determineVolatility(atr, currentPrice);
    const recommendation = this.determineRecommendation(score);

    return {
      trend,
      strength: Math.min(SCORE_MAX, Math.max(SCORE_MIN, score)),
      momentum,
      volatility,
      recommendation,
    };
  }

  private determineTrend(score: number): "BULLISH" | "BEARISH" | "NEUTRAL" {
    if (score >= SCORE_BUY) {
      return "BULLISH";
    }
    if (score <= SCORE_HOLD) {
      return "BEARISH";
    }
    return "NEUTRAL";
  }

  private determineMomentum(adx: number): "STRONG" | "MODERATE" | "WEAK" {
    if (adx > ADX_STRONG) {
      return "STRONG";
    }
    if (adx > ADX_MODERATE) {
      return "MODERATE";
    }
    return "WEAK";
  }

  private determineVolatility(
    atr: number,
    currentPrice: number
  ): "HIGH" | "MEDIUM" | "LOW" {
    const atrPercent = (atr / currentPrice) * HUNDRED_PERCENT;
    if (atrPercent > ATR_HIGH_THRESHOLD) {
      return "HIGH";
    }
    if (atrPercent > ATR_MEDIUM_THRESHOLD) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private determineRecommendation(
    score: number
  ): TechnicalAnalysisResult["signals"]["recommendation"] {
    if (score >= SCORE_STRONG_BUY) {
      return "STRONG_BUY";
    }
    if (score >= SCORE_BUY) {
      return "BUY";
    }
    if (score >= SCORE_HOLD) {
      return "HOLD";
    }
    if (score >= SCORE_SELL) {
      return "SELL";
    }
    return "STRONG_SELL";
  }
}
