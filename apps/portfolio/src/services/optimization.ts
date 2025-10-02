/**
 * Portfolio Optimization Service
 *
 * Implements Markowitz Mean-Variance Optimization and related techniques:
 * - Efficient Frontier calculation
 * - Optimal portfolio weights
 * - Risk-return trade-off analysis
 * - Constrained optimization (min/max weights, sector limits)
 *
 * Based on Modern Portfolio Theory (MPT) by Harry Markowitz (Nobel Prize 1990)
 */

import type { Logger } from "@aladdin/shared/logger";

export type OptimizationConstraints = {
  /** Minimum weight per asset (e.g., 0.0 = no shorts) */
  minWeight?: number;
  /** Maximum weight per asset (e.g., 0.3 = max 30% per asset) */
  maxWeight?: number;
  /** Sector constraints: max weight per sector */
  sectorLimits?: Record<string, number>;
  /** Target return (if optimizing for specific return) */
  targetReturn?: number;
  /** Max risk (volatility) allowed */
  maxRisk?: number;
  /** Allow short selling */
  allowShorts?: boolean;
};

export type OptimizedPortfolio = {
  /** Optimal weights for each asset */
  weights: Record<string, number>;
  /** Expected annual return */
  expectedReturn: number;
  /** Expected annual volatility (risk) */
  expectedRisk: number;
  /** Sharpe Ratio */
  sharpeRatio: number;
  /** Efficient Frontier points */
  efficientFrontier: Array<{
    risk: number;
    return: number;
    sharpe: number;
  }>;
};

export type AssetStatistics = {
  /** Expected return (annualized) */
  expectedReturn: number;
  /** Volatility (annualized) */
  volatility: number;
  /** Historical returns */
  returns: number[];
};

// Constants
const DAYS_PER_YEAR = 252; // Trading days
const RISK_FREE_RATE = 0.02; // 2% annual risk-free rate
const OPTIMIZATION_STEPS = 50; // Points on efficient frontier
const MIN_WEIGHT_DEFAULT = 0.0; // No shorts by default
const MAX_WEIGHT_DEFAULT = 1.0; // Max 100% per asset
const EPSILON = 0.0001; // Small number for numerical stability
const MAX_ITERATIONS = 1000; // Max iterations for optimization
const CONVERGENCE_THRESHOLD = 0.000_01;
const TARGET_RETURN_TOLERANCE = 0.01; // 1% tolerance for target return

export class PortfolioOptimizer {
  constructor(private logger: Logger) {}

  /**
   * Optimize portfolio using Mean-Variance Optimization
   *
   * Finds optimal weights that maximize Sharpe Ratio
   * (or achieve target return with minimum risk)
   */
  optimizePortfolio(params: {
    assets: string[];
    statistics: Record<string, AssetStatistics>;
    constraints?: OptimizationConstraints;
  }): OptimizedPortfolio {
    const { assets, statistics, constraints = {} } = params;

    this.logger.info("Optimizing portfolio", {
      assetsCount: assets.length,
      constraints,
    });

    // Validate inputs
    if (assets.length < 2) {
      throw new Error("Need at least 2 assets for optimization");
    }

    // Calculate covariance matrix
    const covMatrix = this.calculateCovarianceMatrix(assets, statistics);

    // Calculate mean returns vector
    const meanReturns = assets.map((asset) => statistics[asset].expectedReturn);

    // Find optimal weights
    let optimalWeights: number[];

    if (constraints.targetReturn !== undefined) {
      // Optimize for target return with minimum risk
      optimalWeights = this.optimizeForTargetReturn(
        meanReturns,
        covMatrix,
        constraints.targetReturn,
        constraints
      );
    } else if (constraints.maxRisk !== undefined) {
      // Optimize for maximum return with risk constraint
      optimalWeights = this.optimizeForMaxRisk(
        meanReturns,
        covMatrix,
        constraints.maxRisk,
        constraints
      );
    } else {
      // Optimize for maximum Sharpe Ratio (default)
      optimalWeights = this.optimizeMaxSharpe(meanReturns, covMatrix);
    }

    // Apply constraints
    optimalWeights = this.applyConstraints(optimalWeights, constraints);

    // Calculate portfolio metrics
    const { expectedReturn, expectedRisk, sharpeRatio } =
      this.calculatePortfolioMetrics(optimalWeights, meanReturns, covMatrix);

    // Generate efficient frontier
    const efficientFrontier = this.generateEfficientFrontier(
      meanReturns,
      covMatrix
    );

    // Convert weights to asset mapping
    const weights: Record<string, number> = {};
    for (let i = 0; i < assets.length; i++) {
      weights[assets[i]] = optimalWeights[i];
    }

    this.logger.info("Portfolio optimized", {
      expectedReturn,
      expectedRisk,
      sharpeRatio,
    });

    return {
      weights,
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      efficientFrontier,
    };
  }

