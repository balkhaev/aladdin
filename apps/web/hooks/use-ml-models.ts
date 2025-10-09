/**
 * React Query hooks for ML Model Management
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  cleanupModels,
  deleteModel,
  getModelStats,
  listModels,
} from "../lib/api/ml";

/**
 * List all saved models
 */
export function useListModels() {
  return useQuery({
    queryKey: ["ml-models"],
    queryFn: listModels,
    refetchInterval: 60_000, // Refetch every minute
  });
}

/**
 * Get model statistics
 */
export function useModelStats(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ["ml-model-stats", symbol],
    queryFn: () => getModelStats(symbol),
    enabled,
  });
}

/**
 * Delete a model
 */
export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteModel,
    onSuccess: (_, symbol) => {
      toast.success("Model deleted", {
        description: `Model for ${symbol} has been deleted`,
      });
      queryClient.invalidateQueries({ queryKey: ["ml-models"] });
    },
    onError: (error) => {
      toast.error("Failed to delete model", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}

/**
 * Cleanup old models
 */
export function useCleanupModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: { olderThanDays?: number; keepBest?: boolean }) =>
      cleanupModels(params?.olderThanDays, params?.keepBest),
    onSuccess: (data) => {
      toast.success("Cleanup completed", {
        description: `Deleted ${data.deletedModels.length} old models, freed ${(data.freedSpaceBytes / (1024 * 1024)).toFixed(2)} MB`,
      });
      queryClient.invalidateQueries({ queryKey: ["ml-models"] });
    },
    onError: (error) => {
      toast.error("Cleanup failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });
}
