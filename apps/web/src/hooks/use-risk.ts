/**
 * Risk React Hooks
 * Custom hooks for risk service operations using TanStack Query
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type CreateRiskLimitInput,
  createRiskLimit,
  deleteRiskLimit,
  getCVaR,
  getPortfolioCorrelations,
  getPortfolioExposure,
  getRiskLimits,
  getStressTestScenarios,
  getVaR,
  runStressTest,
  type StressScenario,
  type UpdateRiskLimitInput,
  updateRiskLimit,
} from "../lib/api/risk";

/**
 * Hook to get portfolio correlations
 */
export function usePortfolioCorrelations(
  portfolioId: string,
  params?: { window?: "7d" | "30d" | "90d" }
) {
  return useQuery({
    queryKey: ["risk", "correlations", portfolioId, params?.window],
    queryFn: () => getPortfolioCorrelations(portfolioId, params),
    enabled: Boolean(portfolioId),
    staleTime: 300_000, // Cache for 5 minutes
  });
}

/**
 * Hook to get portfolio exposure (long/short/leverage)
 */
export function useExposure(portfolioId: string) {
  return useQuery({
    queryKey: ["risk", "exposure", portfolioId],
    queryFn: () => getPortfolioExposure(portfolioId),
    enabled: Boolean(portfolioId),
    staleTime: 60_000, // Cache for 1 minute
  });
}

/**
 * Hook to get Value at Risk (VaR)
 */
export function useVaR(params: {
  portfolioId: string;
  confidenceLevel?: number;
  timeHorizon?: number;
}) {
  return useQuery({
    queryKey: [
      "risk",
      "var",
      params.portfolioId,
      params.confidenceLevel,
      params.timeHorizon,
    ],
    queryFn: () => getVaR(params),
    enabled: Boolean(params.portfolioId),
    staleTime: 60_000, // Cache for 1 minute
  });
}

/**
 * Hook to get risk limits
 */
export function useRiskLimits(params?: {
  portfolioId?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["risk", "limits", params?.portfolioId, params?.enabled],
    queryFn: () => getRiskLimits(params),
    staleTime: 60_000, // Cache for 1 minute
  });
}

/**
 * Hook to create risk limit
 */
export function useCreateRiskLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRiskLimitInput) => createRiskLimit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk", "limits"] });
      toast.success("Лимит создан успешно");
    },
    onError: (error: Error) => {
      toast.error("Ошибка создания лимита", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to update risk limit
 */
export function useUpdateRiskLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      limitId,
      data,
    }: {
      limitId: string;
      data: UpdateRiskLimitInput;
    }) => updateRiskLimit(limitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk", "limits"] });
      toast.success("Лимит обновлен");
    },
    onError: (error: Error) => {
      toast.error("Ошибка обновления лимита", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to delete risk limit
 */
export function useDeleteRiskLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (limitId: string) => deleteRiskLimit(limitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["risk", "limits"] });
      toast.success("Лимит удален");
    },
    onError: (error: Error) => {
      toast.error("Ошибка удаления лимита", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to get Conditional Value at Risk (CVaR)
 */
export function useCVaR(portfolioId: string, confidence?: 95 | 99) {
  return useQuery({
    queryKey: ["risk", "cvar", portfolioId, confidence],
    queryFn: () => getCVaR(portfolioId, confidence),
    enabled: Boolean(portfolioId),
    staleTime: 60_000, // Cache for 1 minute
  });
}

/**
 * Hook to run stress test
 */
export function useStressTest() {
  return useMutation({
    mutationFn: ({
      portfolioId,
      scenarios,
    }: {
      portfolioId: string;
      scenarios?: StressScenario[];
    }) => runStressTest(portfolioId, scenarios),
    onError: (error: Error) => {
      toast.error("Ошибка стресс-теста", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to get stress test scenarios
 */
export function useStressTestScenarios() {
  return useQuery({
    queryKey: ["risk", "stress-test", "scenarios"],
    queryFn: () => getStressTestScenarios(),
    staleTime: 3_600_000, // Cache for 1 hour
  });
}
