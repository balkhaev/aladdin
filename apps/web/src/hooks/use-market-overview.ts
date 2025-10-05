import { useQuery } from "@tanstack/react-query";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const REFETCH_INTERVAL = 120_000; // 2 minutes

export type MarketMover = {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
};

export type VolumeLeader = {
  symbol: string;
  price: number;
  volume24h: number;
  trades24h: number;
};

export type MarketStats = {
  totalVolume24h: number;
  totalSymbols: number;
  avgVolatility: number;
  gainersCount: number;
  losersCount: number;
  unchangedCount: number;
  timestamp: Date;
};

export type MarketOverview = {
  topGainers: MarketMover[];
  topLosers: MarketMover[];
  volumeLeaders: VolumeLeader[];
  marketStats: MarketStats;
};

/**
 * Hook to fetch market overview data
 */
export function useMarketOverview(enabled = true) {
  return useQuery<MarketOverview>({
    queryKey: ["market-overview"],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/analytics/market-overview`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch market overview");
      }

      const result = await response.json();
      return result.data;
    },
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 60_000, // Consider data stale after 1 minute
    enabled,
  });
}
