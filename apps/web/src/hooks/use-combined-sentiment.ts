import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

const REFETCH_INTERVAL = 120_000; // 2 minutes
const STALE_TIME = 60_000; // 1 minute

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
    social: ComponentSentiment;
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
    queryFn: () => {
      if (!symbol) throw new Error("Symbol is required");

      return apiClient.get<CombinedSentiment>(
        `/api/analytics/sentiment/${symbol}/combined`
      );
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: STALE_TIME,
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
  const symbolsKey = symbols?.join(",") || "";

  return useQuery<CombinedSentiment[]>({
    queryKey: ["combined-sentiment-batch", symbolsKey],
    queryFn: async () => {
      if (!symbols || symbols.length === 0) {
        throw new Error("Symbols array is required");
      }

      const data = await apiClient.get<CombinedSentiment[]>(
        `/api/analytics/sentiment/batch/combined?symbols=${symbols.join(",")}`
      );

      // Ensure we return an array
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: STALE_TIME,
    enabled: enabled && !!symbols && symbols.length > 0,
  });
}
