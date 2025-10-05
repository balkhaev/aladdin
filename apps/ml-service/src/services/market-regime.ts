import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";
import type {
  MarketRegime,
  MarketRegimeRequest,
  MarketRegimeResult,
} from "../types";

type CandleData = {
  timestamp: number;
  close: number;
  volume: number;
  high: number;
  low: number;
};

/**
 * Market Regime Detection Service
 * Определяет текущее состояние рынка: BULL, BEAR или SIDEWAYS
 */
export class MarketRegimeService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Определить текущий режим рынка
   */
  async detectRegime(params: MarketRegimeRequest): Promise<MarketRegimeResult> {
    try {
      const { symbol, lookback = 30 } = params;

      // Получить исторические данные
      const candles = await this.fetchHistoricalCandles(symbol, lookback);

      if (candles.length < 20) {
        throw new Error("Insufficient data for regime detection");
      }

      // Вычислить индикаторы
      const trend = this.calculateTrend(candles);
      const volatility = this.calculateVolatility(candles);
      const volume = this.calculateVolumeProfile(candles);
      const momentum = this.calculateMomentum(candles);

      // Определить режим на основе индикаторов
      const currentRegime = this.classifyRegime(trend, volatility, momentum);
      const confidence = this.calculateConfidence(trend, volatility, momentum);

      // Вычислить историю режимов
      const regimeHistory = this.calculateRegimeHistory(candles);

      // Предсказать следующий режим
      const nextRegimeProb = this.predictNextRegime(
        currentRegime,
        trend,
        volatility,
        momentum
      );

      return {
        symbol,
        currentRegime,
        confidence,
        regimeHistory,
        indicators: {
          trend,
          volatility,
          volume,
          momentum,
        },
        nextRegimeProb,
        generatedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error("Failed to detect market regime", {
        symbol: params.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Получить исторические свечи
   */
  private async fetchHistoricalCandles(
    symbol: string,
    lookback: number
  ): Promise<CandleData[]> {
    const query = `
      SELECT
        toUnixTimestamp(timestamp) * 1000 as timestamp,
        close,
        volume,
        high,
        low
      FROM candles_1h
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
   * Вычислить тренд (-1 to 1)
   */
  private calculateTrend(candles: CandleData[]): number {
    const closes = candles.map((c) => c.close);

    // Linear regression slope
    const n = closes.length;
    const xMean = (n - 1) / 2;
    const yMean = closes.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (closes[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = numerator / denominator;

    // Normalize slope to [-1, 1]
    const avgPrice = yMean;
    const normalizedSlope = (slope / avgPrice) * n;

    return Math.max(-1, Math.min(1, normalizedSlope));
  }

  /**
   * Вычислить волатильность
   */
  private calculateVolatility(candles: CandleData[]): number {
    const closes = candles.map((c) => c.close);
    const returns = closes
      .slice(1)
      .map((price, i) => Math.log(price / closes[i]));

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize volatility (assuming hourly candles)
    const HOURS_PER_YEAR = 8760;
    return stdDev * Math.sqrt(HOURS_PER_YEAR);
  }

  /**
   * Вычислить volume profile
   */
  private calculateVolumeProfile(candles: CandleData[]): number {
    const volumes = candles.map((c) => c.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

    const currentVolume = volumes.at(-1) || 0;

    return currentVolume / avgVolume;
  }

  /**
   * Вычислить momentum
   */
  private calculateMomentum(candles: CandleData[]): number {
    const closes = candles.map((c) => c.close);

    // Rate of change over last 14 periods
    const PERIOD = 14;
    const currentPrice = closes.at(-1) || 0;
    const pastPrice = closes.at(-PERIOD) || closes[0];

    return (currentPrice - pastPrice) / pastPrice;
  }

  /**
   * Классифицировать режим на основе индикаторов
   */
  private classifyRegime(
    trend: number,
    volatility: number,
    momentum: number
  ): MarketRegime {
    // BULL: positive trend, high momentum, moderate volatility
    const bullScore = trend * 0.5 + momentum * 0.3 + (1 - volatility / 2) * 0.2;

    // BEAR: negative trend, negative momentum, high volatility
    const bearScore = -trend * 0.5 - momentum * 0.3 + volatility * 0.2;

    // SIDEWAYS: low trend, low momentum
    const sidewaysScore = 1 - Math.abs(trend) - Math.abs(momentum);

    const scores = {
      BULL: bullScore,
      BEAR: bearScore,
      SIDEWAYS: sidewaysScore,
    };

    // Return regime with highest score
    const entries = Object.entries(scores) as [MarketRegime, number][];
    const maxEntry = entries.reduce((prev, current) =>
      current[1] > prev[1] ? current : prev
    );

    return maxEntry[0];
  }

  /**
   * Вычислить confidence классификации
   */
  private calculateConfidence(
    trend: number,
    volatility: number,
    momentum: number
  ): number {
    // Higher confidence when indicators are aligned
    const trendStrength = Math.abs(trend);
    const momentumStrength = Math.abs(momentum);
    const stabilityFactor = 1 - Math.min(volatility, 1);

    const confidence =
      trendStrength * 0.4 + momentumStrength * 0.3 + stabilityFactor * 0.3;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Вычислить историю режимов
   */
  private calculateRegimeHistory(candles: CandleData[]): Array<{
    timestamp: number;
    regime: MarketRegime;
    confidence: number;
  }> {
    const history: Array<{
      timestamp: number;
      regime: MarketRegime;
      confidence: number;
    }> = [];

    // Analyze regime every 7 days
    const WINDOW = 24 * 7; // 7 days of hourly candles

    for (let i = WINDOW; i < candles.length; i += WINDOW) {
      const window = candles.slice(i - WINDOW, i);

      const trend = this.calculateTrend(window);
      const volatility = this.calculateVolatility(window);
      const momentum = this.calculateMomentum(window);

      const regime = this.classifyRegime(trend, volatility, momentum);
      const confidence = this.calculateConfidence(trend, volatility, momentum);

      history.push({
        timestamp: window.at(-1)?.timestamp,
        regime,
        confidence,
      });
    }

    return history;
  }

  /**
   * Предсказать вероятности следующего режима
   */
  private predictNextRegime(
    currentRegime: MarketRegime,
    trend: number,
    volatility: number,
    momentum: number
  ): { BULL: number; BEAR: number; SIDEWAYS: number } {
    // Transition probabilities based on current state and indicators
    const baseProbabilities = {
      BULL: { BULL: 0.7, SIDEWAYS: 0.2, BEAR: 0.1 },
      BEAR: { BEAR: 0.7, SIDEWAYS: 0.2, BULL: 0.1 },
      SIDEWAYS: { SIDEWAYS: 0.5, BULL: 0.25, BEAR: 0.25 },
    };

    const base = baseProbabilities[currentRegime];

    // Adjust based on current indicators
    const trendAdjustment = trend * 0.2;
    const momentumAdjustment = momentum * 0.15;
    const volatilityPenalty = volatility * 0.05;

    let bullProb =
      base.BULL + trendAdjustment + momentumAdjustment - volatilityPenalty;
    let bearProb =
      base.BEAR - trendAdjustment - momentumAdjustment + volatilityPenalty;
    let sidewaysProb = base.SIDEWAYS + volatilityPenalty;

    // Normalize to sum to 1
    const total = bullProb + bearProb + sidewaysProb;
    bullProb /= total;
    bearProb /= total;
    sidewaysProb /= total;

    return {
      BULL: Math.max(0, Math.min(1, bullProb)),
      BEAR: Math.max(0, Math.min(1, bearProb)),
      SIDEWAYS: Math.max(0, Math.min(1, sidewaysProb)),
    };
  }
}
