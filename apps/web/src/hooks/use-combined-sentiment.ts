import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const REFETCH_INTERVAL = 120_000; // 2 minutes

type SentimentSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

type ComponentSentiment = {
  score: number;
  signal: SentimentSignal;
  confidence: number;
  weight: number;
};

export type CombinedSentiment = {
  symbol: string;
  timestamp: Date;
  combinedScore: number;
  combinedSignal: SentimentSignal;
  confidence: number;
  strength: "WEAK" | "MODERATE" | "STRONG";
  components: {
    analytics: ComponentSentiment;
    futures: ComponentSentiment;
    orderBook: ComponentSentiment;
  };
  recommendation: {
    action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
    reasoning: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
  };
  insights: string[];
};

/**
 * Hook to fetch combined sentiment for a single symbol
 */
export function useCombinedSentiment(
  symbol: string | undefined,
  enabled = true
) {
  return useQuery<CombinedSentiment>({
    queryKey: ["combined-sentiment", symbol],
    queryFn: async () => {
      if (!symbol) throw new Error("Symbol is required");

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/sentiment/${symbol}/combined`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch combined sentiment");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 60_000, // Consider data stale after 1 minute
    enabled: enabled && !!symbol,
  });
}

/**
 * Hook to fetch combined sentiment for multiple symbols
 */
export function useBatchCombinedSentiment(
  symbols: string[] | undefined,
  enabled = true
) {
  return useQuery<CombinedSentiment[]>({
    queryKey: ["combined-sentiment-batch", symbols],
    queryFn: async () => {
      if (!symbols || symbols.length === 0) {
        throw new Error("Symbols array is required");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/sentiment/batch/combined?symbols=${symbols.join(",")}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch batch combined sentiment");
      }

      const result = await response.json();
      // Ensure we return an array
      const data = result.data;
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 60_000,
    enabled: enabled && !!symbols && symbols.length > 0,
  });
}
