/**
 * React hooks для работы с Analytics API
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  BacktestResult,
  Indicators,
  IndicatorType,
  MarketOverview,
  PortfolioReport,
  StrategyType,
  TradingStatistics,
} from "../lib/api/analytics";
import {
  generateReport,
  getIndicators,
  getMarketOverview,
  getTradingStatistics,
  runBacktest,
} from "../lib/api/analytics";

// ==================== Query Keys ====================

export const analyticsKeys = {
  all: ["analytics"] as const,
  indicators: (symbol: string, timeframe?: string) =>
    [...analyticsKeys.all, "indicators", symbol, timeframe] as const,
  statistics: (portfolioId: string, from?: string, to?: string) =>
    [...analyticsKeys.all, "statistics", portfolioId, from, to] as const,
  marketOverview: () => [...analyticsKeys.all, "market-overview"] as const,
};

// ==================== Hooks ====================

/**
 * Получить технические индикаторы для символа
 */
export function useIndicators(params: {
  symbol: string;
  timeframe?: string;
  indicators?: IndicatorType[];
  period?: number;
  enabled?: boolean;
}) {
  return useQuery<Indicators>({
    queryKey: analyticsKeys.indicators(params.symbol, params.timeframe),
    queryFn: () => getIndicators(params),
    enabled: params.enabled !== false && !!params.symbol,
    refetchInterval: 60_000, // Обновлять каждую минуту
  });
}

/**
 * Получить статистику торговли
 */
export function useTradingStatistics(
  params: {
    portfolioId: string;
    from?: string;
    to?: string;
  },
  enabled = true
) {
  return useQuery<TradingStatistics>({
    queryKey: analyticsKeys.statistics(
      params.portfolioId,
      params.from,
      params.to
    ),
    queryFn: () => getTradingStatistics(params),
    enabled: enabled && !!params.portfolioId,
  });
}

/**
 * Запустить бэктест стратегии
 */
export function useRunBacktest() {
  return useMutation<
    BacktestResult,
    Error,
    {
      strategy: StrategyType;
      symbol: string;
      timeframe: string;
      from: string;
      to: string;
      initialBalance?: number;
      parameters?: Record<string, number>;
    }
  >({
    mutationFn: (params) => runBacktest(params),
  });
}

/**
 * Сгенерировать отчет по портфелю
 */
export function useGenerateReport() {
  return useMutation<
    PortfolioReport | Blob,
    Error,
    {
      portfolioId: string;
      from: string;
      to: string;
      format?: "json" | "csv";
    }
  >({
    mutationFn: (params) => generateReport(params),
  });
}

/**
 * Получить обзор рынка
 */
export function useMarketOverview() {
  return useQuery<MarketOverview>({
    queryKey: analyticsKeys.marketOverview(),
    queryFn: () => getMarketOverview(),
    refetchInterval: 30_000, // Обновлять каждые 30 секунд
  });
}
