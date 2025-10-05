import type { Logger } from "@aladdin/logger";
import type { PrismaClient } from "@prisma/client";

const PERCENT_MULTIPLIER = 100;
const KELLY_FRACTION = 0.25; // Use quarter Kelly for safety
const MIN_POSITION_SIZE = 0.001; // Minimum position size
const MAX_KELLY_FRACTION = 0.5; // Maximum Kelly fraction (50%)

/**
 * Position Sizer - Calculate optimal position sizes based on various methods
 */
export class PositionSizer {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  /**
   * Calculate position size using Kelly Criterion
   * Kelly % = (Win% * AvgWin - Loss% * AvgLoss) / AvgWin
   * 
   * @param winRate - Historical win rate (0-1)
   * @param avgWin - Average win amount
   * @param avgLoss - Average loss amount (positive number)
   * @param balance - Available balance
   * @param price - Current price
   * @returns Position quantity
   */
  calculateKellyPosition(params: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    balance: number;
    price: number;
    fractionalKelly?: number; // Default: 0.25 (quarter Kelly)
  }): number {
    const { winRate, avgWin, avgLoss, balance, price, fractionalKelly = KELLY_FRACTION } = params;

    // Validate inputs
    if (winRate <= 0 || winRate >= 1) {
      this.logger.warn("Invalid win rate for Kelly calculation", { winRate });
      return 0;
    }

    if (avgWin <= 0 || avgLoss <= 0) {
      this.logger.warn("Invalid avg win/loss for Kelly calculation", {
        avgWin,
        avgLoss,
      });
      return 0;
    }

    // Calculate Kelly percentage
    const lossRate = 1 - winRate;
    const kellyPercent = (winRate * avgWin - lossRate * avgLoss) / avgWin;

    // Apply fractional Kelly for safety (typically 25-50% of full Kelly)
    const adjustedKelly = Math.max(
      0,
      Math.min(kellyPercent * fractionalKelly, MAX_KELLY_FRACTION)
    );

    // Calculate position value
    const positionValue = balance * adjustedKelly;
    const quantity = positionValue / price;

    this.logger.debug("Kelly position calculated", {
      winRate,
      avgWin,
      avgLoss,
      kellyPercent: kellyPercent.toFixed(4),
      adjustedKelly: adjustedKelly.toFixed(4),
      positionValue: positionValue.toFixed(2),
      quantity: quantity.toFixed(8),
    });

    return Math.max(quantity, MIN_POSITION_SIZE);
  }

  /**
   * Calculate position size using fixed fractional method
   * Simple: risk a fixed percentage of balance
   * 
   * @param balance - Available balance
   * @param riskPercent - Risk percentage (e.g., 2 for 2%)
   * @param price - Current price
   * @param stopLossPrice - Stop-loss price (optional, uses riskPercent if not provided)
   * @returns Position quantity
   */
  calculateFixedFractional(params: {
    balance: number;
    riskPercent: number;
    price: number;
    stopLossPrice?: number;
  }): number {
    const { balance, riskPercent, price, stopLossPrice } = params;

    if (riskPercent <= 0 || riskPercent > 100) {
      this.logger.warn("Invalid risk percent", { riskPercent });
      return 0;
    }

    const riskAmount = balance * (riskPercent / PERCENT_MULTIPLIER);

    // If stop-loss is provided, calculate position size based on stop distance
    if (stopLossPrice && stopLossPrice !== price) {
      const stopDistance = Math.abs(price - stopLossPrice);
      const quantity = riskAmount / stopDistance;

      this.logger.debug("Fixed fractional position calculated with stop-loss", {
        balance,
        riskPercent,
        riskAmount: riskAmount.toFixed(2),
        price,
        stopLossPrice,
        stopDistance: stopDistance.toFixed(2),
        quantity: quantity.toFixed(8),
      });

      return Math.max(quantity, MIN_POSITION_SIZE);
    }

    // Without stop-loss, simply use percentage of balance
    const quantity = riskAmount / price;

    this.logger.debug("Fixed fractional position calculated", {
      balance,
      riskPercent,
      riskAmount: riskAmount.toFixed(2),
      price,
      quantity: quantity.toFixed(8),
    });

    return Math.max(quantity, MIN_POSITION_SIZE);
  }

  /**
   * Calculate position size based on volatility (ATR-based)
   * Adjusts position size inversely to volatility
   * 
   * @param balance - Available balance
   * @param price - Current price
   * @param atr - Average True Range (volatility measure)
   * @param targetRiskPercent - Target risk percentage
   * @returns Position quantity
   */
  calculateVolatilityAdjusted(params: {
    balance: number;
    price: number;
    atr: number;
    targetRiskPercent: number;
  }): number {
    const { balance, price, atr, targetRiskPercent } = params;

    if (atr <= 0) {
      this.logger.warn("Invalid ATR for volatility-based sizing", { atr });
      return this.calculateFixedFractional({
        balance,
        riskPercent: targetRiskPercent,
        price,
      });
    }

    const riskAmount = balance * (targetRiskPercent / PERCENT_MULTIPLIER);
    
    // Position size = Risk Amount / (ATR * Multiplier)
    // Using 2x ATR as typical stop distance
    const stopDistance = atr * 2;
    const quantity = riskAmount / stopDistance;

    this.logger.debug("Volatility-adjusted position calculated", {
      balance,
      price,
      atr: atr.toFixed(2),
      targetRiskPercent,
      riskAmount: riskAmount.toFixed(2),
      stopDistance: stopDistance.toFixed(2),
      quantity: quantity.toFixed(8),
    });

    return Math.max(quantity, MIN_POSITION_SIZE);
  }

  /**
   * Get historical trading statistics for Kelly calculation
   */
  async getHistoricalStats(userId: string, days = 30): Promise<{
    winRate: number;
    avgWin: number;
    avgLoss: number;
    totalTrades: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get closed positions (trades) from database
    const trades = await this.prisma.position.findMany({
      where: {
        portfolio: { userId },
        createdAt: { gte: startDate },
        // Only closed positions have PnL
        pnl: { not: "0" },
      },
      select: {
        pnl: true,
      },
    });

    if (trades.length === 0) {
      this.logger.warn("No historical trades found for user", { userId, days });
      return {
        winRate: 0.5, // Default to 50%
        avgWin: 0,
        avgLoss: 0,
        totalTrades: 0,
      };
    }

    const winningTrades = trades.filter(
      (t) => Number(t.pnl) > 0
    );
    const losingTrades = trades.filter((t) => Number(t.pnl) < 0);

    const winRate = winningTrades.length / trades.length;

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + Number(t.pnl), 0) /
          winningTrades.length
        : 0;

    const avgLoss =
      losingTrades.length > 0
        ? Math.abs(
            losingTrades.reduce((sum, t) => sum + Number(t.pnl), 0) /
              losingTrades.length
          )
        : 0;

    this.logger.debug("Historical stats calculated", {
      userId,
      days,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winRate.toFixed(2),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
    });

    return {
      winRate,
      avgWin,
      avgLoss,
      totalTrades: trades.length,
    };
  }

  /**
   * Calculate recommended position size based on user's trading history
   * Automatically selects the best method based on available data
   */
  async calculateRecommendedSize(params: {
    userId: string;
    balance: number;
    price: number;
    stopLossPrice?: number;
    atr?: number;
    defaultRiskPercent?: number;
  }): Promise<{
    quantity: number;
    method: "kelly" | "fixed-fractional" | "volatility-adjusted";
    details: Record<string, unknown>;
  }> {
    const {
      userId,
      balance,
      price,
      stopLossPrice,
      atr,
      defaultRiskPercent = 2,
    } = params;

    // Get historical stats
    const stats = await this.getHistoricalStats(userId);

    // Use Kelly if we have enough trading history (min 20 trades)
    if (stats.totalTrades >= 20 && stats.avgWin > 0 && stats.avgLoss > 0) {
      const quantity = this.calculateKellyPosition({
        winRate: stats.winRate,
        avgWin: stats.avgWin,
        avgLoss: stats.avgLoss,
        balance,
        price,
      });

      return {
        quantity,
        method: "kelly",
        details: {
          winRate: stats.winRate,
          avgWin: stats.avgWin,
          avgLoss: stats.avgLoss,
          totalTrades: stats.totalTrades,
        },
      };
    }

    // Use volatility-adjusted if ATR is available
    if (atr && atr > 0) {
      const quantity = this.calculateVolatilityAdjusted({
        balance,
        price,
        atr,
        targetRiskPercent: defaultRiskPercent,
      });

      return {
        quantity,
        method: "volatility-adjusted",
        details: {
          atr,
          targetRiskPercent: defaultRiskPercent,
        },
      };
    }

    // Default to fixed fractional
    const quantity = this.calculateFixedFractional({
      balance,
      riskPercent: defaultRiskPercent,
      price,
      stopLossPrice,
    });

    return {
      quantity,
      method: "fixed-fractional",
      details: {
        riskPercent: defaultRiskPercent,
        stopLossPrice,
      },
    };
  }
}

