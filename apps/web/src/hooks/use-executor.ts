/**
 * Hooks for Strategy Executor
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ExecutionMode,
  type ExecutorConfig,
  type ExecutorStats,
  getExecutorConfig,
  getExecutorStats,
  getPendingSignals,
  type ManualExecuteParams,
  manualExecuteSignal,
  setExecutionMode,
  type TradingSignal,
  toggleAutoExecute,
  updateExecutorConfig,
} from "@/lib/api/executor";

const MILLISECONDS_IN_SECOND = 1000;
const SECONDS_FOR_REFETCH = 5;
const SECONDS_FOR_SHORT_STALE = 3;
const SECONDS_FOR_LONG_STALE = 30;

const REFETCH_INTERVAL = SECONDS_FOR_REFETCH * MILLISECONDS_IN_SECOND; // 5 seconds for real-time updates
const STALE_TIME_SHORT = SECONDS_FOR_SHORT_STALE * MILLISECONDS_IN_SECOND; // 3 seconds
const STALE_TIME_LONG = SECONDS_FOR_LONG_STALE * MILLISECONDS_IN_SECOND; // 30 seconds

/**
 * Hook to fetch executor statistics
 */
export function useExecutorStats() {
  return useQuery<ExecutorStats>({
    queryKey: ["executor-stats"],
    queryFn: getExecutorStats,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: STALE_TIME_SHORT,
  });
}

/**
 * Hook to fetch executor configuration
 */
export function useExecutorConfig() {
  return useQuery<ExecutorConfig>({
    queryKey: ["executor-config"],
    queryFn: getExecutorConfig,
    staleTime: STALE_TIME_LONG, // Config changes less frequently
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
    staleTime: STALE_TIME_SHORT,
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
