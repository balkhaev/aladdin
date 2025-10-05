/**
 * On-Chain Analytics API Client
 * Provides access to blockchain metrics and analytics
 */

import type { OnChainMetrics } from "@aladdin/shared/types";
import { apiGet } from "./client";

const ON_CHAIN_BASE = "/api/on-chain";

export type OnChainComparison = {
  btc: OnChainMetrics | null;
  eth: OnChainMetrics | null;
};

export type OnChainHistoricalData = {
  blockchain: string;
  from: number;
  to: number;
  metrics: OnChainMetrics[];
};

/**
 * Get latest on-chain metrics for a specific blockchain
 */
export const getLatestMetrics = (blockchain: "BTC" | "ETH") =>
  apiGet<OnChainMetrics>(`${ON_CHAIN_BASE}/metrics/${blockchain}/latest`);

/**
 * Get historical on-chain metrics
 */
export const getHistoricalMetrics = (
  blockchain: "BTC" | "ETH",
  params?: {
    from?: number;
    to?: number;
    limit?: number;
  }
) => {
  const from = params?.from ?? Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days default
  const to = params?.to ?? Date.now();
  const limit = params?.limit ?? 1000;

  return apiGet<OnChainHistoricalData>(
    `${ON_CHAIN_BASE}/metrics/${blockchain}`,
    {
      from: from.toString(),
      to: to.toString(),
      limit: limit.toString(),
    }
  );
};

/**
 * Get comparison of BTC vs ETH metrics
 */
export const getMetricsComparison = () =>
  apiGet<OnChainComparison>(`${ON_CHAIN_BASE}/comparison`);

/**
 * Get whale transactions for a blockchain
 */
export const getWhaleTransactions = (
  blockchain: "BTC" | "ETH",
  params?: {
    from?: number;
    to?: number;
    limit?: number;
  }
) => {
  const from = params?.from ?? Date.now() - 24 * 60 * 60 * 1000; // 24 hours default
  const to = params?.to ?? Date.now();
  const limit = params?.limit ?? 50;

  return apiGet<unknown>(`${ON_CHAIN_BASE}/whale-transactions/${blockchain}`, {
    from: from.toString(),
    to: to.toString(),
    limit: limit.toString(),
  });
};

/**
 * Get exchange reserves/flows
 */
export const getExchangeReserves = (
  blockchain: "BTC" | "ETH",
  params?: {
    from?: number;
    to?: number;
    limit?: number;
  }
) => {
  const from = params?.from ?? Date.now() - 24 * 60 * 60 * 1000;
  const to = params?.to ?? Date.now();
  const limit = params?.limit ?? 20;

  return apiGet<unknown>(`${ON_CHAIN_BASE}/exchange-reserves/${blockchain}`, {
    from: from.toString(),
    to: to.toString(),
    limit: limit.toString(),
  });
};

/**
 * Helper: Format metric value for display
 */
export function formatMetricValue(
  value: number | undefined,
  decimals = 2
): string {
  if (value === undefined || value === null) {
    return "N/A";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`;
  }

  return value.toFixed(decimals);
}

/**
 * Helper: Get metric status color for MVRV
 */
function getMvrvStatus(value: number): "positive" | "negative" | "neutral" {
  if (value > 3.7) return "negative";
  if (value < 1) return "positive";
  return "neutral";
}

/**
 * Helper: Get metric status color for SOPR
 */
function getSoprStatus(value: number): "positive" | "negative" | "neutral" {
  if (value > 1.05) return "negative";
  if (value < 0.95) return "positive";
  return "neutral";
}

/**
 * Helper: Get metric status color for NUPL
 */
function getNuplStatus(value: number): "positive" | "negative" | "neutral" {
  if (value > 0.75) return "negative";
  if (value < 0.25) return "positive";
  return "neutral";
}

/**
 * Helper: Get metric status color for NVT
 */
function getNvtStatus(value: number): "positive" | "negative" | "neutral" {
  if (value > 95) return "negative";
  if (value < 55) return "positive";
  return "neutral";
}

/**
 * Helper: Get metric status color
 */
export function getMetricStatus(
  metricName: string,
  value: number | undefined
): "positive" | "negative" | "neutral" {
  if (value === undefined || value === null) {
    return "neutral";
  }

  switch (metricName) {
    case "mvrvRatio":
      return getMvrvStatus(value);
    case "sopr":
      return getSoprStatus(value);
    case "nupl":
      return getNuplStatus(value);
    case "nvtRatio":
      return getNvtStatus(value);
    case "exchangeReserve":
    case "exchangeNetFlow":
      return value < 0 ? "positive" : "negative";
    case "stockToFlow":
      return value > 50 ? "positive" : "neutral";
    default:
      return "neutral";
  }
}

/**
 * Helper: Get metric description
 */
export function getMetricDescription(metricName: string): string {
  const descriptions: Record<string, string> = {
    mvrvRatio:
      "Market Value to Realized Value ratio. >3.7 indicates overvaluation, <1 indicates undervaluation.",
    sopr: "Spent Output Profit Ratio. >1 means profit-taking, <1 means selling at loss.",
    nupl: "Net Unrealized Profit/Loss. Measures network-wide unrealized profit/loss.",
    exchangeReserve:
      "Total balance on known exchange addresses. Lower reserves typically indicate less selling pressure.",
    puellMultiple:
      "Mining revenue relative to 365-day moving average. Used to identify market cycle tops and bottoms.",
    stockToFlow:
      "Scarcity model showing current supply divided by annual production. Higher values indicate greater scarcity (BTC only).",
    nvtRatio:
      "Network Value to Transactions ratio. Measures if asset is over/undervalued relative to transaction volume.",
    whaleTransactions:
      "Large transactions that may indicate significant market moves.",
    activeAddresses: "Number of unique addresses active in the last 24 hours.",
    transactionVolume: "Total value of transactions in the last 24 hours.",
  };

  return descriptions[metricName] || "On-chain metric";
}
