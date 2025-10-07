/**
 * React Query hooks for Portfolio Optimization
 */

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type OptimizationConstraints,
  type OptimizedPortfolio,
  optimizePortfolio,
} from "../lib/api/portfolio";

/**
 * Hook to optimize portfolio weights
 */
export function useOptimizePortfolio() {
  return useMutation<
    OptimizedPortfolio,
    Error,
    {
      portfolioId: string;
      assets: string[];
      days?: number;
      constraints?: OptimizationConstraints;
    },
    unknown
  >({
    mutationFn: ({ portfolioId, assets, days, constraints }) =>
      optimizePortfolio(portfolioId, { assets, days, constraints }),
    onSuccess: (data) => {
      toast.success("Portfolio optimized successfully", {
        description: `Sharpe Ratio: ${data.sharpeRatio.toFixed(2)}`,
      });
    },
    onError: (error) => {
      toast.error("Failed to optimize portfolio", {
        description: error.message,
      });
    },
  });
}
