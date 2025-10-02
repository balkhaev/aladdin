import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../lib/api/client";

export type FuturesPosition = {
  symbol: string;
  side: "Buy" | "Sell";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealisedPnl: number;
  leverage: number;
};

/**
 * Get futures positions from exchange
 */
export function getFuturesPositions(params?: {
  exchange?: string;
  symbol?: string;
}): Promise<FuturesPosition[]> {
  const searchParams = new URLSearchParams();
  if (params?.exchange) searchParams.set("exchange", params.exchange);
  if (params?.symbol) searchParams.set("symbol", params.symbol);

  const url = `/api/trading/positions${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  return apiRequest<FuturesPosition[]>(url);
}

/**
 * Hook to fetch futures positions
 * Uses polling since WebSocket updates are not yet implemented for exchange positions
 */
export function useFuturesPositions(params?: {
  exchange?: string;
  symbol?: string;
}) {
  return useQuery({
    queryKey: ["futures-positions", params],
    queryFn: () => getFuturesPositions(params),
    refetchInterval: 5000, // Poll every 5 seconds until WebSocket is implemented
    staleTime: 4000,
  });
}
