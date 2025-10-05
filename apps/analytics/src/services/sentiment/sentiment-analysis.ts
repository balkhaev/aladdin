import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";

/**
 * Sentiment Signal Types
 */
export type SentimentSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

/**
 * Component Sentiment Scores
 */
export type ComponentSentiment = {
  score: number; // -100 to +100
  signal: SentimentSignal;
  weight: number; // 0-1 (importance of this component)
  confidence: number; // 0-100 (how confident we are)
};

/**
 * Composite Sentiment Result
 */
export type CompositeSentiment = {
  symbol: string;
  timestamp: Date;

  // Overall sentiment
  compositeScore: number; // -100 to +100
  compositeSignal: SentimentSignal;
  confidence: number; // 0-100

  // Component sentiments
  components: {
    fearGreed: ComponentSentiment;
    onChain: ComponentSentiment;
    technical: ComponentSentiment;
  };

  // Additional insights
  insights: string[];

  // Strength indicator
  strength: "WEAK" | "MODERATE" | "STRONG";
};

/**
 * Fear & Greed Data
 */
type FearGreedData = {
  value: number; // 0-100
  classification: string;
  timestamp: Date;
};

/**
 * On-Chain Metrics
 */
type OnChainMetrics = {
  whale_tx_count: number;
  whale_tx_volume: number;
  exchange_net_flow: number;
  active_addresses: number;
  nvt_ratio: number;
};

/**
 * Technical Indicators
 */
type TechnicalIndicators = {
  rsi: number; // 0-100
  macd_histogram: number;
  price_vs_sma20: number; // % above/below SMA20
  price_vs_sma50: number; // % above/below SMA50
};

/**
 * Sentiment Analysis Service
 * Aggregates multiple data sources to generate institutional-grade sentiment signals
 */
export class SentimentAnalysisService {
  // Weights for each component (must sum to 1.0)
  private static readonly WEIGHTS = {
    FEAR_GREED: 0.25, // 25% - market sentiment
    ON_CHAIN: 0.4, // 40% - blockchain activity (most important)
    TECHNICAL: 0.35, // 35% - price action
  };

  // Thresholds for signals
  private static readonly THRESHOLDS = {
    STRONG_BULLISH: 50,
    MODERATE_BULLISH: 20,
    MODERATE_BEARISH: -20,
    STRONG_BEARISH: -50,
  };

  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Get composite sentiment for a symbol
   */
  async getCompositeSentiment(symbol: string): Promise<CompositeSentiment> {
    this.logger.info("Calculating composite sentiment", { symbol });

    // Fetch all data in parallel
    const [fearGreedData, onChainData, technicalData] =
      await Promise.allSettled([
        this.getFearGreedData(),
        this.getOnChainData(symbol),
        this.getTechnicalData(symbol),
      ]);

    // Calculate component sentiments
    const fearGreedSentiment = this.calculateFearGreedSentiment(
      fearGreedData.status === "fulfilled" ? fearGreedData.value : null
    );

    const onChainSentiment = this.calculateOnChainSentiment(
      onChainData.status === "fulfilled" ? onChainData.value : null
    );

    const technicalSentiment = this.calculateTechnicalSentiment(
      technicalData.status === "fulfilled" ? technicalData.value : null
    );

    // Calculate composite score
    const compositeScore = this.calculateCompositeScore({
      fearGreed: fearGreedSentiment,
      onChain: onChainSentiment,
      technical: technicalSentiment,
    });

    // Determine signal and strength
    const compositeSignal = this.getSignalFromScore(compositeScore);
    const strength = this.getStrengthFromScore(compositeScore);

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence({
      fearGreed: fearGreedSentiment,
      onChain: onChainSentiment,
      technical: technicalSentiment,
    });

    // Generate insights
    const insights = this.generateInsights({
      fearGreed: fearGreedSentiment,
      onChain: onChainSentiment,
      technical: technicalSentiment,
      compositeScore,
      compositeSignal,
    });

    return {
      symbol,
      timestamp: new Date(),
      compositeScore,
      compositeSignal,
      confidence,
      components: {
        fearGreed: fearGreedSentiment,
        onChain: onChainSentiment,
        technical: technicalSentiment,
      },
      insights,
      strength,
    };
  }

