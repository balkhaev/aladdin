/**
 * CVaR (Conditional Value at Risk) Calculator
 *
 * CVaR, also known as Expected Shortfall (ES), measures the expected loss
 * in the worst-case scenarios beyond the VaR threshold.
 *
 * It provides a more complete picture of tail risk compared to VaR alone:
 * - VaR: "What is the maximum loss at 95% confidence?"
 * - CVaR: "What is the AVERAGE loss in the worst 5% of cases?"
 *
 * CVaR is:
 * - Coherent risk measure (VaR is not)
 * - More conservative than VaR
 * - Better captures extreme tail risk
 * - Preferred by Basel III and modern risk management
 */

import type { Logger } from "@aladdin/shared/logger";

export type CVaRResult = {
  /** Conditional VaR at 95% confidence level */
  cvar95: number;
  /** Conditional VaR at 99% confidence level */
  cvar99: number;
  /** Regular VaR at 95% for comparison */
  var95: number;
  /** Regular VaR at 99% for comparison */
  var99: number;
  /** Current portfolio value */
  portfolioValue: number;
  /** Tail risk ratio (CVaR / VaR) - shows how much worse losses can be beyond VaR */
  tailRisk95: number;
  tailRisk99: number;
  /** Historical returns used for calculation */
  historicalReturns: number[];
  /** Timestamp of calculation */
  calculatedAt: Date;
};

export type CVaRScenario = {
  name: string;
  description: string;
  /** Expected loss as percentage of portfolio */
  expectedLoss: number;
  /** Probability of scenario */
  probability: number;
};

// Constants
const VAR_95_PERCENTILE = 0.05;
const VAR_99_PERCENTILE = 0.01;
const MIN_SAMPLES = 10;
const CONFIDENCE_LEVEL_95 = 95;
const CONFIDENCE_LEVEL_99 = 99;
const Z_SCORE_95 = 1.645;
const Z_SCORE_99 = 2.326;
const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const EXPONENT_DIVISOR = 2;

export class CVaRCalculator {
  constructor(private logger: Logger) {}