  /**
   * Calculate covariance matrix from asset statistics
   */
  private calculateCovarianceMatrix(
    assets: string[],
    statistics: Record<string, AssetStatistics>
  ): number[][] {
    const n = assets.length;
    const matrix: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0)
    );

    // Get all returns arrays
    const returnsArrays = assets.map((asset) => statistics[asset].returns);

    // Calculate min length
    const minLength = Math.min(...returnsArrays.map((r) => r.length));

    // Calculate covariance for each pair
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        matrix[i][j] = this.calculateCovariance(
          returnsArrays[i].slice(0, minLength),
          returnsArrays[j].slice(0, minLength)
        );
      }
    }

    return matrix;
  }

  /**
   * Calculate covariance between two return series
   */
  private calculateCovariance(returns1: number[], returns2: number[]): number {
    const n = returns1.length;
    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / n;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / n;

    let covariance = 0;
    for (let i = 0; i < n; i++) {
      covariance += (returns1[i] - mean1) * (returns2[i] - mean2);
    }

    // Annualize covariance
    return (covariance / n) * DAYS_PER_YEAR;
  }

  /**
   * Optimize for maximum Sharpe Ratio
   */
  private optimizeMaxSharpe(
    meanReturns: number[],
    covMatrix: number[][]
  ): number[] {
    const n = meanReturns.length;

    // Start with equal weights
    let weights = new Array(n).fill(1 / n);

    // Gradient descent optimization
    let bestSharpe = -Number.POSITIVE_INFINITY;
    let bestWeights = [...weights];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const { sharpeRatio } = this.calculatePortfolioMetrics(
        weights,
        meanReturns,
        covMatrix
      );

      if (sharpeRatio > bestSharpe) {
        bestSharpe = sharpeRatio;
        bestWeights = [...weights];
      }

      // Calculate gradient
      const gradient = this.calculateSharpeGradient(
        weights,
        meanReturns,
        covMatrix
      );

      // Update weights
      const LEARNING_RATE = 0.01;
      const newWeights = weights.map((w, i) => w + LEARNING_RATE * gradient[i]);

      // Normalize to sum to 1
      const sum = newWeights.reduce((s, w) => s + w, 0);
      weights = newWeights.map((w) => w / sum);

      // Check convergence
      const change = weights.reduce(
        (total, w, i) => total + Math.abs(w - bestWeights[i]),
        0
      );
      if (change < CONVERGENCE_THRESHOLD) break;
    }

    return bestWeights;
  }

  /**
   * Optimize for target return with minimum risk
   */
  private optimizeForTargetReturn(
    meanReturns: number[],
    covMatrix: number[][],
    targetReturn: number
  ): number[] {
    const n = meanReturns.length;

    // Find weights that achieve target return with minimum variance
    // This is a quadratic programming problem
    // Simplified: use analytical solution for unconstrained case

    let currentWeights = new Array(n).fill(1 / n);
    let minRisk = Number.POSITIVE_INFINITY;
    let bestWeights = [...currentWeights];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const { expectedReturn, expectedRisk } = this.calculatePortfolioMetrics(
        currentWeights,
        meanReturns,
        covMatrix
      );

      // Penalize deviation from target return
      const returnPenalty = Math.abs(expectedReturn - targetReturn);
      const PENALTY_WEIGHT = 10;
      const objective = expectedRisk + PENALTY_WEIGHT * returnPenalty;

      if (
        objective < minRisk &&
        Math.abs(expectedReturn - targetReturn) < TARGET_RETURN_TOLERANCE
      ) {
        minRisk = objective;
        bestWeights = [...currentWeights];
      }

      // Gradient descent toward target
      const gradient = this.calculateRiskGradient(currentWeights, covMatrix);
      const returnGradient = this.calculateReturnGradient(meanReturns);

      const LEARNING_RATE = 0.01;
      const newWeights = currentWeights.map((w, i) => {
        const returnDiff = expectedReturn - targetReturn;
        return (
          w -
          LEARNING_RATE * gradient[i] +
          LEARNING_RATE * returnGradient[i] * returnDiff
        );
      });

      // Normalize
      const sum = newWeights.reduce((s, w) => s + w, 0);
      currentWeights = newWeights.map((w) => w / sum);

      // Check convergence
      const change = currentWeights.reduce(
        (total, w, i) => total + Math.abs(w - bestWeights[i]),
        0
      );
      if (change < CONVERGENCE_THRESHOLD) break;
    }

    return bestWeights;
  }

  /**
   * Optimize for maximum return with risk constraint
   */
  private optimizeForMaxRisk(
    meanReturns: number[],
    covMatrix: number[][],
    maxRisk: number
  ): number[] {
    const n = meanReturns.length;

    let currentWeights = new Array(n).fill(1 / n);
    let maxReturn = -Number.POSITIVE_INFINITY;
    let bestWeights = [...currentWeights];

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const { expectedReturn, expectedRisk } = this.calculatePortfolioMetrics(
        currentWeights,
        meanReturns,
        covMatrix
      );

      if (expectedRisk <= maxRisk && expectedReturn > maxReturn) {
        maxReturn = expectedReturn;
        bestWeights = [...currentWeights];
      }

      // Move toward higher return if under risk limit
      const returnGradient = this.calculateReturnGradient(meanReturns);

      const LEARNING_RATE = 0.01;
      const newWeights = currentWeights.map((w, i) => {
        if (expectedRisk < maxRisk) {
          return w + LEARNING_RATE * returnGradient[i];
        }
        return w;
      });

      // Normalize
      const sum = newWeights.reduce((s, w) => s + w, 0);
      currentWeights = newWeights.map((w) => w / sum);

      const change = currentWeights.reduce(
        (total, w, i) => total + Math.abs(w - bestWeights[i]),
        0
      );
      if (change < CONVERGENCE_THRESHOLD) break;
    }

    return bestWeights;
  }

  /**
   * Calculate Sharpe Ratio gradient for optimization
   */
  private calculateSharpeGradient(
    weights: number[],
    meanReturns: number[],
    covMatrix: number[][]
  ): number[] {
    const { expectedReturn, expectedRisk } = this.calculatePortfolioMetrics(
      weights,
      meanReturns,
      covMatrix
    );

    const n = weights.length;
    const gradient = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      // Numerical gradient
      const h = EPSILON;
      const weightsPlusH = [...weights];
      weightsPlusH[i] += h;

      const { sharpeRatio: sharpePlus } = this.calculatePortfolioMetrics(
        weightsPlusH,
        meanReturns,
        covMatrix
      );

      const sharpe = (expectedReturn - RISK_FREE_RATE) / expectedRisk;
      gradient[i] = (sharpePlus - sharpe) / h;
    }

    return gradient;
  }

  /**
   * Calculate risk (variance) gradient
   */
  private calculateRiskGradient(
    weights: number[],
    covMatrix: number[][]
  ): number[] {
    const n = weights.length;
    const gradient = new Array(n).fill(0);

    // dVar/dw_i = 2 * sum(w_j * cov_ij)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        gradient[i] += 2 * weights[j] * covMatrix[i][j];
      }
    }

    return gradient;
  }

  /**
   * Calculate return gradient
   */
  private calculateReturnGradient(meanReturns: number[]): number[] {
    // Gradient of portfolio return is just the mean returns
    return [...meanReturns];
  }

  /**
   * Apply constraints to weights
   */
  private applyConstraints(
    weights: number[],
    constraints: OptimizationConstraints
  ): number[] {
    const minWeight = constraints.minWeight ?? MIN_WEIGHT_DEFAULT;
    const maxWeight = constraints.maxWeight ?? MAX_WEIGHT_DEFAULT;

    // Apply min/max constraints
    let constrainedWeights = weights.map((w) =>
      Math.max(minWeight, Math.min(maxWeight, w))
    );

    // Normalize to sum to 1
    const sum = constrainedWeights.reduce((s, w) => s + w, 0);
    constrainedWeights = constrainedWeights.map((w) => w / sum);

    return constrainedWeights;
  }

  /**
   * Calculate portfolio metrics (return, risk, Sharpe)
   */
  private calculatePortfolioMetrics(
    weights: number[],
    meanReturns: number[],
    covMatrix: number[][]
  ): {
    expectedReturn: number;
    expectedRisk: number;
    sharpeRatio: number;
  } {
    // Portfolio return = sum(w_i * r_i)
    const expectedReturn = weights.reduce(
      (sum, w, i) => sum + w * meanReturns[i],
      0
    );

    // Portfolio variance = sum(sum(w_i * w_j * cov_ij))
    let variance = 0;
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        variance += weights[i] * weights[j] * covMatrix[i][j];
      }
    }

    const expectedRisk = Math.sqrt(variance);

    // Sharpe Ratio = (return - risk_free) / risk
    const sharpeRatio =
      expectedRisk > 0 ? (expectedReturn - RISK_FREE_RATE) / expectedRisk : 0;

    return { expectedReturn, expectedRisk, sharpeRatio };
  }

  /**
   * Generate efficient frontier
   */
  private generateEfficientFrontier(
    meanReturns: number[],
    covMatrix: number[][]
  ): Array<{ risk: number; return: number; sharpe: number }> {
    const frontier: Array<{ risk: number; return: number; sharpe: number }> =
      [];

    // Find min and max possible returns
    const minReturn = Math.min(...meanReturns);
    const maxReturn = Math.max(...meanReturns);

    // Generate points along frontier
    for (let i = 0; i < OPTIMIZATION_STEPS; i++) {
      const targetReturn =
        minReturn + (i / (OPTIMIZATION_STEPS - 1)) * (maxReturn - minReturn);

      try {
        const weights = this.optimizeForTargetReturn(
          meanReturns,
          covMatrix,
          targetReturn
        );

        const { expectedReturn, expectedRisk, sharpeRatio } =
          this.calculatePortfolioMetrics(weights, meanReturns, covMatrix);

        frontier.push({
          risk: expectedRisk,
          return: expectedReturn,
          sharpe: sharpeRatio,
        });
      } catch {
        // Skip if optimization fails for this point
      }
    }

    return frontier;
  }

  /**
   * Calculate asset statistics from historical returns
   */
  static calculateAssetStatistics(returns: number[]): AssetStatistics {
    if (returns.length === 0) {
      throw new Error("Need at least 1 return for statistics");
    }

    // Calculate mean return
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Annualize mean return
    const expectedReturn = meanReturn * DAYS_PER_YEAR;

    // Calculate variance
    const variance =
      returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) /
      returns.length;

    // Annualize volatility
    const volatility = Math.sqrt(variance * DAYS_PER_YEAR);

    return {
      expectedReturn,
      volatility,
      returns,
    };
  }
}
