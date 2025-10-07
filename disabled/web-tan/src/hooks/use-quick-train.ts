/**
 * React Query hook for Quick ML Training
 * Automatically trains, compares, and saves the best model
 */

import { useMutation } from "@tanstack/react-query";
import type { ComparisonResult, PredictionHorizon } from "../lib/api/ml";
import { compareModels, saveModel } from "../lib/api/ml";

export type TrainingPreset = "fast" | "balanced" | "accurate";

type QuickTrainParams = {
  symbol: string;
  horizon: PredictionHorizon;
  preset: TrainingPreset;
};

type QuickTrainResult = {
  comparison: ComparisonResult;
  savedModel: {
    modelType: "LSTM" | "HYBRID";
    accuracy: number;
  };
};

const PRESET_CONFIG = {
  fast: {
    days: 7,
    walkForward: false,
    retrainInterval: undefined,
    includeSentiment: true,
  },
  balanced: {
    days: 30,
    walkForward: true,
    retrainInterval: 30,
    includeSentiment: true,
  },
  accurate: {
    days: 90,
    walkForward: true,
    retrainInterval: 14,
    includeSentiment: true,
  },
};

/**
 * Hook to quickly train and save the best ML model
 * This will:
 * 1. Compare LSTM vs Hybrid models
 * 2. Automatically select and save the best performing model
 */
export function useQuickTrain() {
  return useMutation({
    mutationFn: async ({
      symbol,
      horizon,
      preset,
    }: QuickTrainParams): Promise<QuickTrainResult> => {
      // Get preset configuration
      const config = PRESET_CONFIG[preset];
      const endDate = Date.now();
      const startDate = endDate - config.days * 24 * 60 * 60 * 1000;

      // Step 1: Compare models (trains both LSTM and Hybrid)
      const comparison = await compareModels({
        symbol,
        horizon,
        startDate,
        endDate,
        walkForward: config.walkForward,
        retrainInterval: config.retrainInterval,
        includeSentiment: config.includeSentiment,
      });

      // Step 2: Determine best model based on directional accuracy
      // Guard against undefined results
      const hasLstmMetrics = Boolean(comparison.results?.lstm?.metrics);
      const hasHybridMetrics = Boolean(comparison.results?.hybrid?.metrics);

      if (!hasLstmMetrics) {
        throw new Error("Invalid comparison results: missing LSTM metrics");
      }

      if (!hasHybridMetrics) {
        throw new Error("Invalid comparison results: missing Hybrid metrics");
      }

      const lstmAccuracy =
        comparison.results.lstm.metrics.directionalAccuracy ?? 0;
      const hybridAccuracy =
        comparison.results.hybrid.metrics.directionalAccuracy ?? 0;

      const bestModelType: "LSTM" | "HYBRID" =
        lstmAccuracy >= hybridAccuracy ? "LSTM" : "HYBRID";
      const bestResult =
        bestModelType === "LSTM"
          ? comparison.results.lstm
          : comparison.results.hybrid;

      // Step 3: Save the best model
      const saveResponse = await saveModel({
        symbol,
        modelType: bestModelType,
        config: bestResult.config,
        metrics: bestResult.metrics,
      });

      return {
        comparison,
        savedModel: {
          modelType: bestModelType,
          accuracy: saveResponse.accuracy,
        },
      };
    },
  });
}
