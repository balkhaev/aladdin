import { useQuery } from "@tanstack/react-query";
import {
  getPortfolioSummary,
  type PortfolioSummary,
} from "@/lib/api/analytics";

const REFETCH_INTERVAL = 300_000; // 5 minutes

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
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 120_000, // Consider data stale after 2 minutes
    enabled: enabled && !!portfolioId,
  });
}
