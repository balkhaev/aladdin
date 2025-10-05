/**
 * Validation schemas for Trading Service
 * Uses Zod for runtime type validation
 */

import { z } from "zod";

// Symbol validation
const MIN_SYMBOL_LENGTH = 3;
const MAX_SYMBOL_LENGTH = 20;
const SYMBOL_PATTERN = /^[A-Z0-9]+$/;

// Query parameters
const MAX_QUERY_LIMIT = 1000;
const DEFAULT_QUERY_LIMIT = 50;
const DEFAULT_QUERY_OFFSET = 0;

/**
 * Order side schema
 */
export const orderSideSchema = z.enum(["BUY", "SELL"], {
  errorMap: () => ({ message: "Order side must be either BUY or SELL" }),
});

/**
 * Order type schema
 */
export const orderTypeSchema = z.enum(
  [
    "MARKET",
    "LIMIT",
    "STOP_LOSS",
    "TAKE_PROFIT",
    "STOP_LOSS_LIMIT",
    "TAKE_PROFIT_LIMIT",
  ],
  {
    errorMap: () => ({
      message:
        "Order type must be one of: MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT, STOP_LOSS_LIMIT, TAKE_PROFIT_LIMIT",
    }),
  }
);

/**
 * Order status schema
 */
export const orderStatusSchema = z.enum([
  "PENDING",
  "OPEN",
  "FILLED",
  "PARTIALLY_FILLED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);

/**
 * Exchange schema
 */
export const exchangeSchema = z.enum(["binance", "bybit"], {
  errorMap: () => ({ message: "Exchange must be either binance or bybit" }),
});

/**
 * Create order request schema
 * Supports both legacy exchange parameter and new exchangeCredentialsId
 */
export const createOrderSchema = z
  .object({
    portfolioId: z
      .string()
      .cuid({ message: "Invalid portfolio ID format" })
      .optional(),
    symbol: z
      .string()
      .min(MIN_SYMBOL_LENGTH, "Symbol must be at least 3 characters")
      .max(MAX_SYMBOL_LENGTH, "Symbol must be at most 20 characters")
      .transform((val) => val.toUpperCase())
      .refine(
        (val) => SYMBOL_PATTERN.test(val),
        "Symbol must contain only uppercase letters and numbers"
      ),
    side: orderSideSchema,
    type: orderTypeSchema,
    quantity: z
      .number()
      .positive("Quantity must be positive")
      .finite("Quantity must be finite"),
    price: z
      .number()
      .positive("Price must be positive")
      .finite("Price must be finite")
      .optional(),
    stopPrice: z
      .number()
      .positive("Stop price must be positive")
      .finite("Stop price must be finite")
      .optional(),
    // New: exchangeCredentialsId for API key binding
    exchangeCredentialsId: z
      .string()
      .cuid({ message: "Invalid exchange credentials ID format" })
      .optional(),
    // Legacy: exchange parameter (for backward compatibility)
    exchange: exchangeSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      // LIMIT orders must have a price
      if (data.type === "LIMIT" && !data.price) {
        return false;
      }
      return true;
    },
    {
      message: "LIMIT orders must include a price",
      path: ["price"],
    }
  )
  .refine(
    (data) => {
      // STOP_LOSS and TAKE_PROFIT orders must have a stopPrice
      const requiresStopPrice =
        data.type === "STOP_LOSS" || data.type === "TAKE_PROFIT";
      return !requiresStopPrice || Boolean(data.stopPrice);
    },
    {
      message: "STOP_LOSS and TAKE_PROFIT orders must include a stopPrice",
      path: ["stopPrice"],
    }
  )
  .refine(
    (data) => {
      // STOP_LOSS_LIMIT and TAKE_PROFIT_LIMIT orders must have both price and stopPrice
      const requiresBoth =
        data.type === "STOP_LOSS_LIMIT" || data.type === "TAKE_PROFIT_LIMIT";
      return !requiresBoth || (Boolean(data.price) && Boolean(data.stopPrice));
    },
    {
      message:
        "STOP_LOSS_LIMIT and TAKE_PROFIT_LIMIT orders must include both price and stopPrice",
      path: ["price", "stopPrice"],
    }
  )
  .refine(
    (data) => {
      // Either exchangeCredentialsId or exchange must be provided
      return Boolean(data.exchangeCredentialsId) || Boolean(data.exchange);
    },
    {
      message: "Either exchangeCredentialsId or exchange must be provided",
      path: ["exchangeCredentialsId", "exchange"],
    }
  );

/**
 * Cancel order request schema
 */
export const cancelOrderSchema = z.object({
  orderId: z.string().cuid({ message: "Invalid order ID format" }),
});

/**
 * Get order request schema
 */
export const getOrderSchema = z.object({
  orderId: z.string().cuid({ message: "Invalid order ID format" }),
});

/**
 * Get order query schema (for URL params)
 */
export const getOrderQuerySchema = z.object({});

/**
 * Update order request schema
 */
export const updateOrderSchema = z
  .object({
    quantity: z
      .number()
      .positive("Quantity must be positive")
      .finite("Quantity must be finite")
      .optional(),
    price: z
      .number()
      .positive("Price must be positive")
      .finite("Price must be finite")
      .optional(),
  })
  .strict()
  .refine((data) => data.quantity !== undefined || data.price !== undefined, {
    message: "At least one of quantity or price must be provided",
  });

/**
 * Cancel all orders request schema
 */
export const cancelAllOrdersSchema = z
  .object({
    portfolioId: z
      .string()
      .cuid({ message: "Invalid portfolio ID format" })
      .optional(),
    symbol: z
      .string()
      .min(MIN_SYMBOL_LENGTH, "Symbol must be at least 3 characters")
      .max(MAX_SYMBOL_LENGTH, "Symbol must be at most 20 characters")
      .transform((val) => val.toUpperCase())
      .refine(
        (val) => SYMBOL_PATTERN.test(val),
        "Symbol must contain only uppercase letters and numbers"
      )
      .optional(),
  })
  .strict();

/**
 * Sync order request schema
 */
export const syncOrderSchema = z.object({
  orderId: z.string().cuid({ message: "Invalid order ID format" }),
});

/**
 * Get orders query parameters schema
 */
export const getOrdersQuerySchema = z
  .object({
    status: orderStatusSchema.optional(),
    symbol: z
      .string()
      .min(MIN_SYMBOL_LENGTH)
      .max(MAX_SYMBOL_LENGTH)
      .transform((val) => val.toUpperCase())
      .refine(
        (val) => SYMBOL_PATTERN.test(val),
        "Symbol must contain only uppercase letters and numbers"
      )
      .optional(),
    exchange: exchangeSchema.default("binance"),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_QUERY_LIMIT, "Limit cannot exceed 1000")
      .optional()
      .default(DEFAULT_QUERY_LIMIT),
    offset: z.coerce
      .number()
      .int()
      .nonnegative()
      .optional()
      .default(DEFAULT_QUERY_OFFSET),
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
 * Get trades query parameters schema
 */
export const getTradesQuerySchema = z
  .object({
    portfolioId: z
      .string()
      .cuid({ message: "Invalid portfolio ID format" })
      .optional(),
    symbol: z
      .string()
      .min(MIN_SYMBOL_LENGTH)
      .max(MAX_SYMBOL_LENGTH)
      .transform((val) => val.toUpperCase())
      .refine(
        (val) => SYMBOL_PATTERN.test(val),
        "Symbol must contain only uppercase letters and numbers"
      )
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_QUERY_LIMIT, "Limit cannot exceed 1000")
      .optional()
      .default(DEFAULT_QUERY_LIMIT),
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
    symbol: z
      .string()
      .min(MIN_SYMBOL_LENGTH)
      .max(MAX_SYMBOL_LENGTH)
      .transform((val) => val.toUpperCase())
      .refine(
        (val) => SYMBOL_PATTERN.test(val),
        "Symbol must contain only uppercase letters and numbers"
      )
      .optional(),
  })
  .strict();

/**
 * Export types
 */
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type GetOrderInput = z.infer<typeof getOrderSchema>;
export type SyncOrderInput = z.infer<typeof syncOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type CancelAllOrdersInput = z.infer<typeof cancelAllOrdersSchema>;
export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>;
export type GetBalancesQuery = z.infer<typeof getBalancesQuerySchema>;
export type GetTradesQuery = z.infer<typeof getTradesQuerySchema>;
export type GetPositionsQuery = z.infer<typeof getPositionsQuerySchema>;
