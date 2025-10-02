/**
 * Advanced Performance Metrics
 *
 * Implements professional-grade performance metrics for portfolio analysis:
 * - Sortino Ratio (downside risk)
 * - Calmar Ratio (return vs max drawdown)
 * - Information Ratio (excess return vs benchmark)
 * - Omega Ratio (probability-weighted gains/losses)
 * - Trading Statistics (win rate, profit factor, etc.)
 */

export type TradingStats = {
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
};

export type AdvancedMetrics = {
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  omegaRatio: number;
  ulcerIndex: number;
};

/**
 * Calculate Sortino Ratio
 * Sortino = (Return - Risk-free rate) / Downside Deviation
 *
 * Unlike Sharpe ratio, only considers downside volatility (losses).
 * More accurate for asymmetric return distributions.
 *
 * @param returns Array of period returns
 * @param riskFreeRate Annual risk-free rate (default: 2%)
 * @param targetReturn Target return threshold (default: 0)
 * @returns Annualized Sortino Ratio
 */
export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate = 0.02,
  targetReturn = 0
): number {
  const MIN_RETURNS = 2;
  const DAYS_PER_YEAR = 365;

  if (returns.length < MIN_RETURNS) return 0;

  const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate downside deviation (only negative returns)
  const downsideReturns = returns.filter((r) => r < targetReturn);
  if (downsideReturns.length === 0) return Number.POSITIVE_INFINITY;

  const downsideVariance =
    downsideReturns.reduce((sum, r) => sum + (r - targetReturn) ** 2, 0) /
    downsideReturns.length;

  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return Number.POSITIVE_INFINITY;

  // Annualize (assuming daily returns)
  const dailyRiskFreeRate = riskFreeRate / DAYS_PER_YEAR;
  return (
    ((meanReturn - dailyRiskFreeRate) / downsideDeviation) *
    Math.sqrt(DAYS_PER_YEAR)
  );
}

/**
 * Calculate Calmar Ratio
 * Calmar = Annualized Return / Max Drawdown
 *
 * Shows return relative to worst drawdown.
 * Higher is better. Typically 3+ is excellent.
 *
 * @param portfolioValues Array of portfolio values over time
 * @param timeframeDays Number of days in the period
 * @returns Calmar Ratio
 */
export function calculateCalmarRatio(
  portfolioValues: number[],
  timeframeDays: number
): number {
  const MIN_VALUES = 2;
  const DAYS_PER_YEAR = 365;
  const PERCENT_TO_DECIMAL = 100;

  if (portfolioValues.length < MIN_VALUES) return 0;

  // Calculate annualized return
  const initialValue = portfolioValues[0];
  const finalValue = portfolioValues.at(-1) ?? 0;
  const totalReturn = (finalValue - initialValue) / initialValue;
  const annualizedReturn = totalReturn * (DAYS_PER_YEAR / timeframeDays);

  // Calculate max drawdown
  const maxDrawdown = calculateMaxDrawdownValue(portfolioValues);

  if (maxDrawdown === 0) return Number.POSITIVE_INFINITY;

  return annualizedReturn / (maxDrawdown / PERCENT_TO_DECIMAL);
}

/**
 * Calculate Maximum Drawdown (helper function)
 * @param values Array of portfolio values
 * @returns Max drawdown as percentage
 */
