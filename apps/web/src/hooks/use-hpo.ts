/**
 * React Query hooks for Hyperparameter Optimization
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  HyperparameterSpace,
  ModelType,
  OptimizationMetric,
  OptimizationRecommendations,
  OptimizationResult,
  PredictionHorizon,
} from "../lib/api/ml";
import { getHPORecommendations, runOptimization } from "../lib/api/ml";

/**
 * Hook to run hyperparameter optimization
 */
export function useRunOptimization() {
  return useMutation({
    mutationFn: (config: {
      symbol: string;
      modelType: ModelType;
      horizon: PredictionHorizon;
      hyperparameterSpace: HyperparameterSpace;
      method: "GRID" | "RANDOM";
      nTrials?: number;
      startDate: number;
      endDate: number;
      optimizationMetric: OptimizationMetric;
      crossValidationFolds?: number;
    }) => runOptimization(config),
  });
}

/**
 * Hook to get hyperparameter recommendations
 */
export function useHPORecommendations(
  symbol: string,
  modelType: ModelType,
  enabled = true
) {
  return useQuery<OptimizationRecommendations>({
    queryKey: ["ml", "hpo", "recommendations", symbol, modelType],
    queryFn: () => getHPORecommendations(symbol, modelType),
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Hook to get cached optimization result
 */
export function useOptimizationResult(
  symbol: string,
  modelType: ModelType,
  enabled = false
) {
  return useQuery<OptimizationResult>({
    queryKey: ["ml", "optimization", symbol, modelType],
    enabled,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });
}