  /**
   * Fetch Fear & Greed Index from ClickHouse
   */
  private async getFearGreedData(): Promise<FearGreedData | null> {
    try {
      const result = await this.clickhouse.query<{
        timestamp: string;
        value: number;
        classification: string;
      }>(
        `
        SELECT 
          timestamp,
          value,
          classification
        FROM aladdin.fear_greed_index
        ORDER BY timestamp DESC
        LIMIT 1
      `
      );

      if (result.length === 0) {
        return null;
      }

      return {
        value: result[0].value,
        classification: result[0].classification,
        timestamp: new Date(result[0].timestamp),
      };
    } catch (error) {
      this.logger.error("Failed to fetch Fear & Greed data", error);
      return null;
    }
  }

  /**
   * Fetch On-Chain metrics from ClickHouse
   */
  private async getOnChainData(symbol: string): Promise<OnChainMetrics | null> {
    try {
      // Map symbol to blockchain (BTC/ETH)
      const blockchain = symbol.startsWith("BTC") ? "BTC" : "ETH";

      const result = await this.clickhouse.query<OnChainMetrics>(
        `
        SELECT 
          whale_tx_count,
          whale_tx_volume,
          exchange_net_flow,
          active_addresses,
          nvt_ratio
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
        ORDER BY timestamp DESC
        LIMIT 1
      `,
        { blockchain }
      );

      if (result.length === 0) {
        return null;
      }

      return result[0];
    } catch (error) {
      this.logger.error("Failed to fetch on-chain data", error);
      return null;
    }
  }

  /**
   * Fetch Technical indicators from ClickHouse
   */
  private async getTechnicalData(
    symbol: string
  ): Promise<TechnicalIndicators | null> {
    try {
      // Get recent candles
      const candles = await this.clickhouse.query<{
        timestamp: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }>(
        `
        SELECT 
          timestamp,
          open,
          high,
          low,
          close,
          volume
        FROM candles
        WHERE symbol = {symbol:String}
          AND timeframe = '1h'
        ORDER BY timestamp DESC
        LIMIT 200
      `,
        { symbol }
      );

      if (candles.length < 50) {
        return null;
      }

      // Calculate RSI
      const rsi = this.calculateRSI(candles.map((c) => c.close));

      // Calculate MACD
      const macd = this.calculateMACDHistogram(candles.map((c) => c.close));

      // Calculate price vs SMA
      const closes = candles.map((c) => c.close);
      const currentPrice = closes[0];
      const sma20 = this.calculateSMA(closes.slice(0, 20));
      const sma50 = this.calculateSMA(closes.slice(0, 50));

      return {
        rsi,
        macd_histogram: macd,
        price_vs_sma20:
          sma20 !== 0 ? ((currentPrice - sma20) / sma20) * 100 : 0,
        price_vs_sma50:
          sma50 !== 0 ? ((currentPrice - sma50) / sma50) * 100 : 0,
      };
    } catch (error) {
      this.logger.error("Failed to fetch technical data", error);
      return null;
    }
  }

