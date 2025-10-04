/**
 * Social Sentiment Analysis React Hooks
 * Hooks for sentiment data from Telegram and Twitter
 */

import { useQuery } from "@tanstack/react-query";

// After refactoring: sentiment is now part of analytics service, use API Gateway
const SENTIMENT_API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type SocialSentimentAnalysis = {
  symbol: string;
  overall: number; // -1 to 1
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
  confidence: number; // 0 to 1
  timestamp: string;
};

export type SentimentShift = {
  symbol: string;
  shift: "BULLISH" | "BEARISH" | "NEUTRAL";
  magnitude: number;
  confidence: number;
  previousScore: number;
  currentScore: number;
  timestamp: string;
};

export type ServicesHealth = {
  telegram: boolean;
  twitter: boolean;
  allHealthy: boolean;
};

/**
 * Hook to fetch social sentiment for a symbol
 */
export function useSocialSentiment(symbol: string | undefined, enabled = true) {
  return useQuery<SocialSentimentAnalysis>({
    queryKey: ["social-sentiment", symbol],
    queryFn: async () => {
      if (!symbol) throw new Error("Symbol is required");

      const response = await fetch(
        `${SENTIMENT_API_URL}/api/sentiment/${symbol}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch social sentiment");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 60_000, // Update every minute
    staleTime: 30_000, // Consider data stale after 30 seconds
    enabled: enabled && !!symbol,
  });
}

/**
 * Hook to fetch sentiment history for a symbol
 */
export function useSentimentHistory(
  symbol: string | undefined,
  enabled = true
) {
  return useQuery<number[]>({
    queryKey: ["sentiment-history", symbol],
    queryFn: async () => {
      if (!symbol) throw new Error("Symbol is required");

      const response = await fetch(
        `${SENTIMENT_API_URL}/api/sentiment/${symbol}/history`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch sentiment history");
      }

      const result = await response.json();
      return result.data.history;
    },
    refetchInterval: 120_000, // Update every 2 minutes
    enabled: enabled && !!symbol,
  });
}

/**
 * Hook to fetch sentiment for multiple symbols (batch)
 */
export function useBatchSocialSentiment(
  symbols: string[] | undefined,
  enabled = true
) {
  return useQuery<SocialSentimentAnalysis[]>({
    queryKey: ["social-sentiment-batch", symbols?.join(",")],
    queryFn: async () => {
      if (!symbols || symbols.length === 0) {
        throw new Error("Symbols are required");
      }

      const response = await fetch(
        `${SENTIMENT_API_URL}/api/sentiment/analyze-batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch batch sentiment");
      }

      const result = await response.json();
      return result.data.analyses;
    },
    refetchInterval: 60_000,
    enabled: enabled && !!symbols && symbols.length > 0,
  });
}

/**
 * Hook to check health of sentiment services
 */
export function useSentimentServicesHealth() {
  return useQuery<ServicesHealth>({
    queryKey: ["sentiment-services-health"],
    queryFn: async () => {
      const response = await fetch(
        `${SENTIMENT_API_URL}/api/sentiment/services/health`
      );

      if (!response.ok) {
        throw new Error("Failed to check services health");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 30_000, // Check every 30 seconds
  });
}

/**
 * Helper to get sentiment signal from score
 */
export function getSentimentSignal(
  score: number
): "BULLISH" | "BEARISH" | "NEUTRAL" {
  if (score > 0.3) return "BULLISH";
  if (score < -0.3) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Helper to get sentiment color based on score
 */
export function getSentimentColorFromScore(score: number): string {
  if (score > 0.3) return "text-green-500";
  if (score < -0.3) return "text-red-500";
  return "text-gray-500";
}

/**
 * Helper to get sentiment background color
 */
export function getSentimentBgColorFromScore(score: number): string {
  if (score > 0.3) return "bg-green-500/10 border-green-500/20";
  if (score < -0.3) return "bg-red-500/10 border-red-500/20";
  return "bg-gray-500/10 border-gray-500/20";
}

/**
 * Format confidence percentage
 */
export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`;
}

/**
 * Format sentiment score (-1 to 1) to percentage
 */
export function formatScore(score: number): string {
  return score.toFixed(2);
}

/**
 * Get strength indicator based on score magnitude
 */
export function getStrengthFromScore(
  score: number
): "WEAK" | "MODERATE" | "STRONG" {
  const abs = Math.abs(score);
  if (abs > 0.7) return "STRONG";
  if (abs > 0.4) return "MODERATE";
  return "WEAK";
}
