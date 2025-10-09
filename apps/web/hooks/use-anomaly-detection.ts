import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  AnomalyDetectionRequest,
  AnomalyDetectionResult,
} from "@/lib/api/ml";
import { detectAnomalies } from "@/lib/api/ml";

type UseDetectAnomaliesOptions = {
  enabled?: boolean;
  refetchInterval?: number;
};

export function useDetectAnomalies(
  params: AnomalyDetectionRequest,
  options?: UseDetectAnomaliesOptions
) {
  return useQuery<AnomalyDetectionResult, Error>({
    queryKey: ["ml", "anomalies", params.symbol, params.lookbackMinutes],
    queryFn: () => detectAnomalies(params),
    refetchInterval: options?.refetchInterval ?? 60_000, // Refresh every minute
    enabled: options?.enabled ?? Boolean(params.symbol),
  });
}

export function useDetectAnomaliesMutation() {
  return useMutation<AnomalyDetectionResult, Error, AnomalyDetectionRequest>({
    mutationFn: detectAnomalies,
  });
}
