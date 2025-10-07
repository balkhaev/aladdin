/**
 * Screener API client
 */

import { API_BASE_URL } from "../runtime-env";

/**
 * Types for Screener API
 */
export type TechnicalIndicators = {
  rsi?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema20?: number;
  ema50?: number;
  ema200?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic?: {
    k: number;
    d: number;
  };
  atr?: number;
  adx?: number;
};

export type Signals = {
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: number; // 0-100
  momentum: "STRONG" | "MODERATE" | "WEAK";
  volatility: "HIGH" | "MEDIUM" | "LOW";
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
};

export type ScreenerResult = {
  symbol: string;
  timestamp: number;
  timeframe: string;
  indicators: TechnicalIndicators;
  signals: Signals;
  price: {
    current: number;
    change24h: number;
    changePercent24h: number;
    volume24h: number;
  };
};

export type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};

/**
 * Get screener results
 */
export async function getScreenerResults(
  limit = 100
): Promise<ScreenerResult[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/screener/results?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch screener results");
  }

  const result = await response.json();
  return result.data.results;
}

/**
 * Get top signals by recommendation
 */
export async function getTopSignals(
  recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL",
  limit = 20
): Promise<ScreenerResult[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/screener/signals/${recommendation}?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch top signals");
  }

  const result = await response.json();
  return result.data.results;
}

/**
 * Run screening manually
 */
export async function runScreening(timeframe = "15m"): Promise<{
  runId: string;
  jobCount: number;
}> {
  const response = await fetch(`${API_BASE_URL}/api/screener/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ timeframe }),
  });

  if (!response.ok) {
    throw new Error("Failed to run screening");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const response = await fetch(`${API_BASE_URL}/api/screener/stats`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch queue stats");
  }

  const result = await response.json();
  return result.data;
}
