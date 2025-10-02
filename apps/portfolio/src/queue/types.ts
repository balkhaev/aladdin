/**
 * Portfolio Queue Types
 */

export type PriceUpdateJob = {
  portfolioId: string;
  userId: string;
};

export type PriceUpdateResult = {
  portfolioId: string;
  updated: number;
  total: number;
  success: boolean;
  error?: string;
};
