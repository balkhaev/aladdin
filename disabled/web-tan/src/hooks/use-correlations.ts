import { useQuery } from "@tanstack/react-query";

type CorrelationData = {
  blockchain: string;
  period: {
    from: number;
    to: number;
  };
  correlationMatrix: Record<string, Record<string, number>>;
  metricNames: string[];
  dataPoints: number;
};

/**
 * Hook to fetch correlation matrix for on-chain metrics
 */
export function useCorrelations(
  blockchain: "BTC" | "ETH",
  period: { from: number; to: number }
) {
  return useQuery({
    queryKey: ["correlations", blockchain, period.from, period.to],
    queryFn: async (): Promise<CorrelationData> => {
      const params = new URLSearchParams({
        from: period.from.toString(),
        to: period.to.toString(),
      });

      const response = await fetch(
        `/api/market-data/on-chain/correlations/${blockchain}?${params}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch correlations");
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
}
