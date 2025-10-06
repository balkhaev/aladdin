/**
 * Pattern Recognition Service
 * Detects on-chain behavior patterns
 */

import type { OnChainMetrics } from "@aladdin/core";
import type { Logger } from "@aladdin/logger";

type PatternType =
  | "smart_money_accumulation"
  | "retail_fomo"
  | "miner_capitulation"
  | "exchange_exodus"
  | "whale_distribution"
  | "bullish_divergence"
  | "bearish_divergence"
  | "hodl_wave_shift";

type Pattern = {
  type: PatternType;
  confidence: number; // 0-100
  signal: "bullish" | "bearish" | "neutral";
  description: string;
  indicators: string[];
  timestamp: number;
};

type PatternAnalysis = {
  patterns: Pattern[];
  dominantSignal: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
};

/**
 * Pattern Recognition Service
 * Identifies significant on-chain behavioral patterns
 */
export class PatternRecognitionService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Analyze metrics for patterns
   */
  analyzePatterns(
    currentMetrics: OnChainMetrics,
    recentHistory: OnChainMetrics[]
  ): PatternAnalysis {
    this.logger.debug("Analyzing on-chain patterns");

    const patterns: Pattern[] = [];

    // Detect various patterns
    const smartMoneyPattern = this.detectSmartMoneyAccumulation(
      currentMetrics,
      recentHistory
    );
    if (smartMoneyPattern) patterns.push(smartMoneyPattern);

    const retailFomoPattern = this.detectRetailFOMO(
      currentMetrics,
      recentHistory
    );
    if (retailFomoPattern) patterns.push(retailFomoPattern);

    const minerCapitulation = this.detectMinerCapitulation(
      currentMetrics,
      recentHistory
    );
    if (minerCapitulation) patterns.push(minerCapitulation);

    const exchangeExodus = this.detectExchangeExodus(
      currentMetrics,
      recentHistory
    );
    if (exchangeExodus) patterns.push(exchangeExodus);

    const whaleDistribution = this.detectWhaleDistribution(
      currentMetrics,
      recentHistory
    );
    if (whaleDistribution) patterns.push(whaleDistribution);

    const divergence = this.detectDivergence(currentMetrics, recentHistory);
    if (divergence) patterns.push(divergence);

    const hodlShift = this.detectHODLWaveShift(currentMetrics, recentHistory);
    if (hodlShift) patterns.push(hodlShift);

    // Calculate dominant signal
    const { dominantSignal, strength } = this.calculateDominantSignal(patterns);

    return {
      patterns,
      dominantSignal,
      strength,
    };
  }

  /**
   * Detect smart money accumulation pattern
   * Characterized by: decreasing exchange reserves, increasing whale activity, low MVRV
   */
  private detectSmartMoneyAccumulation(
    current: OnChainMetrics,
    history: OnChainMetrics[]
  ): Pattern | null {
    if (history.length < 3) return null;

    // Check for declining exchange reserves
    const reserveTrend = this.calculateTrend(
      history.map((m) => m.exchangeReserve ?? 0)
    );

    // Check for increasing whale activity
    const whaleTrend = this.calculateTrend(
      history.map((m) => m.whaleTransactions.count)
    );

    // Check for low MVRV (undervalued)
    const mvrv = current.mvrvRatio ?? 0;
    const accumulationScore = current.accumulationTrend?.score ?? 0;

    const conditions = [
      reserveTrend < -0.1, // Reserves decreasing
      whaleTrend > 0.05, // Whale activity increasing
      mvrv < 1.5, // Undervalued
      accumulationScore > 30, // Strong accumulation
    ];

    const metConditions = conditions.filter((c) => c).length;
    const confidence = (metConditions / conditions.length) * 100;

    if (confidence >= 75) {
      return {
        type: "smart_money_accumulation",
        confidence,
        signal: "bullish",
        description:
          "Smart money accumulation detected - whales buying, exchange reserves declining",
        indicators: [
          `Exchange reserves ${reserveTrend < 0 ? "declining" : "stable"}`,
          `Whale activity ${whaleTrend > 0 ? "increasing" : "stable"}`,
          `MVRV at ${mvrv.toFixed(2)} (${mvrv < 1.2 ? "undervalued" : "fair value"})`,
          `Accumulation score: ${accumulationScore.toFixed(0)}`,
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Detect retail FOMO pattern
   * Characterized by: high NUPL, extreme overvalue, high exchange inflows
   */
  private detectRetailFOMO(
    current: OnChainMetrics,
    _history: OnChainMetrics[]
  ): Pattern | null {
    const nupl = current.nupl ?? 0;
    const mvrv = current.mvrvRatio ?? 0;
    const netFlow = current.exchangeFlow.netFlow;

    const conditions = [
      nupl > 0.65, // High euphoria
      mvrv > 3.2, // Overvalued
      netFlow > 0, // Inflow to exchanges (selling pressure)
      (current.accumulationTrend?.score ?? 0) < -30, // Distribution
    ];

    const metConditions = conditions.filter((c) => c).length;
    const confidence = (metConditions / conditions.length) * 100;

    if (confidence >= 75) {
      return {
        type: "retail_fomo",
        confidence,
        signal: "bearish",
        description:
          "Retail FOMO detected - extreme euphoria, potential market top",
        indicators: [
          `NUPL at ${(nupl * 100).toFixed(0)}% (euphoria)`,
          `MVRV at ${mvrv.toFixed(2)} (overvalued)`,
          `Exchange ${netFlow > 0 ? "inflows" : "outflows"} detected`,
          "Distribution pattern forming",
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Detect miner capitulation
   * Characterized by: very low Puell Multiple, selling pressure
   */
  private detectMinerCapitulation(
    current: OnChainMetrics,
    _history: OnChainMetrics[]
  ): Pattern | null {
    const puell = current.puellMultiple;

    if (!puell) return null;

    const conditions = [
      puell < 0.6, // Extreme low miner revenue
      (current.nupl ?? 0) < -0.1, // Fear/capitulation
      current.exchangeFlow.netFlow > 0, // Selling to exchanges
    ];

    const metConditions = conditions.filter((c) => c).length;
    const confidence = (metConditions / conditions.length) * 100;

    if (confidence >= 66) {
      return {
        type: "miner_capitulation",
        confidence,
        signal: "bullish",
        description:
          "Miner capitulation detected - historically precedes bottoms",
        indicators: [
          `Puell Multiple at ${puell.toFixed(2)} (extreme low)`,
          "Miners under stress, forced selling",
          "Historic buying opportunity",
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Detect exchange exodus pattern
   * Characterized by: sustained large outflows from exchanges
   */
  private detectExchangeExodus(
    current: OnChainMetrics,
    history: OnChainMetrics[]
  ): Pattern | null {
    if (history.length < 5) return null;

    // Check for sustained negative net flow
    const recentFlows = history.slice(-5).map((m) => m.exchangeFlow.netFlow);
    const allNegative = recentFlows.every((f) => f < 0);
    const avgFlow = recentFlows.reduce((a, b) => a + b, 0) / recentFlows.length;

    const conditions = [
      allNegative,
      avgFlow < -100, // Significant outflows
      (current.exchangeReserve ?? 0) <
        (history[0]?.exchangeReserve ?? 0) * 0.95, // 5% decrease
    ];

    const metConditions = conditions.filter((c) => c).length;
    const confidence = (metConditions / conditions.length) * 100;

    if (confidence >= 66) {
      return {
        type: "exchange_exodus",
        confidence,
        signal: "bullish",
        description: "Exchange exodus detected - coins moving to cold storage",
        indicators: [
          `Sustained exchange outflows for ${recentFlows.length} periods`,
          `Average outflow: ${avgFlow.toFixed(0)} per period`,
          "Exchange reserves declining",
          "Supply squeeze potential",
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Detect whale distribution pattern
   * Characterized by: high whale activity + exchange inflows + high valuations
   */
  private detectWhaleDistribution(
    current: OnChainMetrics,
    _history: OnChainMetrics[]
  ): Pattern | null {
    const whaleCount = current.whaleTransactions.count;
    const mvrv = current.mvrvRatio ?? 0;
    const netFlow = current.exchangeFlow.netFlow;

    const conditions = [
      whaleCount > 20, // High whale activity
      netFlow > 0, // Inflow to exchanges
      mvrv > 3.0, // Overvalued
      (current.accumulationTrend?.score ?? 0) < -40, // Strong distribution
    ];

    const metConditions = conditions.filter((c) => c).length;
    const confidence = (metConditions / conditions.length) * 100;

    if (confidence >= 75) {
      return {
        type: "whale_distribution",
        confidence,
        signal: "bearish",
        description: "Whale distribution detected - smart money selling",
        indicators: [
          `${whaleCount} whale transactions detected`,
          `MVRV at ${mvrv.toFixed(2)} (overvalued)`,
          "Exchange inflows increasing",
          `Distribution score: ${(current.accumulationTrend?.score ?? 0).toFixed(0)}`,
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Detect bullish/bearish divergence
   * Price/MVRV diverging from on-chain fundamentals
   */
  private detectDivergence(
    current: OnChainMetrics,
    history: OnChainMetrics[]
  ): Pattern | null {
    if (history.length < 5) return null;

    const mvrv = current.mvrvRatio ?? 0;
    const accumulationScore = current.accumulationTrend?.score ?? 0;
    const nupl = current.nupl ?? 0;

    // Bullish divergence: price down but fundamentals improving
    if (mvrv < 1.2 && accumulationScore > 40 && nupl < 0.1) {
      return {
        type: "bullish_divergence",
        confidence: 80,
        signal: "bullish",
        description:
          "Bullish divergence - fundamentals improving despite price weakness",
        indicators: [
          `MVRV undervalued at ${mvrv.toFixed(2)}`,
          `Strong accumulation (${accumulationScore.toFixed(0)})`,
          "Smart money buying",
        ],
        timestamp: current.timestamp,
      };
    }

    // Bearish divergence: price up but fundamentals weakening
    if (mvrv > 3.0 && accumulationScore < -40 && nupl > 0.6) {
      return {
        type: "bearish_divergence",
        confidence: 80,
        signal: "bearish",
        description:
          "Bearish divergence - fundamentals weakening despite price strength",
        indicators: [
          `MVRV overvalued at ${mvrv.toFixed(2)}`,
          `Strong distribution (${accumulationScore.toFixed(0)})`,
          "Smart money selling",
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Detect HODL wave shift pattern
   * Significant changes in long-term holder behavior
   */
  private detectHODLWaveShift(
    current: OnChainMetrics,
    history: OnChainMetrics[]
  ): Pattern | null {
    if (!current.hodlWaves || history.length < 3) return null;

    const currentLTH = current.hodlWaves.over5y; // Long-term holders
    const previousLTH = history.at(-1)?.hodlWaves?.over5y ?? currentLTH;

    const lthChange = currentLTH - previousLTH;

    // Significant increase in long-term holders
    if (lthChange > 2) {
      return {
        type: "hodl_wave_shift",
        confidence: 75,
        signal: "bullish",
        description: "HODL wave shift - increasing long-term conviction",
        indicators: [
          `Long-term holders increased by ${lthChange.toFixed(1)}%`,
          `Current LTH: ${currentLTH.toFixed(1)}%`,
          "Strong holding behavior",
        ],
        timestamp: current.timestamp,
      };
    }

    // Significant decrease in long-term holders
    if (lthChange < -2) {
      return {
        type: "hodl_wave_shift",
        confidence: 75,
        signal: "bearish",
        description: "HODL wave shift - long-term holders distributing",
        indicators: [
          `Long-term holders decreased by ${Math.abs(lthChange).toFixed(1)}%`,
          `Current LTH: ${currentLTH.toFixed(1)}%`,
          "Potential distribution phase",
        ],
        timestamp: current.timestamp,
      };
    }

    return null;
  }

  /**
   * Calculate trend from array of values
   * Returns positive for uptrend, negative for downtrend
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const first = values[0] ?? 0;
    const last = values.at(-1) ?? 0;

    if (first === 0) return 0;

    return (last - first) / first;
  }

  /**
   * Calculate dominant signal from patterns
   */
  private calculateDominantSignal(patterns: Pattern[]): {
    dominantSignal: "bullish" | "bearish" | "neutral";
    strength: number;
  } {
    if (patterns.length === 0) {
      return { dominantSignal: "neutral", strength: 0 };
    }

    let bullishScore = 0;
    let bearishScore = 0;

    for (const pattern of patterns) {
      const weight = pattern.confidence / 100;

      if (pattern.signal === "bullish") {
        bullishScore += weight;
      } else if (pattern.signal === "bearish") {
        bearishScore += weight;
      }
    }

    const totalScore = bullishScore + bearishScore;
    const netScore = bullishScore - bearishScore;

    let dominantSignal: "bullish" | "bearish" | "neutral";
    if (netScore > 0.5) {
      dominantSignal = "bullish";
    } else if (netScore < -0.5) {
      dominantSignal = "bearish";
    } else {
      dominantSignal = "neutral";
    }

    const strength = totalScore > 0 ? Math.abs(netScore / totalScore) * 100 : 0;

    return { dominantSignal, strength: Math.min(strength, 100) };
  }
}
