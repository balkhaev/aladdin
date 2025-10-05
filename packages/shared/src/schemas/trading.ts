/**
 * Trading validation schemas
 */

import { z } from "zod";
import {
  exchangeSchema,
  paginationSchema,
  portfolioIdSchema,
  priceSchema,
  quantitySchema,
  symbolSchema,
  userIdSchema,
} from "./common";

/**
 * Order type schema
 */
export const orderTypeSchema = z.enum([
  "MARKET",
  "LIMIT",
  "STOP_LOSS",
  "STOP_LOSS_LIMIT",
  "TAKE_PROFIT",
  "TAKE_PROFIT_LIMIT",
]);

/**
 * Order side schema
 */
export const orderSideSchema = z.enum(["BUY", "SELL"]);

/**
 * Order status schema
 */
export const orderStatusSchema = z.enum([
  "PENDING",
  "OPEN",
  "PARTIALLY_FILLED",
  "FILLED",
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
]);

/**
 * Create order schema
 */
export const createOrderSchema = z.object({
  portfolioId: portfolioIdSchema,
  symbol: symbolSchema,
  type: orderTypeSchema,
  side: orderSideSchema,
  quantity: quantitySchema,
  price: priceSchema.optional(),
  stopPrice: priceSchema.optional(),
  exchange: exchangeSchema,
  exchangeCredentialsId: z.string().min(1),
});

/**
 * Get orders query schema
 */
export const getOrdersQuerySchema = paginationSchema.extend({
  portfolioId: portfolioIdSchema.optional(),
  symbol: symbolSchema.optional(),
  status: orderStatusSchema.optional(),
  exchange: exchangeSchema.optional(),
});

/**
 * Order schema (response)
 */
export const orderSchema = z.object({
  id: z.string(),
  userId: userIdSchema,
  portfolioId: portfolioIdSchema,
  symbol: symbolSchema,
  type: orderTypeSchema,
  side: orderSideSchema,
  quantity: quantitySchema,
  price: priceSchema.optional(),
  stopPrice: priceSchema.optional(),
  filledQuantity: quantitySchema.default(0),
  averagePrice: priceSchema.optional(),
  status: orderStatusSchema,
  exchange: exchangeSchema,
  exchangeOrderId: z.string().optional(),
  exchangeCredentialsId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Position schema
 */
export const positionSchema = z.object({
  symbol: symbolSchema,
  side: z.enum(["LONG", "SHORT"]),
  quantity: quantitySchema,
  entryPrice: priceSchema,
  markPrice: priceSchema.optional(),
  liquidationPrice: priceSchema.optional(),
  leverage: z.number().positive().optional(),
  unrealizedPnl: z.number().optional(),
  realizedPnl: z.number().optional(),
  margin: z.number().optional(),
  marginRatio: z.number().optional(),
});

/**
 * Balance schema
 */
export const balanceSchema = z.object({
  asset: z.string(),
  free: z.number().nonnegative(),
  locked: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

/**
 * Market impact calculation schema
 */
export const marketImpactRequestSchema = z.object({
  symbol: symbolSchema,
  orderSize: quantitySchema,
  side: orderSideSchema,
  urgency: z.enum(["low", "medium", "high"]).optional(),
  currentPrice: priceSchema,
  dailyVolume: quantitySchema,
  spread: z.number(),
  volatility: z.number().optional(),
});

export const marketImpactResponseSchema = z.object({
  temporaryImpact: z.number(),
  permanentImpact: z.number(),
  expectedSlippage: z.number(),
  estimatedCost: z.number(),
  participationRate: z.number(),
  priceImpactBps: z.number(),
  recommendation: z.object({
    shouldSplit: z.boolean(),
    optimalChunks: z.number(),
    timeHorizon: z.number(),
    reason: z.string(),
  }),
});

/**
 * Order splitting strategy schema
 */
export const orderSplittingRequestSchema = z.object({
  impact: marketImpactResponseSchema,
  orderSize: quantitySchema,
  volatility: z.number().optional(),
});

export const orderSplittingResponseSchema = z.object({
  strategy: z.enum(["TWAP", "VWAP", "POV", "IMMEDIATE"]),
  chunks: z.array(
    z.object({
      size: quantitySchema,
      delaySeconds: z.number().nonnegative(),
      expectedPrice: priceSchema,
      expectedSlippage: z.number(),
    })
  ),
  totalDurationSeconds: z.number(),
  totalEstimatedCost: z.number(),
  expectedSavings: z.number(),
});

/**
 * Implementation shortfall schema
 */
export const implementationShortfallRequestSchema = z.object({
  decisionPrice: priceSchema,
  actualFillPrice: priceSchema,
  orderSize: quantitySchema,
  side: orderSideSchema,
});

export const implementationShortfallResponseSchema = z.object({
  shortfall: z.number(),
  shortfallBps: z.number(),
  shortfallPercent: z.number(),
  totalCost: z.number(),
});

/**
 * Smart routing schemas
 */
export const exchangeQuoteSchema = z.object({
  exchange: exchangeSchema,
  price: priceSchema,
  availableLiquidity: quantitySchema,
  estimatedFee: z.number(),
  latency: z.number(),
  timestamp: z.number(),
});

export const smartRoutingRequestSchema = z.object({
  params: z.object({
    symbol: symbolSchema,
    side: orderSideSchema,
    quantity: quantitySchema,
    orderType: orderTypeSchema,
    strategy: z
      .enum(["best-price", "best-execution", "fastest", "split", "smart"])
      .optional(),
    maxSlippage: z.number().optional(),
    urgency: z.enum(["low", "medium", "high"]).optional(),
    allowedExchanges: z.array(exchangeSchema).optional(),
  }),
  quotes: z.array(exchangeQuoteSchema),
});

export const smartRoutingResponseSchema = z.object({
  strategy: z.string(),
  routes: z.array(
    z.object({
      exchange: exchangeSchema,
      quantity: quantitySchema,
      expectedPrice: priceSchema,
      expectedFee: z.number(),
      weight: z.number(),
    })
  ),
  totalExpectedPrice: priceSchema,
  totalExpectedFee: z.number(),
  estimatedSavings: z.number(),
  reason: z.string(),
});

/**
 * Types
 */
export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderSide = z.infer<typeof orderSideSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type GetOrdersQuery = z.infer<typeof getOrdersQuerySchema>;
export type Order = z.infer<typeof orderSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type MarketImpactRequest = z.infer<typeof marketImpactRequestSchema>;
export type MarketImpactResponse = z.infer<typeof marketImpactResponseSchema>;
export type OrderSplittingRequest = z.infer<typeof orderSplittingRequestSchema>;
export type OrderSplittingResponse = z.infer<
  typeof orderSplittingResponseSchema
>;
export type ImplementationShortfallRequest = z.infer<
  typeof implementationShortfallRequestSchema
>;
export type ImplementationShortfallResponse = z.infer<
  typeof implementationShortfallResponseSchema
>;
export type ExchangeQuote = z.infer<typeof exchangeQuoteSchema>;
export type SmartRoutingRequest = z.infer<typeof smartRoutingRequestSchema>;
export type SmartRoutingResponse = z.infer<typeof smartRoutingResponseSchema>;
