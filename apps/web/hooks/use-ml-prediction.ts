/**
 * React Query hook for ML Price Predictions
 */

import { useQuery } from "@tanstack/react-query";
import type { PredictionHorizon, PredictionResult } from "../lib/api/ml";
import { predictPrice } from "../lib/api/ml";

const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to get ML prediction for a symbol
 */
export function usePrediction(
  symbol: string,
  horizon: PredictionHorizon = "1h",
  enabled = true
) {
  return useQuery<PredictionResult>({
    queryKey: ["ml-prediction", symbol, horizon],
    queryFn: () => predictPrice({ symbol, horizon, confidence: 0.95 }),
    enabled,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL,
    retry: 1, // Only retry once for predictions
    retryDelay: 1000,
  });
}