function calculateMaxDrawdownValue(values: number[]): number {
  const PERCENT_MULTIPLIER = 100;

  let maxDrawdown = 0;
  let peak = values[0];

  for (const value of values) {
    if (value > peak) peak = value;
    const drawdown = ((peak - value) / peak) * PERCENT_MULTIPLIER;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  return maxDrawdown;
}

/**
 * Calculate Information Ratio
 * IR = (Portfolio Return - Benchmark Return) / Tracking Error
 *
 * Shows excess return relative to benchmark volatility.
 * Measures consistency of outperformance.
 *
 * @param portfolioReturns Array of portfolio returns
 * @param benchmarkReturns Array of benchmark returns (same length)
 * @returns Annualized Information Ratio
 */
export function calculateInformationRatio(params: {
  portfolioReturns: number[];
  benchmarkReturns: number[];
}): number {
  const MIN_RETURNS = 2;
  const DAYS_PER_YEAR = 365;

  const { portfolioReturns, benchmarkReturns } = params;

  if (portfolioReturns.length !== benchmarkReturns.length) {
    throw new Error("Portfolio and benchmark returns must have same length");
  }

  if (portfolioReturns.length < MIN_RETURNS) return 0;

  // Calculate excess returns (alpha)
  const excessReturns = portfolioReturns.map((r, i) => r - benchmarkReturns[i]);

  // Mean excess return
  const meanExcessReturn =
    excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;

  // Tracking error (standard deviation of excess returns)
  const variance =
    excessReturns.reduce((sum, r) => sum + (r - meanExcessReturn) ** 2, 0) /
    excessReturns.length;

  const trackingError = Math.sqrt(variance);

  if (trackingError === 0) return Number.POSITIVE_INFINITY;

  // Annualize (assuming daily returns)
  return (meanExcessReturn / trackingError) * Math.sqrt(DAYS_PER_YEAR);
}

/**
 * Calculate Omega Ratio
 * Omega = Sum(Gains above threshold) / Sum(Losses below threshold)
 *
 * Probability-weighted ratio of gains vs losses.
 * Captures full return distribution, not just mean/variance.
 *
 * @param returns Array of returns
 * @param threshold Return threshold (default: 0)
 * @returns Omega Ratio
 */
export function calculateOmegaRatio(returns: number[], threshold = 0): number {
  if (returns.length === 0) return 0;

  const gains = returns
    .filter((r) => r > threshold)
    .reduce((sum, r) => sum + (r - threshold), 0);

  const losses = returns
    .filter((r) => r < threshold)
    .reduce((sum, r) => sum + (threshold - r), 0);

  if (losses === 0) return Number.POSITIVE_INFINITY;

  return gains / losses;
}

/**
 * Calculate Ulcer Index
 * Measures stress from drawdowns.
 * Lower is better. Penalizes deep and prolonged drawdowns.
 *
 * @param portfolioValues Array of portfolio values
 * @returns Ulcer Index
 */
export function calculateUlcerIndex(portfolioValues: number[]): number {
  const MIN_VALUES = 2;
  const PERCENT_MULTIPLIER = 100;

  if (portfolioValues.length < MIN_VALUES) return 0;

  let peak = portfolioValues[0];
  let sumSquaredDrawdowns = 0;

  for (const value of portfolioValues) {
    if (value > peak) peak = value;
    const drawdownPercent = ((peak - value) / peak) * PERCENT_MULTIPLIER;
    sumSquaredDrawdowns += drawdownPercent ** 2;
  }

  return Math.sqrt(sumSquaredDrawdowns / portfolioValues.length);
}

/**
 * Calculate comprehensive trading statistics
 *
 * @param trades Array of trades with P&L
 * @returns Trading statistics object
 */
export function calculateTradingStats(
  trades: Array<{ pnl: number }>
): TradingStats {
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl < 0);

  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  // Calculate consecutive wins/losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of trades) {
    if (trade.pnl > 0) {
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else if (trade.pnl < 0) {
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }
  }

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate:
      trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    profitFactor:
      totalLosses > 0 ? totalWins / totalLosses : Number.POSITIVE_INFINITY,
    avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    largestWin:
      winningTrades.length > 0
        ? Math.max(...winningTrades.map((t) => t.pnl))
        : 0,
    largestLoss:
      losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.pnl)) : 0,
    consecutiveWins: maxConsecutiveWins,
    consecutiveLosses: maxConsecutiveLosses,
  };
}

/**
 * Calculate all advanced metrics at once
 *
 * @param params Portfolio data
 * @returns All advanced metrics
 */
export function calculateAllAdvancedMetrics(params: {
  returns: number[];
  portfolioValues: number[];
  benchmarkReturns?: number[];
  timeframeDays: number;
}): AdvancedMetrics {
  const { returns, portfolioValues, benchmarkReturns, timeframeDays } = params;

  return {
    sortinoRatio: calculateSortinoRatio(returns),
    calmarRatio: calculateCalmarRatio(portfolioValues, timeframeDays),
    informationRatio: benchmarkReturns
      ? calculateInformationRatio({
          portfolioReturns: returns,
          benchmarkReturns,
        })
      : 0,
    omegaRatio: calculateOmegaRatio(returns),
    ulcerIndex: calculateUlcerIndex(portfolioValues),
  };
}
