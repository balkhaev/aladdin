import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { REFETCH_INTERVALS, STALE_TIME } from "@/lib/query-config";
import { marketKeys } from "@/lib/query-keys";

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
  volumeUsd: number;
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
    queryKey: marketKeys.overview(),
    queryFn: () => apiGet<MarketOverview>("/api/analytics/market-overview"),
    refetchInterval: REFETCH_INTERVALS.NORMAL,
    staleTime: STALE_TIME.NORMAL,
    enabled,
  });
}
