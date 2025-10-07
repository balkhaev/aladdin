/**
 * Bybit Opportunities API Client
 */

import type { TradingOpportunity } from "@/types/bybit";
import { apiGet, apiPost } from "./client";

export const bybitOpportunitiesApi = {
  /**
   * Get opportunities with filters
   */
  getOpportunities: (params: {
    limit?: number;
    minScore?: number;
    signal?: "BUY" | "SELL";
    minConfidence?: number;
  }) =>
    apiGet<{
      opportunities: TradingOpportunity[];
      count: number;
    }>("/api/analytics/bybit-opportunities/list", params),

  /**
   * Get opportunities for specific symbol
   */
  getSymbolOpportunities: (symbol: string, limit?: number) =>
    apiGet<{
      symbol: string;
      opportunities: TradingOpportunity[];
      count: number;
    }>(`/api/analytics/bybit-opportunities/${symbol}`, { limit }),

  /**
   * Get statistics
   */
  getStats: () =>
    apiGet<{
      total: number;
      bySignal: Record<string, number>;
      byStrength: Record<string, number>;
    }>("/api/analytics/bybit-opportunities/stats"),

  /**
   * Get monitored symbols
   */
  getSymbols: () =>
    apiGet<{
      symbols: string[];
      count: number;
    }>("/api/analytics/bybit-opportunities/symbols"),

  /**
   * Manually trigger analysis
   */
  triggerAnalysis: (symbol: string) =>
    apiPost<{
      message: string;
      symbol: string;
    }>(`/api/analytics/bybit-opportunities/analyze/${symbol}`, {}),
};
