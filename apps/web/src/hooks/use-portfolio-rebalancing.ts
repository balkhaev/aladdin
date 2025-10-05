/**
 * React Query hooks for Portfolio Rebalancing
 */

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  analyzeRebalancing,
  executeRebalancing,
  type RebalancingConfig,
  type RebalancingPlan,
} from "../lib/api/portfolio";

/**
 * Hook to analyze portfolio rebalancing needs
 */
export function useAnalyzeRebalancing() {
  return useMutation<
    RebalancingPlan,
    Error,
    {
      portfolioId: string;
      targetWeights: Record<string, number>;
      config: RebalancingConfig;
    },
    unknown
  >({
    mutationFn: ({ portfolioId, targetWeights, config }) =>
      analyzeRebalancing(portfolioId, { targetWeights, config }),
    onSuccess: (data) => {
      if (data.needsRebalancing) {
        toast.success("Rebalancing analysis complete", {
          description: `Priority: ${data.priority} - ${data.reason}`,
        });
      } else {
        toast.info("No rebalancing needed", {
          description: data.reason,
        });
      }
    },
    onError: (error) => {
      toast.error("Failed to analyze rebalancing", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to execute portfolio rebalancing
 */
export function useExecuteRebalancing() {
  return useMutation<
    {
      orders: Array<{
        symbol: string;
        side: "BUY" | "SELL";
        quantity: number;
        type: "LIMIT" | "MARKET";
        price?: number;
      }>;
      dryRun: boolean;
    },
    Error,
    {
      portfolioId: string;
      plan: RebalancingPlan;
      dryRun?: boolean;
    },
    unknown
  >({
    mutationFn: ({ portfolioId, plan, dryRun }) =>
      executeRebalancing(portfolioId, { plan, dryRun }),
    onSuccess: (data) => {
      if (data.dryRun) {
        toast.info("Rebalancing simulation complete", {
          description: `${data.orders.length} orders would be generated`,
        });
      } else {
        toast.success("Rebalancing executed", {
          description: `${data.orders.length} orders placed successfully`,
        });
      }
    },
    onError: (error) => {
      toast.error("Failed to execute rebalancing", {
        description: error.message,
      });
    },
  });
}
