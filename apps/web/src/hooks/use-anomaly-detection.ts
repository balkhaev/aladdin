/**
 * React Query hooks for Anomaly Detection
 */

import { useQuery } from "@tanstack/react-query";
import type { AnomalyDetectionRequest } from "../lib/api/anomaly";
import { detectAnomalies } from "../lib/api/anomaly";

/**
 * Detect anomalies for a symbol
 */
export function useDetectAnomalies(
  request: AnomalyDetectionRequest,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: ["anomalies", request.symbol, request.lookbackMinutes],
    queryFn: () => detectAnomalies(request),
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
