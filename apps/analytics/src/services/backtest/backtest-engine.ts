/**
 * Backtest Engine
 * Runs trading strategies against historical data
 */

import type { Candle } from "@aladdin/core";
import type { BaseStrategy, StrategyTrade } from "./base-strategy";

/**
 * Backtest configuration
 */
export type BacktestConfig = {
  strategy: BaseStrategy;
  candles: Candle[];
  initialBalance: number;
  commission?: number; // Commission per trade (default: 0.001 = 0.1%)
  slippage?: number; // Slippage per trade (default: 0.0005 = 0.05%)
};

/**
 * Backtest result
 */
export type BacktestResult = {
  strategy: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  trades: StrategyTrade[];
  equityCurve: Array<{ timestamp: number; balance: number }>;
};

const DEFAULT_COMMISSION = 0.001; // 0.1%
const DEFAULT_SLIPPAGE = 0.0005; // 0.05%

/**
 * Backtest Engine
 */
export class BacktestEngine {
  private config: Required<BacktestConfig>;

  constructor(config: BacktestConfig) {
    this.config = {
      ...config,
      commission: config.commission ?? DEFAULT_COMMISSION,
      slippage: config.slippage ?? DEFAULT_SLIPPAGE,
    };
  }

  /**
   * Run backtest
   */
  run(): BacktestResult {
    const { strategy, candles, initialBalance } = this.config;

    let balance = initialBalance;
    let position = 0; // Current position size
    let entryPrice = 0; // Entry price for current position
    const trades: StrategyTrade[] = [];
    const equityCurve: Array<{ timestamp: number; balance: number }> = [];

    let maxBalance = initialBalance;
    let maxDrawdown = 0;

    // Run strategy on each candle
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const signal = strategy.analyze(candles, i);

      // Record equity
      const equity = position > 0 ? balance + position * candle.close : balance;
      equityCurve.push({
        timestamp: candle.timestamp,
        balance: equity,
      });

      // Update max drawdown
      if (equity > maxBalance) {
        maxBalance = equity;
      }
      const drawdown = maxBalance - equity;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      // Execute trades based on signal
      if (signal === "BUY" && position === 0) {
        // Open long position
        const price = this.getExecutionPrice(candle.close, "BUY");
        const quantity = strategy.calculatePositionSize(balance, price);
        const cost = quantity * price * (1 + this.config.commission);

        if (cost <= balance) {
          position = quantity;
          entryPrice = price;
          balance -= cost;

          trades.push({
            timestamp: candle.timestamp,
            type: "BUY",
            price,
            quantity,
          });
        }
      } else if (signal === "SELL" && position > 0) {
        // Close long position
        const price = this.getExecutionPrice(candle.close, "SELL");
        const revenue = position * price * (1 - this.config.commission);

        balance += revenue;

        trades.push({
          timestamp: candle.timestamp,
          type: "SELL",
          price,
          quantity: position,
        });

        position = 0;
        entryPrice = 0;
      }
    }

    // Close any remaining position at last candle
    if (position > 0) {
      const lastCandle = candles[candles.length - 1];
      const price = this.getExecutionPrice(lastCandle.close, "SELL");
      const revenue = position * price * (1 - this.config.commission);

      balance += revenue;

      trades.push({
        timestamp: lastCandle.timestamp,
        type: "SELL",
        price,
        quantity: position,
      });
    }

    // Calculate statistics
    return this.calculateStatistics(
      trades,
      initialBalance,
      balance,
      maxDrawdown,
      equityCurve
    );
  }

  /**
   * Get execution price with slippage
   */
  private getExecutionPrice(price: number, side: "BUY" | "SELL"): number {
    const slippageFactor =
      side === "BUY" ? 1 + this.config.slippage : 1 - this.config.slippage;
    return price * slippageFactor;
  }

  /**
   * Calculate backtest statistics
   */
  private calculateStatistics(
    trades: StrategyTrade[],
    initialBalance: number,
    finalBalance: number,
    maxDrawdown: number,
    equityCurve: Array<{ timestamp: number; balance: number }>
  ): BacktestResult {
    // Calculate P&L for each trade pair
    const pnls: number[] = [];
    for (let i = 1; i < trades.length; i += 2) {
      if (
        i < trades.length &&
        trades[i - 1].type === "BUY" &&
        trades[i].type === "SELL"
      ) {
        const buyTrade = trades[i - 1];
        const sellTrade = trades[i];
        const pnl = (sellTrade.price - buyTrade.price) * buyTrade.quantity;
        pnls.push(pnl);
      }
    }

    const wins = pnls.filter((pnl) => pnl > 0);
    const losses = pnls.filter((pnl) => pnl < 0);

    const totalReturn = finalBalance - initialBalance;
    const totalReturnPercent = (totalReturn / initialBalance) * 100;

    const winningTrades = wins.length;
    const losingTrades = losses.length;
    const totalTrades = Math.floor(trades.length / 2);
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const averageWin =
      wins.length > 0 ? wins.reduce((s, w) => s + w, 0) / wins.length : 0;
    const averageLoss =
      losses.length > 0 ? losses.reduce((s, l) => s + l, 0) / losses.length : 0;

    const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;

    const totalProfit = wins.reduce((s, w) => s + w, 0);
    const totalLoss = Math.abs(losses.reduce((s, l) => s + l, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : 0;

    const sharpeRatio = this.calculateSharpeRatio(equityCurve);
    const maxDrawdownPercent = (maxDrawdown / initialBalance) * 100;

    return {
      strategy: this.config.strategy.getName(),
      initialBalance,
      finalBalance,
      totalReturn,
      totalReturnPercent,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      profitFactor,
      averageWin,
      averageLoss,
      largestWin,
      largestLoss,
      trades,
      equityCurve,
    };
  }

  /**
   * Calculate Sharpe Ratio
   * Measures risk-adjusted return
   */
  private calculateSharpeRatio(
    equityCurve: Array<{ timestamp: number; balance: number }>
  ): number {
    if (equityCurve.length < 2) return 0;

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const returnPct =
        (equityCurve[i].balance - equityCurve[i - 1].balance) /
        equityCurve[i - 1].balance;
      returns.push(returnPct);
    }

    // Calculate mean and standard deviation
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance =
      returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Sharpe Ratio (assuming risk-free rate = 0)
    return stdDev > 0 ? mean / stdDev : 0;
  }
}
