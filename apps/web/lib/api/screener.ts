/**
 * Screener API client
 * Unified API client using apiGet/apiPost
 */

import { apiGet, apiPost } from "./client";

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
  const response = await apiGet<{ results: ScreenerResult[] }>(
    "/api/screener/results",
    { limit }
  );
  return response.results;
}

/**
 * Get top signals by recommendation
 */
export async function getTopSignals(
  recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL",
  limit = 20
): Promise<ScreenerResult[]> {
  const response = await apiGet<{ results: ScreenerResult[] }>(
    `/api/screener/signals/${recommendation}`,
    { limit }
  );
  return response.results;
}

/**
 * Run screening manually
 */
export function runScreening(timeframe = "15m"): Promise<{
  runId: string;
  jobCount: number;
}> {
  return apiPost<{ runId: string; jobCount: number }>("/api/screener/run", {
    timeframe,
  });
}

/**
 * Get queue statistics
 */
export function getQueueStats(): Promise<QueueStats> {
  return apiGet<QueueStats>("/api/screener/stats");
}
