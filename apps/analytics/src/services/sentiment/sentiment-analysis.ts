import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { OnChainMetrics } from "@aladdin/core";
import type { Logger } from "@aladdin/logger";
import { HistoricalContextService } from "./historical-context";
import { PatternRecognitionService } from "./pattern-recognition";

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

  // Historical context and patterns
  marketCyclePhase?: string;
  phaseConfidence?: number;
  detectedPatterns?: string[];
  historicalRecommendation?: string;
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
 * On-Chain Metrics (extended with new fields)
 */
type OnChainMetricsDB = {
  whale_tx_count: number;
  whale_tx_volume: number;
  exchange_net_flow: number;
  active_addresses: number;
  nvt_ratio: number;
  mvrv_ratio?: number | null;
  nupl?: number | null;
  sopr?: number | null;
  puell_multiple?: number | null;
  stock_to_flow?: number | null;
  exchange_reserve?: number | null;
  reserve_risk?: number | null;
  accumulation_score?: number | null;
  accumulation_trend_7d?: number | null;
  accumulation_trend_30d?: number | null;
  accumulation_trend_90d?: number | null;
  hodl_under1m?: number | null;
  hodl_over5y?: number | null;
  binary_cdd?: number | null;
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

  private historicalContextService: HistoricalContextService;
  private patternRecognitionService: PatternRecognitionService;

  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {
    this.historicalContextService = new HistoricalContextService(
      logger,
      clickhouse
    );
    this.patternRecognitionService = new PatternRecognitionService(logger);
  }

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

    const onChainSentiment = await this.calculateOnChainSentiment(
      onChainData.status === "fulfilled" ? onChainData.value : null,
      symbol
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

    // Add historical context and pattern analysis (async, best effort)
    let contextAnalysis:
      | Awaited<ReturnType<typeof this.historicalContextService.analyzeContext>>
      | undefined;
    let patternAnalysis:
      | ReturnType<typeof this.patternRecognitionService.analyzePatterns>
      | undefined;

    try {
      const blockchain = symbol.startsWith("BTC") ? "BTC" : "ETH";
      const currentMetrics = await this.getOnChainMetricsForContext(blockchain);
      const historicalMetrics =
        await this.getOnChainMetricsHistoryForContext(blockchain);

      if (currentMetrics) {
        contextAnalysis = await this.historicalContextService.analyzeContext(
          currentMetrics,
          blockchain
        );
        patternAnalysis = await this.patternRecognitionService.analyzePatterns(
          currentMetrics,
          historicalMetrics
        );
      }
    } catch (error) {
      this.logger.warn("Failed to analyze historical context/patterns", error);
    }

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
      marketCyclePhase: contextAnalysis?.currentPhase,
      phaseConfidence: contextAnalysis?.phaseConfidence,
      detectedPatterns: patternAnalysis?.patterns.map((p) => p.description),
      historicalRecommendation: contextAnalysis?.recommendation,
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
   * Fetch On-Chain metrics from ClickHouse (with historical data for trends)
   */
  private async getOnChainData(
    symbol: string
  ): Promise<OnChainMetricsDB | null> {
    try {
      // Map symbol to blockchain (BTC/ETH)
      const blockchain = symbol.startsWith("BTC") ? "BTC" : "ETH";

      const result = await this.clickhouse.query<OnChainMetricsDB>(
        `
        SELECT 
          whale_tx_count,
          whale_tx_volume,
          exchange_net_flow,
          active_addresses,
          nvt_ratio,
          mvrv_ratio,
          nupl,
          sopr,
          puell_multiple,
          stock_to_flow,
          exchange_reserve,
          reserve_risk,
          accumulation_score,
          accumulation_trend_7d,
          accumulation_trend_30d,
          accumulation_trend_90d,
          hodl_under1m,
          hodl_over5y,
          binary_cdd
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
   * Get OnChainMetrics for context analysis (formatted for HistoricalContextService)
   */
  private async getOnChainMetricsForContext(
    blockchain: string
  ): Promise<OnChainMetrics | null> {
    try {
      const result = await this.clickhouse.query<{
        timestamp: string;
        whale_tx_count: number;
        whale_tx_volume: number;
        exchange_inflow: number;
        exchange_outflow: number;
        exchange_net_flow: number;
        active_addresses: number;
        nvt_ratio: number;
        mvrv_ratio?: number | null;
        nupl?: number | null;
        sopr?: number | null;
        puell_multiple?: number | null;
        exchange_reserve?: number | null;
        reserve_risk?: number | null;
        accumulation_score?: number | null;
        accumulation_trend_7d?: number | null;
        accumulation_trend_30d?: number | null;
        accumulation_trend_90d?: number | null;
        hodl_under1m?: number | null;
        hodl_over5y?: number | null;
        binary_cdd?: number | null;
      }>(
        `
        SELECT *
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
        ORDER BY timestamp DESC
        LIMIT 1
      `,
        { blockchain }
      );

      if (result.length === 0) return null;

      const raw = result[0];
      return {
        timestamp: new Date(raw.timestamp).getTime(),
        blockchain,
        whaleTransactions: {
          count: raw.whale_tx_count,
          totalVolume: raw.whale_tx_volume,
        },
        exchangeFlow: {
          inflow: raw.exchange_inflow ?? 0,
          outflow: raw.exchange_outflow ?? 0,
          netFlow: raw.exchange_net_flow,
        },
        activeAddresses: raw.active_addresses,
        nvtRatio: raw.nvt_ratio,
        transactionVolume: 0, // Not used in context analysis
        mvrvRatio: raw.mvrv_ratio ?? undefined,
        nupl: raw.nupl ?? undefined,
        sopr: raw.sopr ?? undefined,
        puellMultiple: raw.puell_multiple ?? undefined,
        exchangeReserve: raw.exchange_reserve ?? undefined,
        reserveRisk: raw.reserve_risk ?? undefined,
        accumulationTrend:
          raw.accumulation_score !== null
            ? {
                score: raw.accumulation_score,
                trend7d: raw.accumulation_trend_7d ?? 0,
                trend30d: raw.accumulation_trend_30d ?? 0,
                trend90d: raw.accumulation_trend_90d ?? 0,
              }
            : undefined,
        hodlWaves:
          raw.hodl_under1m !== null
            ? {
                under1m: raw.hodl_under1m,
                m1to3: 0,
                m3to6: 0,
                m6to12: 0,
                y1to2: 0,
                y2to3: 0,
                y3to5: 0,
                over5y: raw.hodl_over5y ?? 0,
              }
            : undefined,
        binaryCDD: raw.binary_cdd === 1,
      };
    } catch (error) {
      this.logger.error("Failed to fetch on-chain metrics for context", error);
      return null;
    }
  }

  /**
   * Get historical OnChainMetrics for pattern analysis (last 7 days)
   */
  private async getOnChainMetricsHistoryForContext(
    blockchain: string
  ): Promise<OnChainMetrics[]> {
    try {
      const result = await this.clickhouse.query<{
        timestamp: string;
        whale_tx_count: number;
        whale_tx_volume: number;
        exchange_net_flow: number;
        active_addresses: number;
        nvt_ratio: number;
        mvrv_ratio?: number | null;
        nupl?: number | null;
        exchange_reserve?: number | null;
        reserve_risk?: number | null;
        accumulation_score?: number | null;
        hodl_over5y?: number | null;
      }>(
        `
        SELECT 
          timestamp,
          whale_tx_count,
          whale_tx_volume,
          exchange_net_flow,
          active_addresses,
          nvt_ratio,
          mvrv_ratio,
          nupl,
          exchange_reserve,
          reserve_risk,
          accumulation_score,
          hodl_over5y
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
          AND timestamp >= now() - INTERVAL 7 DAY
        ORDER BY timestamp DESC
        LIMIT 7
      `,
        { blockchain }
      );

      return result.map((raw) => ({
        timestamp: new Date(raw.timestamp).getTime(),
        blockchain,
        whaleTransactions: {
          count: raw.whale_tx_count,
          totalVolume: raw.whale_tx_volume,
        },
        exchangeFlow: {
          inflow: 0,
          outflow: 0,
          netFlow: raw.exchange_net_flow,
        },
        activeAddresses: raw.active_addresses,
        nvtRatio: raw.nvt_ratio,
        transactionVolume: 0,
        mvrvRatio: raw.mvrv_ratio ?? undefined,
        nupl: raw.nupl ?? undefined,
        exchangeReserve: raw.exchange_reserve ?? undefined,
        reserveRisk: raw.reserve_risk ?? undefined,
        accumulationTrend:
          raw.accumulation_score !== null
            ? {
                score: raw.accumulation_score,
                trend7d: 0,
                trend30d: 0,
                trend90d: 0,
              }
            : undefined,
        hodlWaves:
          raw.hodl_over5y !== null
            ? {
                under1m: 0,
                m1to3: 0,
                m3to6: 0,
                m6to12: 0,
                y1to2: 0,
                y2to3: 0,
                y3to5: 0,
                over5y: raw.hodl_over5y,
              }
            : undefined,
      }));
    } catch (error) {
      this.logger.error("Failed to fetch historical on-chain metrics", error);
      return [];
    }
  }

  /**
   * Fetch historical On-Chain metrics for trend analysis (last 7 days)
   */
  private async getOnChainHistoricalData(
    symbol: string
  ): Promise<OnChainMetricsDB[]> {
    try {
      const blockchain = symbol.startsWith("BTC") ? "BTC" : "ETH";

      const result = await this.clickhouse.query<OnChainMetricsDB>(
        `
        SELECT 
          timestamp,
          whale_tx_count,
          exchange_net_flow,
          active_addresses,
          mvrv_ratio,
          nupl,
          exchange_reserve,
          reserve_risk,
          accumulation_score,
          hodl_over5y
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
          AND timestamp >= now() - INTERVAL 7 DAY
        ORDER BY timestamp DESC
        LIMIT 7
      `,
        { blockchain }
      );

      return result;
    } catch (error) {
      this.logger.error("Failed to fetch historical on-chain data", error);
      return [];
    }
  }

  /**
   * Calculate trend/momentum from historical data
   * Returns value between -1 (strong downtrend) and +1 (strong uptrend)
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, idx) => sum + idx * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;

    // Normalize slope relative to average value
    const normalizedSlope = avgValue !== 0 ? slope / Math.abs(avgValue) : 0;

    // Clamp between -1 and +1
    return Math.max(-1, Math.min(1, normalizedSlope * 10));
  }

  /**
   * Calculate percentile for dynamic thresholds
   */
  private calculatePercentile(
    value: number,
    historicalValues: number[]
  ): number {
    if (historicalValues.length === 0) {
      return 0.5;
    }

    const sorted = [...historicalValues].sort((a, b) => a - b);
    const index = sorted.findIndex((v) => v >= value);

    if (index === -1) {
      return 1.0; // Value is above all historical values
    }

    return index / sorted.length;
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
   * Calculate On-Chain sentiment component with advanced metrics and trends
   *
   * Weight distribution (Phase 1 update):
   * - Basic metrics: 30% (whale_tx, exchange_flow, active_addr)
   * - Advanced metrics: 45% (MVRV, NUPL, SOPR, Puell, Reserve Risk, Accumulation, HODL, Binary CDD)
   * - Trend indicators: 15% (7-day momentum)
   * - Historical context: 10% (cycle phase, patterns)
   */
  private async calculateOnChainSentiment(
    data: OnChainMetricsDB | null,
    symbol: string
  ): Promise<ComponentSentiment> {
    if (!data) {
      return {
        score: 0,
        signal: "NEUTRAL",
        weight: SentimentAnalysisService.WEIGHTS.ON_CHAIN,
        confidence: 0,
      };
    }

    let score = 0;
    let confidence = 70;

    // Get historical data for trend analysis
    const historicalData = await this.getOnChainHistoricalData(symbol);

    // ===== BASIC METRICS (30% weight) =====
    let basicScore = 0;

    // 1. Whale activity (dynamic thresholds based on percentile)
    if (historicalData.length > 0) {
      const whaleValues = historicalData.map((d) => d.whale_tx_count);
      const whalePercentile = this.calculatePercentile(
        data.whale_tx_count,
        whaleValues
      );

      if (whalePercentile > 0.8) {
        basicScore += 15; // Top 20% whale activity = bullish
      } else if (whalePercentile < 0.2) {
        basicScore -= 10; // Bottom 20% = bearish
      }

      // Whale trend
      const whaleTrend = this.calculateTrend(whaleValues);
      basicScore += whaleTrend * 5; // ±5 points based on trend
    } else if (data.whale_tx_count > 50) {
      // Fallback to static thresholds
      basicScore += 15;
    } else if (data.whale_tx_count < 10) {
      basicScore -= 10;
    }

    // 2. Exchange net flow (negative = bullish accumulation)
    const FLOW_THRESHOLD = 1000;
    if (data.exchange_net_flow < -FLOW_THRESHOLD) {
      basicScore += 20; // Strong outflow = very bullish
    } else if (data.exchange_net_flow < 0) {
      basicScore += 10; // Moderate outflow = bullish
    } else if (data.exchange_net_flow > FLOW_THRESHOLD) {
      basicScore -= 20; // Strong inflow = very bearish
    } else if (data.exchange_net_flow > 0) {
      basicScore -= 10; // Moderate inflow = bearish
    }

    // Exchange flow trend
    if (historicalData.length > 0) {
      const flowValues = historicalData.map((d) => d.exchange_net_flow);
      const flowTrend = this.calculateTrend(flowValues);
      // Negative trend (increasing outflow) = bullish
      basicScore -= flowTrend * 5;
    }

    // 3. Active addresses (dynamic thresholds)
    if (historicalData.length > 0) {
      const addressValues = historicalData.map((d) => d.active_addresses);
      const addressPercentile = this.calculatePercentile(
        data.active_addresses,
        addressValues
      );

      if (addressPercentile > 0.8) {
        basicScore += 10; // High activity = bullish
      } else if (addressPercentile < 0.2) {
        basicScore -= 5; // Low activity = bearish
      }
    }

    // Apply weight to basic score (30% of total)
    score += basicScore * 0.3;

    // ===== ADVANCED METRICS (45% weight) =====
    let advancedScore = 0;

    // 1. MVRV Ratio
    if (data.mvrvRatio !== undefined && data.mvrvRatio !== null) {
      if (data.mvrvRatio > 3.7) {
        advancedScore -= 20; // Overvalued = bearish
        confidence += 5;
      } else if (data.mvrvRatio < 1.0) {
        advancedScore += 30; // Undervalued = bullish
        confidence += 10;
      } else if (data.mvrvRatio >= 1.0 && data.mvrvRatio <= 1.5) {
        advancedScore += 15; // Fair value zone = slightly bullish
      }
    }

    // 2. NUPL (Net Unrealized Profit/Loss)
    if (data.nupl !== undefined && data.nupl !== null) {
      if (data.nupl > 0.75) {
        advancedScore -= 25; // Euphoria = bearish
        confidence += 5;
      } else if (data.nupl < 0) {
        advancedScore += 35; // Capitulation = very bullish
        confidence += 10;
      } else if (data.nupl >= 0 && data.nupl <= 0.25) {
        advancedScore += 20; // Early accumulation = bullish
      }
    }

    // 3. SOPR (Spent Output Profit Ratio)
    if (data.sopr !== undefined && data.sopr !== null) {
      if (data.sopr > 1.05) {
        advancedScore -= 5; // Heavy profit-taking = bearish
      } else if (data.sopr < 0.95) {
        advancedScore += 10; // Selling at loss = bullish (capitulation)
      }
    }

    // 4. Puell Multiple (BTC only)
    if (data.puellMultiple !== undefined && data.puellMultiple !== null) {
      if (data.puellMultiple > 4) {
        advancedScore -= 15; // Cycle top = bearish
        confidence += 5;
      } else if (data.puellMultiple < 0.5) {
        advancedScore += 25; // Cycle bottom = very bullish
        confidence += 10;
      }
    }

    // 5. Exchange Reserve (lower = less selling pressure)
    if (
      data.exchangeReserve !== undefined &&
      data.exchangeReserve !== null &&
      historicalData.length > 0
    ) {
      const reserveValues = historicalData
        .map((d) => d.exchangeReserve)
        .filter((v): v is number => v !== undefined && v !== null);

      if (reserveValues.length > 0) {
        const reserveTrend = this.calculateTrend(reserveValues);
        // Negative trend (decreasing reserve) = bullish
        advancedScore -= reserveTrend * 5;
      }
    }

    // 6. Reserve Risk (new Phase 1 metric)
    if (data.reserve_risk !== undefined && data.reserve_risk !== null) {
      if (data.reserve_risk < 0.002) {
        advancedScore += 20; // Deep accumulation zone = bullish
        confidence += 5;
      } else if (data.reserve_risk > 0.02) {
        advancedScore -= 20; // Distribution zone = bearish
        confidence += 5;
      }
    }

    // 7. Accumulation Trend Score (new Phase 1 metric)
    if (
      data.accumulation_score !== undefined &&
      data.accumulation_score !== null
    ) {
      if (data.accumulation_score > 50) {
        advancedScore += 25; // Strong accumulation = very bullish
        confidence += 10;
      } else if (data.accumulation_score < -50) {
        advancedScore -= 25; // Strong distribution = very bearish
        confidence += 10;
      } else if (data.accumulation_score > 20) {
        advancedScore += 15; // Moderate accumulation = bullish
      } else if (data.accumulation_score < -20) {
        advancedScore -= 15; // Moderate distribution = bearish
      }
    }

    // 8. HODL Waves - Long-term holder percentage (new Phase 1 metric)
    if (data.hodl_over5y !== undefined && data.hodl_over5y !== null) {
      // Higher percentage of 5+ year holders = bullish long-term conviction
      if (data.hodl_over5y > 25) {
        advancedScore += 15; // Strong HODLing = bullish
        confidence += 5;
      } else if (data.hodl_over5y < 10) {
        advancedScore -= 10; // Low long-term conviction = bearish
      }
    }

    // 9. Binary CDD - Coin Days Destroyed spike (new Phase 1 metric)
    if (data.binary_cdd !== undefined && data.binary_cdd !== null) {
      if (data.binary_cdd === 1) {
        advancedScore -= 15; // Old coins moving = potential distribution
        confidence += 5;
      } else {
        advancedScore += 5; // HODLing continues = bullish
      }
    }

    // Apply weight to advanced score (45% of total, increased from 40%)
    score += advancedScore * 0.45;

    // ===== TREND INDICATORS (15% weight, decreased from 20%) =====
    if (historicalData.length >= 3) {
      let trendScore = 0;

      // Calculate overall momentum from multiple metrics
      const metricTrends: number[] = [];

      // MVRV trend
      const mvrvValues = historicalData
        .map((d) => d.mvrvRatio)
        .filter((v): v is number => v !== undefined && v !== null);
      if (mvrvValues.length >= 2) {
        metricTrends.push(this.calculateTrend(mvrvValues));
      }

      // NUPL trend
      const nuplValues = historicalData
        .map((d) => d.nupl)
        .filter((v): v is number => v !== undefined && v !== null);
      if (nuplValues.length >= 2) {
        metricTrends.push(this.calculateTrend(nuplValues));
      }

      if (metricTrends.length > 0) {
        const avgTrend =
          metricTrends.reduce((sum, t) => sum + t, 0) / metricTrends.length;

        // Positive trend in value metrics = bullish
        trendScore = avgTrend * 50; // ±50 points based on average trend

        confidence += Math.abs(avgTrend) * 10; // Higher confidence with stronger trends
      }

      // Apply weight to trend score (15% of total, decreased from 20%)
      score += trendScore * 0.15;
    }

    // ===== HISTORICAL CONTEXT (10% weight, new Phase 1) =====
    // Note: Historical context is computed separately in getCompositeSentiment
    // Here we add a small adjustment based on available on-chain metrics alignment
    const contextScore = 0; // Placeholder for now (full implementation in getCompositeSentiment)
    score += contextScore * 0.1;

    // Clamp score between -100 and +100
    score = Math.max(-100, Math.min(100, score));

    // Clamp confidence between 0 and 100
    confidence = Math.max(0, Math.min(100, confidence));

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
    let ema = closes.at(-1) ?? 0; // Start with first close

    for (let i = closes.length - 2; i >= 0; i--) {
      ema = (closes[i] - ema) * multiplier + ema;
    }

    return ema;
  }
}
