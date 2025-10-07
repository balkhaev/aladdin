/**
 * API client for backtesting
 */

import { API_BASE_URL } from "../runtime-env";

export type BacktestStrategy =
  | "SMA_CROSSOVER"
  | "RSI"
  | "MACD"
  | "BOLLINGER_BANDS"
  | "CUSTOM";

export type BacktestParams = {
  symbol: string;
  strategy: BacktestStrategy;
  from: string; // ISO date string
  to: string; // ISO date string
  initialBalance?: number;
  parameters?: Record<string, string | number>;
  timeframe?: "1m" | "5m" | "15m" | "1h" | "4h" | "1d"; // Optional: auto-selected if not specified
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
  timeframe?: string; // Timeframe used for the backtest
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
    case "SMA_CROSSOVER":
      return "SMA Crossover: Buy when fast SMA crosses above slow SMA, sell when it crosses below";
    case "RSI":
      return "RSI Oversold: Buy when RSI < 30 (oversold), sell when RSI > 70 (overbought)";
    case "MACD":
      return "MACD Crossover: Buy when MACD crosses above signal line, sell when it crosses below";
    case "BOLLINGER_BANDS":
      return "Bollinger Bands Bounce: Buy at lower band, sell at upper band";
    case "CUSTOM":
      return "Custom strategy with user-defined parameters";
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
    case "SMA_CROSSOVER":
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
    case "RSI":
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
    case "MACD":
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
    case "BOLLINGER_BANDS":
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
    case "CUSTOM":
      return [];
    default:
      return [];
  }
}
