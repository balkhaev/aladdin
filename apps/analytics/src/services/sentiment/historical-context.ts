/**
 * Historical Context Engine
 * Finds similar historical periods and determines market cycle phase
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { OnChainMetrics } from "@aladdin/core";
import type { Logger } from "@aladdin/logger";

type CyclePhase =
  | "early_bull"
  | "mid_bull"
  | "late_bull"
  | "distribution"
  | "bear"
  | "capitulation"
  | "accumulation"
  | "unknown";

type SimilarPeriod = {
  startDate: number;
  endDate: number;
  similarity: number; // 0-1
  outcome: "bullish" | "bearish" | "neutral";
  priceChange: number; // % change in next 30 days
  phase: CyclePhase;
  metrics: {
    mvrv: number;
    nupl: number;
    reserveRisk?: number;
  };
};

type ContextAnalysis = {
  currentPhase: CyclePhase;
  phaseConfidence: number; // 0-100
  similarPeriods: SimilarPeriod[];
  historicalOutcomes: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  recommendation: string;
};

const LOOKBACK_DAYS = 365 * 3; // 3 years
const SIMILARITY_THRESHOLD = 0.7;
const MAX_SIMILAR_PERIODS = 5;

/**
 * Historical Context Service
 * Provides market cycle context and finds similar historical situations
 */
export class HistoricalContextService {
  private logger: Logger;
  private clickhouse: ClickHouseClient;

  constructor(logger: Logger, clickhouse: ClickHouseClient) {
    this.logger = logger;
    this.clickhouse = clickhouse;
  }

