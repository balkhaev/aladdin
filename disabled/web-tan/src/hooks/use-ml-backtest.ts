/**
 * React Query hooks for ML Backtesting
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  BacktestResult,
  ComparisonResult,
  ModelType,
  PredictionHorizon,
} from "../lib/api/ml";
import { compareModels, runBacktest } from "../lib/api/ml";

/**
 * Hook to run backtest
 */
export function useRunBacktest() {
  return useMutation({
    mutationFn: (config: {
      symbol: string;
      modelType: ModelType;
      horizon: PredictionHorizon;
      startDate: number;
      endDate: number;
      walkForward?: boolean;
      retrainInterval?: number;
      includeSentiment?: boolean;
    }) => runBacktest(config),
  });
}

/**
 * Hook to compare models
 */
export function useCompareModels() {
  return useMutation({
    mutationFn: (config: {
      symbol: string;
      horizon: PredictionHorizon;
      startDate: number;
      endDate: number;
      walkForward?: boolean;
      retrainInterval?: number;
      includeSentiment?: boolean;
    }) => compareModels(config),
  });
}

/**
 * Hook to get cached backtest result
 */
export function useBacktestResult(
  symbol: string,
  modelType: ModelType,
  horizon: PredictionHorizon,
  enabled = false
) {
  return useQuery<BacktestResult>({
    queryKey: ["ml", "backtest", symbol, modelType, horizon],
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to get cached comparison result
 */
export function useComparisonResult(
  symbol: string,
  horizon: PredictionHorizon,
  enabled = false
) {
  return useQuery<ComparisonResult>({
    queryKey: ["ml", "comparison", symbol, horizon],
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
