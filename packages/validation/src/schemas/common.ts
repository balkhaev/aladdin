/**
 * Общие validation schemas для переиспользования между сервисами
 */

import { z } from "zod";

/**
 * Symbol schema (торговая пара)
 */
export const symbolSchema = z
  .string()
  .min(1)
  .toUpperCase()
  .regex(/^[A-Z0-9]+$/);

/**
 * Timeframe schema (временной интервал)
 */
export const timeframeSchema = z.enum([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

/**
 * Exchange schema (биржа)
 */
export const exchangeSchema = z.enum(["binance", "bybit", "okx", "kraken"]);

/**
 * Timestamp schema (Unix timestamp в миллисекундах)
 */
export const timestampSchema = z.number().int().positive();

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Sorting schema
 */
export const sortingSchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Portfolio ID schema
 */
export const portfolioIdSchema = z.string().uuid();

/**
 * User ID schema
 */
export const userIdSchema = z.string().min(1);

/**
 * Price schema (положительное число)
 */
export const priceSchema = z.number().positive();

/**
 * Quantity schema (положительное число)
 */
export const quantitySchema = z.number().positive();

/**
 * Percentage schema (0-100)
 */
export const percentageSchema = z.number().min(0).max(100);

/**
 * Optional percentage schema (0-100 или undefined)
 */
export const optionalPercentageSchema = percentageSchema.optional();

/**
 * Common query параметры
 */
export const commonQuerySchema = paginationSchema.merge(sortingSchema);

/**
 * ID parameter (из URL path)
 */
export const idParamSchema = z.object({
  id: z.string().min(1),
});

/**
 * Symbol parameter (из URL path)
 */
export const symbolParamSchema = z.object({
  symbol: symbolSchema,
});

/**
 * Common API response wrapper
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .optional(),
    timestamp: z.number(),
  });

/**
 * Validation error response
 */
export const validationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string().optional(),
});

/**
 * Batch validation errors
 */
export const validationErrorsSchema = z.array(validationErrorSchema);

/**
 * Types exported from schemas
 */
export type Symbol = z.infer<typeof symbolSchema>;
export type Timeframe = z.infer<typeof timeframeSchema>;
export type Exchange = z.infer<typeof exchangeSchema>;
export type Timestamp = z.infer<typeof timestampSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Sorting = z.infer<typeof sortingSchema>;
export type PortfolioId = z.infer<typeof portfolioIdSchema>;
export type UserId = z.infer<typeof userIdSchema>;
export type Price = z.infer<typeof priceSchema>;
export type Quantity = z.infer<typeof quantitySchema>;
export type Percentage = z.infer<typeof percentageSchema>;
export type CommonQuery = z.infer<typeof commonQuerySchema>;
export type IdParam = z.infer<typeof idParamSchema>;
export type SymbolParam = z.infer<typeof symbolParamSchema>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
export type ValidationErrors = z.infer<typeof validationErrorsSchema>;
