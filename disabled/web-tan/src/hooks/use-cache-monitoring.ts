/**
 * React Query hooks for Cache Monitoring
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { flushCache, getCacheStats } from "../lib/api/analytics";

/**
 * Hook to get cache statistics
 */
export function useCacheStats(enabled = true) {
  return useQuery({
    queryKey: ["cache-stats"],
    queryFn: getCacheStats,
    enabled,
    refetchInterval: 5000, // Refetch every 5 seconds
    retry: 1,
  });
}

/**
 * Hook to flush cache
 */
export function useFlushCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: flushCache,
    onSuccess: () => {
      toast.success("Cache flushed successfully");
      queryClient.invalidateQueries({ queryKey: ["cache-stats"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to flush cache", {
        description: error.message,
      });
    },
  });
}
