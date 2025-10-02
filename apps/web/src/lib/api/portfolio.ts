/**
 * Portfolio API module
 * Provides functions to interact with Portfolio Service via API Gateway
 */

import { apiClient } from "./client";

// Types
export type Position = {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  updatedAt: string;
};

export type Portfolio = {
  id: string;
  userId: string;
  name: string;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: Position[];
  createdAt: string;
  updatedAt: string;
};

export type PortfolioPerformance = {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  weeklyPnl: number;
  weeklyPnlPercent: number;
  monthlyPnl: number;
  monthlyPnlPercent: number;
  snapshots: Array<{ timestamp: string; totalValue: number; pnl: number }>;
};

export type PortfolioAllocation = {
  symbol: string;
  value: number;
  percentage: number;
};

/**
 * Get user's portfolios
 */
export function getPortfolios(): Promise<Portfolio[]> {
  return apiClient.get<Portfolio[]>("/api/portfolio");
}

/**
 * Get portfolio by ID
 */
export function getPortfolioById(id: string): Promise<Portfolio> {
  return apiClient.get<Portfolio>(`/api/portfolio/${id}`);
}

/**
 * Get portfolio performance metrics
 */
export function getPortfolioPerformance(
  id: string
): Promise<PortfolioPerformance> {
  return apiClient.get<PortfolioPerformance>(
    `/api/portfolio/${id}/performance`
  );
}

/**
 * Get portfolio asset allocations
 */
export function getPortfolioAllocations(
  id: string
): Promise<PortfolioAllocation[]> {
  return apiClient.get<PortfolioAllocation[]>(
    `/api/portfolio/${id}/allocations`
  );
}

/**
 * Create a new portfolio
 */
export function createPortfolio(data: { name: string }): Promise<Portfolio> {
  return apiClient.post<Portfolio>("/api/portfolio", data);
}

/**
 * Import positions from exchange to portfolio
 */
export function importPositions(
  portfolioId: string,
  assets: Array<{ symbol: string; quantity: number; currentPrice: number }>,
  exchange?: string,
  exchangeCredentialsId?: string
): Promise<{
  portfolioId: string;
  imported: number;
  positions: Array<{
    id: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
  }>;
}> {
  return apiClient.post(`/api/portfolio/${portfolioId}/import`, {
    assets,
    exchange,
    exchangeCredentialsId,
  });
}

/**
 * Update positions prices from market data
 */
export function updatePositionsPrices(portfolioId: string): Promise<{
  portfolioId: string;
  updated: number;
}> {
  return apiClient.post(`/api/portfolio/${portfolioId}/update-prices`, {});
}

// Transaction types
export type Transaction = {
  id: string;
  timestamp: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  value: number;
  pnl: number;
};

/**
 * Get portfolio transactions
 */
export function getPortfolioTransactions(
  portfolioId: string,
  params?: { from?: string; to?: string; limit?: number }
): Promise<Transaction[]> {
  const searchParams = new URLSearchParams();
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.limit) searchParams.set("limit", params.limit.toString());

  const query = searchParams.toString();
  return apiClient.get<Transaction[]>(
    `/api/portfolio/${portfolioId}/transactions${query ? `?${query}` : ""}`
  );
}

/**
 * Create position manually
 */
export function createPosition(
  portfolioId: string,
  data: {
    symbol: string;
    quantity: number;
    entryPrice: number;
    side?: "LONG" | "SHORT";
  }
): Promise<Position> {
  return apiClient.post(`/api/portfolio/${portfolioId}/positions`, data);
}

/**
 * Update position manually
 */
export function updatePosition(
  portfolioId: string,
  positionId: string,
  data: { quantity?: number; entryPrice?: number }
): Promise<Position> {
  return apiClient.patch(
    `/api/portfolio/${portfolioId}/positions/${positionId}`,
    data
  );
}

/**
 * Delete position
 */
export function deletePosition(
  portfolioId: string,
  positionId: string
): Promise<{ message: string }> {
  return apiClient.delete(
    `/api/portfolio/${portfolioId}/positions/${positionId}`
  );
}
