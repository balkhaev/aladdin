/**
 * Validation schemas for Portfolio Service
 * Uses Zod for runtime type validation
 */

import { z } from "zod";

// Constants
const MIN_NAME_LENGTH = 1;
const MAX_NAME_LENGTH = 100;
const MAX_SYMBOL_LENGTH = 20;

/**
 * Create portfolio schema
 */
export const createPortfolioSchema = z.object({
  name: z
    .string()
    .min(MIN_NAME_LENGTH, "Name is required")
    .max(MAX_NAME_LENGTH),
  currency: z.string().optional().default("USDT"),
  initialBalance: z.number().optional(),
});

/**
 * Update portfolio schema
 */
export const updatePortfolioSchema = z.object({
  name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH).optional(),
  currency: z.string().optional(),
});

/**
 * Get performance query schema
 */
export const getPerformanceQuerySchema = z.object({
  days: z
    .string()
    .optional()
    .default("30")
    .transform((val) => Number.parseInt(val, 10)),
});

/**
 * Get portfolios by symbol query schema
 */
export const getPortfoliosBySymbolSchema = z.object({
  userId: z.string().optional(),
});

/**
 * Get portfolios query parameters schema
 */
export const getPortfoliosQuerySchema = z
  .object({
    includeBalances: z.boolean().optional().default(false),
    includePositions: z.boolean().optional().default(false),
  })
  .strict();

/**
 * Get balances query parameters schema
 */
export const getBalancesQuerySchema = z
  .object({
    portfolioId: z
      .string()
      .cuid({ message: "Invalid portfolio ID format" })
      .optional(),
  })
  .strict();

/**
 * Get positions query parameters schema
 */
export const getPositionsQuerySchema = z
  .object({
    portfolioId: z
      .string()
      .cuid({ message: "Invalid portfolio ID format" })
      .optional(),
    symbol: z.string().min(MIN_NAME_LENGTH).max(MAX_SYMBOL_LENGTH).optional(),
  })
  .strict();

/**
 * Import positions schema
 */
export const importPositionsSchema = z.object({
  assets: z
    .array(
      z.object({
        symbol: z.string().min(MIN_NAME_LENGTH).max(MAX_SYMBOL_LENGTH),
        quantity: z.number().positive(),
        currentPrice: z.number().nonnegative(),
      })
    )
    .min(MIN_NAME_LENGTH, "At least one asset is required"),
  exchange: z.string().optional(),
  exchangeCredentialsId: z.string().optional(),
});

/**
 * Get transactions query schema
 */
export const getTransactionsQuerySchema = z.object({
  from: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  to: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  limit: z
    .string()
    .optional()
    .default("100")
    .transform((val) => Number.parseInt(val, 10)),
});

/**
 * Create position schema
 */
export const createPositionSchema = z.object({
  symbol: z.string().min(MIN_NAME_LENGTH).max(MAX_SYMBOL_LENGTH),
  quantity: z.number().positive("Quantity must be positive"),
  entryPrice: z.number().positive("Entry price must be positive"),
  side: z.enum(["LONG", "SHORT"]).default("LONG"),
});

/**
 * Update position schema
 */
export const updatePositionSchema = z.object({
  quantity: z.number().positive("Quantity must be positive").optional(),
  entryPrice: z.number().positive("Entry price must be positive").optional(),
});

/**
 * Export types
 */
export type CreatePortfolioBody = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioBody = z.infer<typeof updatePortfolioSchema>;
export type GetPerformanceQuery = z.infer<typeof getPerformanceQuerySchema>;
export type GetPortfoliosBySymbolQuery = z.infer<
  typeof getPortfoliosBySymbolSchema
>;
export type GetPortfoliosQuery = z.infer<typeof getPortfoliosQuerySchema>;
export type GetBalancesQuery = z.infer<typeof getBalancesQuerySchema>;
export type GetPositionsQuery = z.infer<typeof getPositionsQuerySchema>;
export type ImportPositionsBody = z.infer<typeof importPositionsSchema>;
export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>;
export type CreatePositionBody = z.infer<typeof createPositionSchema>;
export type UpdatePositionBody = z.infer<typeof updatePositionSchema>;