  /**
   * Analyze current metrics with historical context
   */
  async analyzeContext(
    currentMetrics: OnChainMetrics,
    blockchain: string
  ): Promise<ContextAnalysis> {
    this.logger.info("Analyzing historical context", { blockchain });

    try {
      // Get historical data for comparison
      const historicalData = await this.getHistoricalData(blockchain);

      // Detect current cycle phase
      const currentPhase = this.detectCyclePhase(currentMetrics);
      const phaseConfidence = this.calculatePhaseConfidence(currentMetrics);

      // Find similar periods
      const similarPeriods = await this.findSimilarPeriods(
        currentMetrics,
        historicalData,
        blockchain
      );

      // Calculate historical outcomes
      const outcomes = this.calculateHistoricalOutcomes(similarPeriods);

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        currentPhase,
        outcomes
      );

      return {
        currentPhase,
        phaseConfidence,
        similarPeriods,
        historicalOutcomes: outcomes,
        recommendation,
      };
    } catch (error) {
      this.logger.error("Failed to analyze historical context", error);

      return {
        currentPhase: "unknown",
        phaseConfidence: 0,
        similarPeriods: [],
        historicalOutcomes: { bullish: 0, bearish: 0, neutral: 0 },
        recommendation: "Insufficient historical data for analysis",
      };
    }
  }

  /**
   * Detect current market cycle phase
   */
  private detectCyclePhase(metrics: OnChainMetrics): CyclePhase {
    const mvrv = metrics.mvrvRatio ?? 0;
    const nupl = metrics.nupl ?? 0;
    const accumulationScore = metrics.accumulationTrend?.score ?? 0;

    // Capitulation: extreme undervalue
    if (mvrv < 0.8 && nupl < -0.25) {
      return "capitulation";
    }

    // Accumulation: undervalued + accumulation
    if (mvrv < 1.2 && accumulationScore > 20) {
      return "accumulation";
    }

    // Early Bull: starting to move up
    if (mvrv >= 1.2 && mvrv < 2.0 && nupl >= 0 && nupl < 0.25) {
      return "early_bull";
    }

    // Mid Bull: strong momentum
    const isMidBull = mvrv >= 2.0 && mvrv < 3.0 && nupl >= 0.25 && nupl < 0.5;
    if (isMidBull) {
      return "mid_bull";
    }

    // Late Bull: euphoria approaching
    const isLateBull = mvrv >= 3.0 && mvrv < 3.7 && nupl >= 0.5 && nupl < 0.75;
    if (isLateBull) {
      return "late_bull";
    }

    // Distribution: extreme overvalue
    if (mvrv >= 3.7 || nupl >= 0.75) {
      return "distribution";
    }

    // Bear: underperforming
    if (mvrv < 1.5 && nupl < 0 && accumulationScore < -20) {
      return "bear";
    }

    return "unknown";
  }

  /**
   * Calculate confidence in phase detection
   */
  private calculatePhaseConfidence(metrics: OnChainMetrics): number {
    let confidence = 50; // Base confidence

    // Higher confidence if all metrics are available
    if (metrics.mvrvRatio !== undefined) confidence += 15;
    if (metrics.nupl !== undefined) confidence += 15;
    if (metrics.reserveRisk !== undefined) confidence += 10;
    if (metrics.accumulationTrend !== undefined) confidence += 10;

    return Math.min(confidence, 100);
  }

  /**
   * Find similar historical periods
   * OPTIMIZED: Batch fetch outcomes instead of N individual queries
   */
  private async findSimilarPeriods(
    currentMetrics: OnChainMetrics,
    historicalData: OnChainMetrics[],
    blockchain: string
  ): Promise<SimilarPeriod[]> {
    const hasRequiredMetrics = currentMetrics.mvrvRatio && currentMetrics.nupl;
    if (!hasRequiredMetrics) {
      return [];
    }

    // Step 1: Calculate similarity for all historical points and collect candidates
    const candidates: Array<{
      historical: OnChainMetrics;
      similarity: number;
    }> = [];

    for (const historical of historicalData) {
      const historicalHasMetrics = historical.mvrvRatio && historical.nupl;
      if (!historicalHasMetrics) continue;

      const similarity = this.calculateSimilarity(currentMetrics, historical);

      if (similarity >= SIMILARITY_THRESHOLD) {
        candidates.push({ historical, similarity });
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    // Sort by similarity and take top N
    candidates.sort((a, b) => b.similarity - a.similarity);
    const topCandidates = candidates.slice(0, MAX_SIMILAR_PERIODS);

    // Step 2: Batch fetch outcomes for all candidates in ONE query
    const timestamps = topCandidates.map((c) => c.historical.timestamp);
    const outcomes = await this.getBatchPeriodOutcomes(timestamps, blockchain);

    // Step 3: Combine results
    const similarPeriods: SimilarPeriod[] = topCandidates.map(
      (candidate, index) => ({
        startDate: candidate.historical.timestamp,
        endDate: candidate.historical.timestamp + 30 * 24 * 60 * 60 * 1000, // +30 days
        similarity: candidate.similarity,
        outcome: outcomes[index]?.direction ?? "neutral",
        priceChange: outcomes[index]?.priceChange ?? 0,
        phase: this.detectCyclePhase(candidate.historical),
        metrics: {
          mvrv: candidate.historical.mvrvRatio,
          nupl: candidate.historical.nupl,
          reserveRisk: candidate.historical.reserveRisk,
        },
      })
    );

    return similarPeriods;
  }

  /**
   * Calculate similarity between two metric sets
   * Uses Euclidean distance normalized to 0-1
   */
  private calculateSimilarity(
    current: OnChainMetrics,
    historical: OnChainMetrics
  ): number {
    const weights = {
      mvrv: 0.4,
      nupl: 0.4,
      reserveRisk: 0.2,
    };

    let totalWeight = 0;
    let distance = 0;

    // MVRV similarity
    if (current.mvrvRatio && historical.mvrvRatio) {
      const mvrvDiff = Math.abs(current.mvrvRatio - historical.mvrvRatio) / 5; // Normalize by max expected value
      distance += mvrvDiff * weights.mvrv;
      totalWeight += weights.mvrv;
    }

    // NUPL similarity
    if (current.nupl && historical.nupl) {
      const nuplDiff = Math.abs(current.nupl - historical.nupl) / 2; // Normalize by max expected value
      distance += nuplDiff * weights.nupl;
      totalWeight += weights.nupl;
    }

    // Reserve Risk similarity (if available)
    if (current.reserveRisk && historical.reserveRisk) {
      const reserveDiff =
        Math.abs(current.reserveRisk - historical.reserveRisk) / 0.03; // Normalize
      distance += reserveDiff * weights.reserveRisk;
      totalWeight += weights.reserveRisk;
    }

    if (totalWeight === 0) return 0;

    // Convert distance to similarity (0-1)
    const normalizedDistance = distance / totalWeight;
    return Math.max(0, 1 - normalizedDistance);
  }

  /**
   * Get historical data for comparison
   */
  private async getHistoricalData(
    blockchain: string
  ): Promise<OnChainMetrics[]> {
    try {
      const lookbackMs = LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
      const fromTimestamp = Date.now() - lookbackMs;

      const rawData = await this.clickhouse.query<{
        timestamp: string;
        mvrv_ratio: number | null;
        nupl: number | null;
        reserve_risk: number | null;
        accumulation_score: number | null;
      }>(
        `
        SELECT 
          timestamp,
          mvrv_ratio,
          nupl,
          reserve_risk,
          accumulation_score
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
          AND timestamp >= {fromTimestamp:DateTime64(3)}
          AND mvrv_ratio IS NOT NULL
          AND nupl IS NOT NULL
        ORDER BY timestamp ASC
      `,
        { blockchain, fromTimestamp }
      );

      return rawData.map((row) => ({
        timestamp: new Date(row.timestamp).getTime(),
        blockchain,
        whaleTransactions: { count: 0, totalVolume: 0 },
        exchangeFlow: { inflow: 0, outflow: 0, netFlow: 0 },
        activeAddresses: 0,
        nvtRatio: 0,
        transactionVolume: 0,
        mvrvRatio: row.mvrv_ratio ?? undefined,
        nupl: row.nupl ?? undefined,
        reserveRisk: row.reserve_risk ?? undefined,
        accumulationTrend:
          row.accumulation_score !== null
            ? {
                score: row.accumulation_score,
                trend7d: 0,
                trend30d: 0,
                trend90d: 0,
              }
            : undefined,
      }));
    } catch (error) {
      this.logger.error("Failed to get historical data", error);
      return [];
    }
  }

  /**
   * Get outcomes for multiple periods in ONE batch query
   * OPTIMIZED: Replaces N individual queries with 1 batch query
   */
  private async getBatchPeriodOutcomes(
    timestamps: number[],
    blockchain: string
  ): Promise<
    Array<{
      direction: "bullish" | "bearish" | "neutral";
      priceChange: number;
    }>
  > {
    if (timestamps.length === 0) {
      return [];
    }

    try {
      this.logger.debug("Analyzing on-chain patterns", {
        blockchain,
        periodsCount: timestamps.length,
      });

      // Build UNION query for all timestamps at once
      const unionQueries = timestamps.map(
        (timestamp) => `
        SELECT 
          ${timestamp} as query_timestamp,
          (SELECT mvrv_ratio FROM on_chain_metrics 
           WHERE blockchain = '${blockchain}' 
           AND timestamp >= fromUnixTimestamp64Milli(${timestamp})
           ORDER BY timestamp ASC LIMIT 1) as start_mvrv,
          (SELECT mvrv_ratio FROM on_chain_metrics 
           WHERE blockchain = '${blockchain}' 
           AND timestamp >= fromUnixTimestamp64Milli(${timestamp + 30 * 24 * 60 * 60 * 1000})
           ORDER BY timestamp ASC LIMIT 1) as end_mvrv
      `
      );

      const query = unionQueries.join(" UNION ALL ");

      const data = await this.clickhouse.query<{
        query_timestamp: number;
        start_mvrv: number | null;
        end_mvrv: number | null;
      }>(query);

      // Create a map for quick lookup
      const resultsMap = new Map<
        number,
        { direction: "bullish" | "bearish" | "neutral"; priceChange: number }
      >();

      for (const row of data) {
        const hasValidData = row.start_mvrv && row.end_mvrv;
        if (!hasValidData) {
          resultsMap.set(row.query_timestamp, {
            direction: "neutral",
            priceChange: 0,
          });
          continue;
        }

        const change = ((row.end_mvrv - row.start_mvrv) / row.start_mvrv) * 100;

        let direction: "bullish" | "bearish" | "neutral" = "neutral";
        if (change > 10) direction = "bullish";
        else if (change < -10) direction = "bearish";

        resultsMap.set(row.query_timestamp, { direction, priceChange: change });
      }

      // Return results in the same order as input timestamps
      return timestamps.map(
        (ts) => resultsMap.get(ts) ?? { direction: "neutral", priceChange: 0 }
      );
    } catch (error) {
      this.logger.error("Failed to get batch period outcomes", error);
      // Return neutral outcomes for all timestamps
      return timestamps.map(() => ({ direction: "neutral", priceChange: 0 }));
    }
  }

  /**
   * Calculate historical outcomes distribution
   */
  private calculateHistoricalOutcomes(periods: SimilarPeriod[]) {
    const outcomes = { bullish: 0, bearish: 0, neutral: 0 };

    for (const period of periods) {
      outcomes[period.outcome]++;
    }

    const total = periods.length || 1;

    return {
      bullish: (outcomes.bullish / total) * 100,
      bearish: (outcomes.bearish / total) * 100,
      neutral: (outcomes.neutral / total) * 100,
    };
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    phase: CyclePhase,
    outcomes: ReturnType<typeof this.calculateHistoricalOutcomes>
  ): string {
    const bullishness = outcomes.bullish - outcomes.bearish;

    switch (phase) {
      case "capitulation":
        return bullishness > 30
          ? "Historic buying opportunity - similar periods showed strong rebounds"
          : "Capitulation zone - high risk but potential for recovery";

      case "accumulation":
        return bullishness > 20
          ? "Accumulation phase - historically favorable for entry"
          : "Early accumulation - monitor for confirmation signals";

      case "early_bull":
        return bullishness > 10
          ? "Early bull market - momentum building"
          : "Cautious bullish - watch for continuation";

      case "mid_bull":
        return bullishness > 0
          ? "Mid bull market - ride the trend"
          : "Mixed signals - consider taking partial profits";

      case "late_bull":
        return "Late bull market - prepare exit strategy, high risk zone";

      case "distribution":
        return "Distribution phase - historically precedes corrections";

      case "bear":
        return bullishness < -20
          ? "Bear market - focus on preservation"
          : "Challenging conditions - wait for accumulation signals";

      default:
        return "Insufficient data for recommendation";
    }
  }
}