  /**
   * Calculate Fear & Greed sentiment component
   */
  private calculateFearGreedSentiment(
    data: FearGreedData | null
  ): ComponentSentiment {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        weight: SentimentAnalysisService.WEIGHTS.FEAR_GREED,
        confidence: 0,
      };
    }

    // Map 0-100 to -100 to +100
    // 0 (Extreme Fear) -> -100
    // 50 (Neutral) -> 0
    // 100 (Extreme Greed) -> +100
    const score = (data.value - 50) * 2;

    return {
      score,
      signal: this.getSignalFromScore(score),
      weight: SentimentAnalysisService.WEIGHTS.FEAR_GREED,
      confidence: 90, // Fear & Greed is a reliable indicator
    };
  }

  /**
   * Calculate On-Chain sentiment component
   */
  private calculateOnChainSentiment(
    data: OnChainMetrics | null
  ): ComponentSentiment {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        weight: SentimentAnalysisService.WEIGHTS.ON_CHAIN,
        confidence: 0,
      };
    }

    let score = 0;
    const confidence = 80;

    // Whale activity (30% of on-chain score)
    const WHALE_HIGH_THRESHOLD = 50;
    const WHALE_LOW_THRESHOLD = 10;
    if (data.whale_tx_count > WHALE_HIGH_THRESHOLD) {
      score += 30; // High whale activity = bullish
    } else if (data.whale_tx_count < WHALE_LOW_THRESHOLD) {
      score -= 15; // Low activity = bearish
    }

    // Exchange net flow (40% of on-chain score)
    // Negative flow (outflow) = bullish (accumulation)
    // Positive flow (inflow) = bearish (distribution)
    const FLOW_THRESHOLD = 1000;
    if (data.exchange_net_flow < -FLOW_THRESHOLD) {
      score += 40; // Strong outflow = very bullish
    } else if (data.exchange_net_flow < 0) {
      score += 20; // Moderate outflow = bullish
    } else if (data.exchange_net_flow > FLOW_THRESHOLD) {
      score -= 40; // Strong inflow = very bearish
    } else if (data.exchange_net_flow > 0) {
      score -= 20; // Moderate inflow = bearish
    }

    // Active addresses (30% of on-chain score)
    const ACTIVE_HIGH_THRESHOLD = 100_000;
    const ACTIVE_LOW_THRESHOLD = 50_000;
    if (data.active_addresses > ACTIVE_HIGH_THRESHOLD) {
      score += 30; // High activity = bullish
    } else if (data.active_addresses < ACTIVE_LOW_THRESHOLD) {
      score -= 15; // Low activity = bearish
    }

    return {
      score,
      signal: this.getSignalFromScore(score),
      weight: SentimentAnalysisService.WEIGHTS.ON_CHAIN,
      confidence,
    };
  }

  /**
   * Calculate Technical sentiment component
   */
  private calculateTechnicalSentiment(
    data: TechnicalIndicators | null
  ): ComponentSentiment {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        weight: SentimentAnalysisService.WEIGHTS.TECHNICAL,
        confidence: 0,
      };
    }

    let score = 0;
    const confidence = 75;

    // RSI (40% of technical score)
    const RSI_OVERSOLD = 30;
    const RSI_OVERBOUGHT = 70;
    if (data.rsi < RSI_OVERSOLD) {
      score += 40; // Oversold = bullish
    } else if (data.rsi > RSI_OVERBOUGHT) {
      score -= 40; // Overbought = bearish
    } else {
      // Linear interpolation between 30-70
      score += ((data.rsi - 50) / 20) * 20; // -20 to +20
    }

    // MACD histogram (30% of technical score)
    if (data.macd_histogram > 0) {
      score += 30; // Positive histogram = bullish
    } else {
      score -= 30; // Negative histogram = bearish
    }

    // Price vs SMA (30% of technical score)
    const avgVsSMA = (data.price_vs_sma20 + data.price_vs_sma50) / 2;
    if (avgVsSMA > 5) {
      score += 30; // Price well above SMAs = bullish
    } else if (avgVsSMA < -5) {
      score -= 30; // Price well below SMAs = bearish
    } else {
      score += avgVsSMA * 6; // Linear scale
    }

    return {
      score,
      signal: this.getSignalFromScore(score),
      weight: SentimentAnalysisService.WEIGHTS.TECHNICAL,
      confidence,
    };
  }

  /**
   * Calculate weighted composite score
   */
  private calculateCompositeScore(components: {
    fearGreed: ComponentSentiment;
    onChain: ComponentSentiment;
    technical: ComponentSentiment;
  }): number {
    const weightedSum =
      components.fearGreed.score * components.fearGreed.weight +
      components.onChain.score * components.onChain.weight +
      components.technical.score * components.technical.weight;

    // Clamp to -100 to +100
    return Math.max(-100, Math.min(100, weightedSum));
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(components: {
    fearGreed: ComponentSentiment;
    onChain: ComponentSentiment;
    technical: ComponentSentiment;
  }): number {
    const weightedConfidence =
      components.fearGreed.confidence * components.fearGreed.weight +
      components.onChain.confidence * components.onChain.weight +
      components.technical.confidence * components.technical.weight;

    return Math.round(weightedConfidence);
  }

  /**
   * Get signal from score
   */
  private getSignalFromScore(score: number): SentimentSignal {
    if (score > SentimentAnalysisService.THRESHOLDS.MODERATE_BULLISH) {
      return "BULLISH";
    }
    if (score < SentimentAnalysisService.THRESHOLDS.MODERATE_BEARISH) {
      return "BEARISH";
    }
    return "NEUTRAL";
  }

  /**
   * Get strength from score
   */
  private getStrengthFromScore(score: number): "WEAK" | "MODERATE" | "STRONG" {
    const absScore = Math.abs(score);
    if (absScore > SentimentAnalysisService.THRESHOLDS.STRONG_BULLISH) {
      return "STRONG";
    }
    if (absScore > SentimentAnalysisService.THRESHOLDS.MODERATE_BULLISH) {
      return "MODERATE";
    }
    return "WEAK";
  }

  /**
   * Generate human-readable insights
   */
  private generateInsights(params: {
    fearGreed: ComponentSentiment;
    onChain: ComponentSentiment;
    technical: ComponentSentiment;
    compositeScore: number;
    compositeSignal: SentimentSignal;
  }): string[] {
    const insights: string[] = [];

    // Overall sentiment
    const { compositeScore, compositeSignal } = params;
    const strength = this.getStrengthFromScore(compositeScore);

    insights.push(
      `Overall sentiment is ${strength} ${compositeSignal} (score: ${compositeScore.toFixed(1)})`
    );

    // Fear & Greed insights
    if (params.fearGreed.confidence > 0) {
      if (params.fearGreed.score > 50) {
        insights.push("Market showing extreme greed - potential top");
      } else if (params.fearGreed.score < -50) {
        insights.push("Market showing extreme fear - potential bottom");
      }
    }

    // On-Chain insights
    if (params.onChain.confidence > 0) {
      if (params.onChain.score > 30) {
        insights.push(
          "Strong on-chain activity: whale accumulation and exchange outflows"
        );
      } else if (params.onChain.score < -30) {
        insights.push(
          "Weak on-chain activity: distribution and exchange inflows"
        );
      }
    }

    // Technical insights
    if (params.technical.confidence > 0) {
      if (params.technical.score > 30) {
        insights.push(
          "Technical indicators bullish: RSI healthy, MACD positive"
        );
      } else if (params.technical.score < -30) {
        insights.push("Technical indicators bearish: RSI weak, MACD negative");
      }
    }

    // Divergence detection
    const components = [params.fearGreed, params.onChain, params.technical]
      .filter((c) => c.confidence > 0)
      .map((c) => c.signal);

    const bullishCount = components.filter((s) => s === "BULLISH").length;
    const bearishCount = components.filter((s) => s === "BEARISH").length;

    if (bullishCount > 0 && bearishCount > 0 && components.length > 2) {
      insights.push("⚠️ Divergence detected between sentiment components");
    }

    return insights;
  }

  // ============ Helper Methods for Technical Calculations ============

  /**
   * Calculate RSI
   */
  private calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) {
      return 50; // Neutral if not enough data
    }

    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    const gains = changes.slice(0, period).map((c) => (c > 0 ? c : 0));
    const losses = changes.slice(0, period).map((c) => (c < 0 ? -c : 0));

    let avgGain = gains.reduce((sum, val) => sum + val, 0) / period;
    let avgLoss = losses.reduce((sum, val) => sum + val, 0) / period;

    // Use smoothed average for remaining periods
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) {
      return 100;
    }

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Calculate MACD histogram
   */
  private calculateMACDHistogram(closes: number[]): number {
    if (closes.length < 26) {
      return 0; // Not enough data
    }

    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;

    // Signal line is 9-period EMA of MACD line
    // For simplicity, we'll just return the MACD line
    // (full implementation would calculate signal line separately)
    return macdLine;
  }

  /**
   * Calculate SMA
   */
  private calculateSMA(closes: number[]): number {
    if (closes.length === 0) {
      return 0;
    }
    return closes.reduce((sum, val) => sum + val, 0) / closes.length;
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(closes: number[], period: number): number {
    if (closes.length === 0) {
      return 0;
    }

    const multiplier = 2 / (period + 1);
    let ema = closes[closes.length - 1]; // Start with first close

    for (let i = closes.length - 2; i >= 0; i--) {
      ema = (closes[i] - ema) * multiplier + ema;
    }

    return ema;
  }
}
