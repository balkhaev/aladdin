/**
 * API client for backtesting
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type BacktestStrategy =
  | "SMA_CROSS"
  | "RSI_OVERSOLD"
  | "MACD_CROSS"
  | "BB_BOUNCE";

export type BacktestParams = {
  symbol: string;
  strategy: BacktestStrategy;
  from: string; // ISO date string
  to: string; // ISO date string
  initialBalance?: number;
  parameters?: Record<string, string | number>;
};

export type BacktestTrade = {
  timestamp: Date;
  type: "BUY" | "SELL";
  price: number;
  quantity: number;
  pnl?: number;
};

export type BacktestResult = {
  strategy: string;
  symbol: string;
  from: string;
  to: string;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  trades: BacktestTrade[];
};

export type BacktestResponse = {
  success: boolean;
  data: BacktestResult;
  timestamp: number;
};

/**
 * Run a backtest
 */
export async function runBacktest(
  params: BacktestParams
): Promise<BacktestResult> {
  const response = await fetch(`${API_BASE_URL}/api/analytics/backtest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to run backtest");
  }

  const result: BacktestResponse = await response.json();

  // Parse trade timestamps
  result.data.trades = result.data.trades.map((trade) => ({
    ...trade,
    timestamp: new Date(trade.timestamp),
  }));

  return result.data;
}

/**
 * Get strategy description
 */
export function getStrategyDescription(strategy: BacktestStrategy): string {
  switch (strategy) {
    case "SMA_CROSS":
      return "SMA Crossover: Buy when fast SMA crosses above slow SMA, sell when it crosses below";
    case "RSI_OVERSOLD":
      return "RSI Oversold: Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)";
    case "MACD_CROSS":
      return "MACD Crossover: Buy when MACD crosses above signal line, sell when it crosses below";
    case "BB_BOUNCE":
      return "Bollinger Bands Bounce: Buy at lower band, sell at upper band";
    default:
      return "Unknown strategy";
  }
}

/**
 * Get strategy parameters
 */
export function getStrategyParameters(strategy: BacktestStrategy): Array<{
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}> {
  switch (strategy) {
    case "SMA_CROSS":
      return [
        {
          name: "fastPeriod",
          label: "Fast SMA Period",
          defaultValue: 20,
          min: 5,
          max: 100,
        },
        {
          name: "slowPeriod",
          label: "Slow SMA Period",
          defaultValue: 50,
          min: 10,
          max: 200,
        },
      ];
    case "RSI_OVERSOLD":
      return [
        {
          name: "period",
          label: "RSI Period",
          defaultValue: 14,
          min: 5,
          max: 50,
        },
        {
          name: "oversold",
          label: "Oversold Level",
          defaultValue: 30,
          min: 10,
          max: 40,
        },
        {
          name: "overbought",
          label: "Overbought Level",
          defaultValue: 70,
          min: 60,
          max: 90,
        },
      ];
    case "MACD_CROSS":
      return [
        {
          name: "fastPeriod",
          label: "Fast EMA",
          defaultValue: 12,
          min: 5,
          max: 50,
        },
        {
          name: "slowPeriod",
          label: "Slow EMA",
          defaultValue: 26,
          min: 10,
          max: 100,
        },
        {
          name: "signalPeriod",
          label: "Signal Period",
          defaultValue: 9,
          min: 5,
          max: 30,
        },
      ];
    case "BB_BOUNCE":
      return [
        {
          name: "period",
          label: "BB Period",
          defaultValue: 20,
          min: 10,
          max: 50,
        },
        {
          name: "stdDev",
          label: "Std Deviation",
          defaultValue: 2,
          min: 1,
          max: 3,
        },
      ];
    default:
      return [];
  }
}
