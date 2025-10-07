/**
 * React Query hook for saving ML models
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ModelType } from "../lib/api/ml";
import { saveModel } from "../lib/api/ml";

/**
 * Hook to save model after backtest
 */
export function useSaveModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      symbol: string;
      modelType: ModelType;
      config: Record<string, number>;
      metrics: {
        mae: number;
        rmse: number;
        mape: number;
        r2Score: number;
        directionalAccuracy: number;
      };
    }) => saveModel(params),
    onSuccess: (data) => {
      toast.success("Model Saved", {
        description: `Model for ${data.symbol} saved successfully and ready for production`,
      });
      queryClient.invalidateQueries({ queryKey: ["ml-models"] });
    },
    onError: (error) => {
      toast.error("Failed to save model", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}
