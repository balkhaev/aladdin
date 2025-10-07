import { useQuery } from "@tanstack/react-query";
import {
  getPortfolioSummary,
  type PortfolioSummary,
} from "@/lib/api/analytics";
import { REFETCH_INTERVALS, STALE_TIME } from "@/lib/query-config";

type UsePortfolioSummaryOptions = {
  from?: Date;
  to?: Date;
  window?: "7d" | "30d" | "90d";
  benchmark?: string;
  enabled?: boolean;
};

/**
 * Hook to fetch comprehensive portfolio summary
 * Combines advanced metrics, risk metrics, correlations, and market overview in one request
 *
 * This is more efficient than making multiple separate requests for:
 * - Advanced metrics
 * - Risk metrics (VaR, CVaR)
 * - Correlations
 * - Market overview
 */
export function usePortfolioSummary(
  portfolioId: string | undefined,
  options?: UsePortfolioSummaryOptions
) {
  const { from, to, window, benchmark, enabled = true } = options || {};

  return useQuery<PortfolioSummary>({
    queryKey: [
      "portfolio-summary",
      portfolioId,
      { from, to, window, benchmark },
    ],
    queryFn: () => {
      if (!portfolioId) {
        throw new Error("Portfolio ID is required");
      }

      return getPortfolioSummary(portfolioId, {
        from: from?.toISOString(),
        to: to?.toISOString(),
        window,
        benchmark,
      });
    },
    refetchInterval: REFETCH_INTERVALS.SLOW,
    staleTime: STALE_TIME.SLOW,
    enabled: enabled && !!portfolioId,
  });
}
