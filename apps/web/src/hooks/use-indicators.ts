import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { REFETCH_INTERVALS, STALE_TIME } from "@/lib/query-config";
import { indicatorKeys } from "@/lib/query-keys";

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
    queryKey: indicatorKeys.detail(
      symbol,
      timeframe,
      indicators.join(","),
      limit
    ),
    queryFn: () =>
      apiGet<TechnicalIndicators>(`/api/analytics/indicators/${symbol}`, {
        indicators: indicators.join(","),
        timeframe,
        limit,
      }),
    refetchInterval: REFETCH_INTERVALS.NORMAL,
    staleTime: STALE_TIME.NORMAL,
    enabled: indicators.length > 0,
  });
}
