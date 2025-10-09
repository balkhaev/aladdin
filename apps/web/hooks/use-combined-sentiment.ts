import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

const REFETCH_INTERVAL = 120_000; // 2 minutes
const STALE_TIME = 60_000; // 1 minute

export type SentimentSignal = "BULLISH" | "BEARISH" | "NEUTRAL";

export type ComponentSentiment = {
  score: number;
  signal: SentimentSignal;
  confidence: number;
  weight: number;
};

type AnalyticsSentimentContext = {
  compositeScore: number;
  confidence: number;
};

type FuturesSentimentContext = {
  fundingRate: number;
  fundingAvg24h: number;
  oiChangePct: number;
  priceChangePct: number;
  signal: SentimentSignal;
};

type OrderBookSentimentContext = {
  bidAskImbalance: number;
  spread: number;
  liquidityScore: number;
};

type SocialSentimentContext = {
  overall: number;
  telegram: {
    score: number;
    bullish: number;
    bearish: number;
    signals: number;
  };
  twitter: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    tweets: number;
  };
  reddit?: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    posts: number;
  };
  news?: {
    score: number;
    positive: number;
    negative: number;
    neutral: number;
    articles: number;
  };
  confidence: number;
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
  context: {
    analytics: AnalyticsSentimentContext | null;
    futures: FuturesSentimentContext | null;
    orderBook: OrderBookSentimentContext | null;
    social: SocialSentimentContext | null;
  };
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

/**
 * Helper to get sentiment color based on signal
 */
export function getSentimentColor(signal: SentimentSignal): string {
  if (signal === "BULLISH") return "text-green-500";
  if (signal === "BEARISH") return "text-red-500";
  return "text-gray-500";
}

/**
 * Helper to get sentiment background color
 */
export function getSentimentBgColor(signal: SentimentSignal): string {
  if (signal === "BULLISH") return "bg-green-500/10 border-green-500/20";
  if (signal === "BEARISH") return "bg-red-500/10 border-red-500/20";
  return "bg-gray-500/10 border-gray-500/20";
}

/**
 * Helper to get sentiment icon (emoji) based on signal
 */
export function getSentimentIcon(signal: SentimentSignal): string {
  if (signal === "BULLISH") return "📈";
  if (signal === "BEARISH") return "📉";
  return "➡️";
}
