/**
 * Hooks for Strategy Executor
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getExecutorConfig,
  getExecutorStats,
  getPendingSignals,
  manualExecuteSignal,
  setExecutionMode,
  toggleAutoExecute,
  updateExecutorConfig,
  type ExecutionMode,
  type ExecutorConfig,
  type ExecutorStats,
  type ManualExecuteParams,
  type TradingSignal,
} from "@/lib/api/executor";

const REFETCH_INTERVAL = 5_000; // 5 seconds for real-time updates

/**
 * Hook to fetch executor statistics
 */
export function useExecutorStats() {
  return useQuery<ExecutorStats>({
    queryKey: ["executor-stats"],
    queryFn: getExecutorStats,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 3_000,
  });
}

/**
 * Hook to fetch executor configuration
 */
export function useExecutorConfig() {
  return useQuery<ExecutorConfig>({
    queryKey: ["executor-config"],
    queryFn: getExecutorConfig,
    staleTime: 30_000, // Config changes less frequently
  });
}

/**
 * Hook to fetch pending signals
 */
export function usePendingSignals() {
  return useQuery<TradingSignal[]>({
    queryKey: ["pending-signals"],
    queryFn: getPendingSignals,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 3_000,
  });
}

/**
 * Hook to update executor configuration
 */
export function useUpdateExecutorConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Partial<ExecutorConfig>) =>
      updateExecutorConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executor-config"] });
      queryClient.invalidateQueries({ queryKey: ["executor-stats"] });
    },
  });
}

/**
 * Hook to set execution mode
 */
export function useSetExecutionMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mode: ExecutionMode) => setExecutionMode(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executor-config"] });
      queryClient.invalidateQueries({ queryKey: ["executor-stats"] });
    },
  });
}

/**
 * Hook to toggle auto-execution
 */
export function useToggleAutoExecute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (autoExecute: boolean) => toggleAutoExecute(autoExecute),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executor-config"] });
      queryClient.invalidateQueries({ queryKey: ["executor-stats"] });
    },
  });
}

/**
 * Hook to manually execute a signal
 */
export function useManualExecuteSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ManualExecuteParams) => manualExecuteSignal(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executor-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pending-signals"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