  /**
   * Calculate CVaR (Expected Shortfall) using historical simulation
   *
   * @param returns Array of historical daily returns (as decimals, e.g., -0.05 for -5%)
   * @param portfolioValue Current portfolio value
   * @param confidence Confidence level (95 or 99)
   * @returns CVaR result with VaR for comparison
   */
  calculate(
    returns: number[],
    portfolioValue: number,
    confidence: 95 | 99 = CONFIDENCE_LEVEL_95
  ): CVaRResult {
    if (returns.length < MIN_SAMPLES) {
      throw new Error(
        `Insufficient data for CVaR calculation. Required: ${MIN_SAMPLES} samples, got: ${returns.length}`
      );
    }

    this.logger.info("Calculating CVaR", {
      samples: returns.length,
      portfolioValue,
      confidence,
    });

    // Sort returns from worst (most negative) to best
    const sortedReturns = [...returns].sort((a, b) => a - b);

    // Calculate VaR and CVaR at both confidence levels
    const var95 = this.calculateVaR(
      sortedReturns,
      portfolioValue,
      CONFIDENCE_LEVEL_95
    );
    const var99 = this.calculateVaR(
      sortedReturns,
      portfolioValue,
      CONFIDENCE_LEVEL_99
    );

    const cvar95 = this.calculateCVaRFromSortedReturns(
      sortedReturns,
      portfolioValue,
      CONFIDENCE_LEVEL_95
    );
    const cvar99 = this.calculateCVaRFromSortedReturns(
      sortedReturns,
      portfolioValue,
      CONFIDENCE_LEVEL_99
    );

    // Calculate tail risk ratios
    const tailRisk95 = var95 > 0 ? cvar95 / var95 : 0;
    const tailRisk99 = var99 > 0 ? cvar99 / var99 : 0;

    this.logger.info("CVaR calculated", {
      cvar95,
      cvar99,
      var95,
      var99,
      tailRisk95,
      tailRisk99,
    });

    return {
      cvar95,
      cvar99,
      var95,
      var99,
      portfolioValue,
      tailRisk95,
      tailRisk99,
      historicalReturns: returns,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate parametric CVaR using normal distribution assumption
   * Faster but less accurate for fat-tailed distributions
   *
   * @param returns Historical returns
   * @param portfolioValue Current portfolio value
   * @param confidence Confidence level
   * @returns CVaR value
   */
  calculateParametric(
    returns: number[],
    portfolioValue: number,
    confidence: 95 | 99 = CONFIDENCE_LEVEL_95
  ): number {
    if (returns.length < MIN_SAMPLES) {
      throw new Error("Insufficient data for parametric CVaR calculation");
    }

    // Calculate mean and standard deviation
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Z-score for confidence level
    const zScore = confidence === CONFIDENCE_LEVEL_95 ? Z_SCORE_95 : Z_SCORE_99;

    // CVaR formula for normal distribution
    // CVaR = μ - σ * φ(z) / α
    // where φ is PDF of standard normal, α is tail probability
    const alpha =
      confidence === CONFIDENCE_LEVEL_95
        ? VAR_95_PERCENTILE
        : VAR_99_PERCENTILE;
    const phi = this.standardNormalPDF(zScore);

    const cvarReturn = mean - (stdDev * phi) / alpha;
    return Math.abs(cvarReturn * portfolioValue);
  }

  /**
   * Identify worst-case scenarios that contribute to CVaR
   *
   * @param returns Historical returns
   * @param confidence Confidence level
   * @returns Array of worst scenarios
   */
  identifyWorstScenarios(
    returns: number[],
    confidence: 95 | 99 = CONFIDENCE_LEVEL_95
  ): Array<{ return: number; date?: Date }> {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const percentile =
      confidence === CONFIDENCE_LEVEL_95
        ? VAR_95_PERCENTILE
        : VAR_99_PERCENTILE;
    const cutoffIndex = Math.ceil(sortedReturns.length * percentile);

    return sortedReturns.slice(0, cutoffIndex).map((r) => ({ return: r }));
  }

  /**
   * Calculate CVaR contribution by asset
   * Shows which assets contribute most to tail risk
   *
   * @param assetReturns Map of asset returns
   * @param portfolioWeights Map of portfolio weights
   * @param confidence Confidence level
   * @returns CVaR contribution per asset
   */
  calculateCVaRContribution(params: {
    assetReturns: Map<string, number[]>;
    portfolioWeights: Map<string, number>;
    confidence?: 95 | 99;
  }): Map<string, number> {
    const {
      assetReturns,
      portfolioWeights,
      confidence = CONFIDENCE_LEVEL_95,
    } = params;

    const contributions = new Map<string, number>();

    // Calculate portfolio returns
    const portfolioReturns = this.calculatePortfolioReturns(
      assetReturns,
      portfolioWeights
    );

    // Sort and find VaR threshold
    const sortedReturns = [...portfolioReturns].sort((a, b) => a - b);
    const percentile =
      confidence === CONFIDENCE_LEVEL_95
        ? VAR_95_PERCENTILE
        : VAR_99_PERCENTILE;
    const cutoffIndex = Math.ceil(sortedReturns.length * percentile);

    // For each asset, calculate its contribution in tail scenarios
    for (const [symbol, returns] of assetReturns) {
      const weight = portfolioWeights.get(symbol) ?? 0;

      // Calculate average contribution in tail scenarios
      let tailContribution = 0;
      for (let i = 0; i < cutoffIndex; i++) {
        tailContribution += returns[i] * weight;
      }
      tailContribution /= cutoffIndex;

      contributions.set(symbol, Math.abs(tailContribution));
    }

    return contributions;
  }

  /**
   * Calculate VaR from sorted returns
   * @private
   */
  private calculateVaR(
    sortedReturns: number[],
    portfolioValue: number,
    confidence: 95 | 99
  ): number {
    const percentile =
      confidence === CONFIDENCE_LEVEL_95
        ? VAR_95_PERCENTILE
        : VAR_99_PERCENTILE;
    const varIndex = Math.floor(sortedReturns.length * percentile);
    const varReturn = sortedReturns[varIndex] ?? 0;
    return Math.abs(varReturn * portfolioValue);
  }

  /**
   * Calculate CVaR from sorted returns (Expected Shortfall)
   * @private
   */
  private calculateCVaRFromSortedReturns(
    sortedReturns: number[],
    portfolioValue: number,
    confidence: 95 | 99
  ): number {
    const percentile =
      confidence === CONFIDENCE_LEVEL_95
        ? VAR_95_PERCENTILE
        : VAR_99_PERCENTILE;
    const cutoffIndex = Math.ceil(sortedReturns.length * percentile);

    // Average of all returns beyond VaR threshold
    const tailReturns = sortedReturns.slice(0, cutoffIndex);
    const avgTailReturn =
      tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;

    return Math.abs(avgTailReturn * portfolioValue);
  }

  /**
   * Standard normal PDF (probability density function)
   * @private
   */
  private standardNormalPDF(x: number): number {
    return Math.exp((-x * x) / EXPONENT_DIVISOR) / SQRT_TWO_PI;
  }

  /**
   * Calculate portfolio returns from asset returns and weights
   * @private
   */
  private calculatePortfolioReturns(
    assetReturns: Map<string, number[]>,
    portfolioWeights: Map<string, number>
  ): number[] {
    const numPeriods = assetReturns.values().next().value?.length ?? 0;
    const portfolioReturns: number[] = [];

    for (let i = 0; i < numPeriods; i++) {
      let periodReturn = 0;
      for (const [symbol, returns] of assetReturns) {
        const weight = portfolioWeights.get(symbol) ?? 0;
        periodReturn += (returns[i] ?? 0) * weight;
      }
      portfolioReturns.push(periodReturn);
    }

    return portfolioReturns;
  }
}
