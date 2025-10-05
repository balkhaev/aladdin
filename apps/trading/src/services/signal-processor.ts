import type { Logger } from "@aladdin/logger";

export type TradingSignal = {
  symbol: string;
  recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL";
  confidence: number; // 0-1
  indicators?: Record<string, unknown>;
  sentiment?: number; // -1 to 1
  source: "screener" | "telegram" | "sentiment";
  timestamp: Date;
};

export type ProcessedSignal = TradingSignal & {
  shouldExecute: boolean;
  reason?: string;
  positionSize?: number;
  stopLoss?: number;
  takeProfit?: number;
};

const MIN_CONFIDENCE = 0.6; // Minimum confidence to execute
const STRONG_BUY_CONFIDENCE = 0.8;

/**
 * Signal Processor - processes trading signals and decides execution
 */
export class SignalProcessor {
  constructor(private logger: Logger) {}

  /**
   * Process a trading signal
   */
  processSignal(signal: TradingSignal): ProcessedSignal {
    this.logger.debug("Processing signal", signal);

    // Check if signal meets minimum confidence
    if (signal.confidence < MIN_CONFIDENCE) {
      return {
        ...signal,
        shouldExecute: false,
        reason: `Confidence too low: ${signal.confidence.toFixed(2)} < ${MIN_CONFIDENCE}`,
      };
    }

    // Only execute BUY signals (can be extended later)
    if (
      signal.recommendation !== "BUY" &&
      signal.recommendation !== "STRONG_BUY"
    ) {
      return {
        ...signal,
        shouldExecute: false,
        reason: "Only BUY signals are executed automatically",
      };
    }

    // Calculate position size based on confidence
    const basePositionSize = 0.02; // 2% of portfolio
    const confidenceMultiplier =
      signal.recommendation === "STRONG_BUY" ? 1.5 : 1.0;
    const positionSize = basePositionSize * confidenceMultiplier;

    return {
      ...signal,
      shouldExecute: true,
      positionSize,
      reason: `Signal meets criteria (confidence: ${signal.confidence.toFixed(2)})`,
    };
  }

  /**
   * Combine signals from multiple sources
   */
  combineSignals(signals: TradingSignal[]): ProcessedSignal | null {
    if (signals.length === 0) {
      return null;
    }

    // Group by symbol
    const bySymbol = new Map<string, TradingSignal[]>();
    for (const signal of signals) {
      const existing = bySymbol.get(signal.symbol) || [];
      existing.push(signal);
      bySymbol.set(signal.symbol, existing);
    }

    // Find symbol with strongest signals
    let bestSymbol = "";
    let bestScore = 0;

    for (const [symbol, symbolSignals] of bySymbol.entries()) {
      // Calculate weighted score
      const score =
        symbolSignals.reduce((sum, s) => {
          let weight = s.confidence;
          if (s.recommendation === "STRONG_BUY") weight *= 1.5;
          if (s.source === "telegram") weight *= 1.2; // Trust telegram signals more
          return sum + weight;
        }, 0) / symbolSignals.length;

      if (score > bestScore) {
        bestScore = score;
        bestSymbol = symbol;
      }
    }

    if (bestScore < MIN_CONFIDENCE) {
      return null;
    }

    // Create combined signal
    const symbolSignals = bySymbol.get(bestSymbol)!;
    const avgConfidence =
      symbolSignals.reduce((sum, s) => sum + s.confidence, 0) /
      symbolSignals.length;

    const recommendation =
      bestScore >= STRONG_BUY_CONFIDENCE ? "STRONG_BUY" : "BUY";

    const combinedSignal: TradingSignal = {
      symbol: bestSymbol,
      recommendation,
      confidence: avgConfidence,
      sentiment: symbolSignals.find((s) => s.sentiment !== undefined)
        ?.sentiment,
      source: "screener", // Primary source
      timestamp: new Date(),
    };

    return this.processSignal(combinedSignal);
  }

  /**
   * Filter signals by risk criteria
   */
  filterByRisk(
    signals: ProcessedSignal[],
    maxOpenPositions: number,
    currentOpenPositions: number
  ): ProcessedSignal[] {
    // Don't open new positions if at max
    if (currentOpenPositions >= maxOpenPositions) {
      this.logger.info("Max open positions reached, filtering all signals", {
        current: currentOpenPositions,
        max: maxOpenPositions,
      });
      return [];
    }

    // Filter by confidence and sort by confidence descending
    const filtered = signals
      .filter((s) => s.shouldExecute)
      .sort((a, b) => b.confidence - a.confidence);

    // Limit to available slots
    const available = maxOpenPositions - currentOpenPositions;
    return filtered.slice(0, available);
  }
}
