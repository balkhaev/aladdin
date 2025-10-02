/**
 * Sentiment Analysis React Hooks
 * Custom hooks for sentiment data using TanStack Query
 */

import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type SentimentSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

export type ComponentSentiment = {
  score: number; // -100 to +100
  signal: SentimentSignal;
  weight: number; // 0-1
  confidence: number; // 0-100
};

export type CompositeSentiment = {
  symbol: string;
  timestamp: string;
  compositeScore: number; // -100 to +100
  compositeSignal: SentimentSignal;
  confidence: number; // 0-100
  components: {
    fearGreed: ComponentSentiment;
    onChain: ComponentSentiment;
    technical: ComponentSentiment;
  };
  insights: string[];
  strength: "WEAK" | "MODERATE" | "STRONG";
};

/**
 * Hook to fetch sentiment for a single symbol
 */
export function useSentiment(symbol: string | undefined, enabled = true) {
  return useQuery<CompositeSentiment>({
    queryKey: ["sentiment", symbol],
    queryFn: async () => {
      if (!symbol) throw new Error("Symbol is required");

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/sentiment/${symbol}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sentiment");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 120_000, // Update every 2 minutes (matches backend cache)
    staleTime: 60_000, // Consider data stale after 1 minute
    enabled: enabled && !!symbol,
  });
}

/**
 * Hook to fetch sentiment for multiple symbols
 */
export function useBatchSentiment(
  symbols: string[] | undefined,
  enabled = true
) {
  return useQuery<CompositeSentiment[]>({
    queryKey: ["sentiment", "batch", symbols?.join(",")],
    queryFn: async () => {
      if (!symbols || symbols.length === 0) {
        throw new Error("Symbols are required");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/sentiment/batch?symbols=${symbols.join(",")}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch batch sentiment");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 120_000, // Update every 2 minutes
    staleTime: 60_000,
    enabled: enabled && !!symbols && symbols.length > 0,
  });
}

/**
 * Helper to get sentiment color based on signal
 */
export function getSentimentColor(signal: SentimentSignal): string {
  switch (signal) {
    case "BULLISH":
      return "text-green-500";
    case "BEARISH":
      return "text-red-500";
    case "NEUTRAL":
      return "text-gray-500";
    default:
      return "text-gray-500";
  }
}

/**
 * Helper to get sentiment background color
 */
export function getSentimentBgColor(signal: SentimentSignal): string {
  switch (signal) {
    case "BULLISH":
      return "bg-green-500/10 border-green-500/20";
    case "BEARISH":
      return "bg-red-500/10 border-red-500/20";
    case "NEUTRAL":
      return "bg-gray-500/10 border-gray-500/20";
    default:
      return "bg-gray-500/10 border-gray-500/20";
  }
}

/**
 * Helper to get sentiment icon
 */
export function getSentimentIcon(signal: SentimentSignal): string {
  switch (signal) {
    case "BULLISH":
      return "📈";
    case "BEARISH":
      return "📉";
    case "NEUTRAL":
      return "➡️";
    default:
      return "➡️";
  }
}
