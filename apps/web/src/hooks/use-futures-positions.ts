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
 * Response type for positions endpoint
 */
type PositionsResponse = {
  positions: FuturesPosition[];
  count: number;
};

/**
 * Get futures positions from exchange
 */
export async function getFuturesPositions(params?: {
  exchange?: string;
  symbol?: string;
}): Promise<FuturesPosition[]> {
  const searchParams = new URLSearchParams();
  if (params?.exchange) searchParams.set("exchange", params.exchange);
  if (params?.symbol) searchParams.set("symbol", params.symbol);

  const url = `/api/trading/positions${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await apiRequest<PositionsResponse>(url);

  // Проверяем, что positions является массивом
  return Array.isArray(response?.positions) ? response.positions : [];
}

/**
 * Hook to fetch futures positions
 * Real-time updates handled by useFuturesPositionsWebSocket - cache is kept fresh via WebSocket
 */
export function useFuturesPositions(params?: {
  exchange?: string;
  symbol?: string;
}) {
  return useQuery({
    queryKey: ["futures-positions", params],
    queryFn: () => getFuturesPositions(params),
    // WebSocket keeps cache fresh - no polling needed
    staleTime: Number.POSITIVE_INFINITY,
  });
}
