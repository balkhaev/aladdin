/**
 * Anomaly Detection API Client
 */

import { apiClient } from "./client";

export type AnomalyType =
  | "PUMP_AND_DUMP"
  | "FLASH_CRASH"
  | "UNUSUAL_VOLUME"
  | "PRICE_MANIPULATION"
  | "WHALE_MOVEMENT";

export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AnomalyDetection = {
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  timestamp: number;
  symbol: string;
  description: string;
  metrics: Record<string, number>;
  recommendations: string[];
};

export type AnomalyDetectionRequest = {
  symbol: string;
  lookbackMinutes?: number;
};

export type AnomalyDetectionResponse = {
  symbol: string;
  anomalies: AnomalyDetection[];
  detectedAt: number;
};

/**
 * Detect anomalies for a symbol
 */
export async function detectAnomalies(
  request: AnomalyDetectionRequest
): Promise<AnomalyDetectionResponse> {
  const response = await apiClient.post("/api/ml/anomalies/detect", {
    json: request,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Failed to detect anomalies");
  }

  const result = await response.json();
  return result.data;
}
