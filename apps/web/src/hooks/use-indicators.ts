import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export type TechnicalIndicators = {
  symbol: string;
  timestamp: Date;
  RSI?: {
    value: number;
    signal: "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL";
  };
  MACD?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  EMA?: {
    ema12: number;
    ema26: number;
  };
  SMA?: {
    sma20: number;
    sma50: number;
    sma200: number;
  };
  BB?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  };
};

type IndicatorName = "RSI" | "MACD" | "EMA" | "SMA" | "BB";

/**
 * Hook for fetching technical indicators
 */
export function useIndicators(
  symbol: string,
  timeframe: string,
  indicators: IndicatorName[],
  limit = 100
) {
  return useQuery<TechnicalIndicators>({
    queryKey: ["indicators", symbol, timeframe, indicators.join(","), limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        indicators: indicators.join(","),
        timeframe,
        limit: limit.toString(),
      });

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/indicators/${symbol}?${params}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch indicators");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: 60_000, // Update every minute
    staleTime: 30_000,
    enabled: indicators.length > 0,
  });
}
