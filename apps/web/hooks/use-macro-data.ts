/**
 * React Hooks для работы с макро данными
 */

import { useQuery } from "@tanstack/react-query";
import {
  getCategoryStats,
  getFearGreed,
  getGlobalMetrics,
  getTopCoins,
  getTrendingCoins,
} from "@/lib/api/macro";

const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_IN_MINUTE * MS_IN_SECOND;
const TEN_MINUTES = 10;
const THIRTY_MINUTES = 30;
const SIXTY_MINUTES = 60;

const REFETCH_INTERVALS = {
  GLOBAL: TEN_MINUTES * MINUTES_TO_MS,
  FEAR_GREED: SIXTY_MINUTES * MINUTES_TO_MS,
  TRENDING: THIRTY_MINUTES * MINUTES_TO_MS,
  CATEGORIES: TEN_MINUTES * MINUTES_TO_MS,
};

/**
 * Hook для глобальных метрик
 */
export function useGlobalMetrics() {
  return useQuery({
    queryKey: ["macro", "global"],
    queryFn: getGlobalMetrics,
    refetchInterval: REFETCH_INTERVALS.GLOBAL,
    staleTime: REFETCH_INTERVALS.GLOBAL,
  });
}

/**
 * Hook для Fear & Greed Index
 */
export function useFearGreed(limit = 1) {
  return useQuery({
    queryKey: ["macro", "feargreed", limit],
    queryFn: () => getFearGreed(limit),
    refetchInterval: REFETCH_INTERVALS.FEAR_GREED,
    staleTime: REFETCH_INTERVALS.FEAR_GREED,
  });
}

/**
 * Hook для трендовых монет
 */
export function useTrendingCoins() {
  return useQuery({
    queryKey: ["macro", "trending"],
    queryFn: getTrendingCoins,
    refetchInterval: REFETCH_INTERVALS.TRENDING,
    staleTime: REFETCH_INTERVALS.TRENDING,
  });
}

/**
 * Hook для топ монет
 */
export function useTopCoins(params?: { category?: string; limit?: number }) {
  return useQuery({
    queryKey: ["macro", "top-coins", params],
    queryFn: () => getTopCoins(params),
    refetchInterval: REFETCH_INTERVALS.CATEGORIES,
    staleTime: REFETCH_INTERVALS.CATEGORIES,
  });
}

/**
 * Hook для статистики по категориям
 */
export function useCategoryStats() {
  return useQuery({
    queryKey: ["macro", "categories"],
    queryFn: getCategoryStats,
    refetchInterval: REFETCH_INTERVALS.CATEGORIES,
    staleTime: REFETCH_INTERVALS.CATEGORIES,
  });
}

/**
 * Hook для истории Fear & Greed
 */
export function useFearGreedHistory(days = 30) {
  return useQuery({
    queryKey: ["macro", "feargreed-history", days],
    queryFn: () =>
      import("@/lib/api/macro").then((m) => m.getFearGreedHistory(days)),
    refetchInterval: REFETCH_INTERVALS.FEAR_GREED,
    staleTime: REFETCH_INTERVALS.FEAR_GREED,
  });
}

/**
 * Hook для correlation matrix
 */
export function useCategoryCorrelation(days = 7) {
  return useQuery({
    queryKey: ["macro", "correlation", days],
    queryFn: () =>
      import("@/lib/api/macro").then((m) => m.getCategoryCorrelation(days)),
    refetchInterval: REFETCH_INTERVALS.CATEGORIES,
    staleTime: REFETCH_INTERVALS.CATEGORIES,
  });
}
