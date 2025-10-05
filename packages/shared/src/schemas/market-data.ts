/**
 * Market Data validation schemas
 */

import { z } from "zod";
import {
  exchangeSchema,
  priceSchema,
  quantitySchema,
  symbolSchema,
  timeframeSchema,
  timestampSchema,
} from "./common";

/**
 * Quote schema
 */
export const quoteSchema = z.object({
  symbol: symbolSchema,
  price: priceSchema,
  bidPrice: priceSchema.optional(),
  askPrice: priceSchema.optional(),
  volume: quantitySchema,
  change24h: z.number(),
  changePercent24h: z.number(),
  high24h: priceSchema.optional(),
  low24h: priceSchema.optional(),
  timestamp: timestampSchema,
});

/**
 * Candle schema
 */
export const candleSchema = z.object({
  timestamp: timestampSchema,
  open: priceSchema,
  high: priceSchema,
  low: priceSchema,
  close: priceSchema,
  volume: quantitySchema,
});

/**
 * Order book level schema
 */
export const orderBookLevelSchema = z.object({
  price: priceSchema,
  quantity: quantitySchema,
});

/**
 * Order book schema
 */
export const orderBookSchema = z.object({
  symbol: symbolSchema,
  bids: z.array(orderBookLevelSchema),
  asks: z.array(orderBookLevelSchema),
  timestamp: timestampSchema,
});

/**
 * Trade schema
 */
export const tradeSchema = z.object({
  id: z.string(),
  symbol: symbolSchema,
  price: priceSchema,
  quantity: quantitySchema,
  side: z.enum(["BUY", "SELL"]),
  timestamp: timestampSchema,
});

/**
 * Aggregated price schema
 */
export const aggregatedPriceSchema = z.object({
  symbol: symbolSchema,
  binance_price: priceSchema.nullable(),
  binance_volume: quantitySchema.nullable(),
  bybit_price: priceSchema.nullable(),
  bybit_volume: quantitySchema.nullable(),
  okx_price: priceSchema.nullable(),
  okx_volume: quantitySchema.nullable(),
  vwap: priceSchema,
  avg_price: priceSchema,
  total_volume: quantitySchema,
  max_spread_percent: z.number(),
  max_spread_exchange_high: exchangeSchema.nullable(),
  max_spread_exchange_low: exchangeSchema.nullable(),
  timestamp: timestampSchema,
});

/**
 * Arbitrage opportunity schema
 */
export const arbitrageOpportunitySchema = z.object({
  symbol: symbolSchema,
  buyExchange: exchangeSchema,
  sellExchange: exchangeSchema,
  buyPrice: priceSchema,
  sellPrice: priceSchema,
  spreadPercent: z.number(),
  potentialProfit: z.number(),
  timestamp: timestampSchema,
});

/**
 * Query schemas
 */

export const getCandlesQuerySchema = z.object({
  timeframe: timeframeSchema.default("1h"),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

export const getOrderBookQuerySchema = z.object({
  exchange: exchangeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const getTradesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

export const getAggregatedQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(1),
});

export const getArbitrageQuerySchema = z.object({
  minSpread: z.coerce.number().min(0).default(0.1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const subscribeSymbolsBodySchema = z.object({
  symbol: symbolSchema.optional(),
  symbols: z.array(symbolSchema).optional(),
});

/**
 * Funding rate schema
 */
export const fundingRateSchema = z.object({
  symbol: symbolSchema,
  exchange: exchangeSchema,
  fundingRate: z.number(),
  fundingTime: timestampSchema,
  nextFundingTime: timestampSchema.optional(),
  timestamp: timestampSchema,
});

export const getFundingRateQuerySchema = z.object({
  exchange: exchangeSchema.optional(),
  hours: z.coerce.number().int().positive().max(168).default(24), // max 1 week
});

/**
 * Open interest schema
 */
export const openInterestSchema = z.object({
  symbol: symbolSchema,
  exchange: exchangeSchema,
  openInterest: z.number(),
  openInterestValue: z.number().optional(),
  timestamp: timestampSchema,
});

export const getOpenInterestQuerySchema = z.object({
  exchange: exchangeSchema.optional(),
  hours: z.coerce.number().int().positive().max(168).default(24),
});

/**
 * Order book snapshot schema (for historical data)
 */
export const orderBookSnapshotSchema = z.object({
  symbol: symbolSchema,
  exchange: exchangeSchema,
  timestamp: timestampSchema,
  spread: z.number(),
  spreadPercent: z.number(),
  bidDepth1Pct: z.number(),
  askDepth1Pct: z.number(),
  bidAskImbalance: z.number(),
  bestBid: priceSchema,
  bestAsk: priceSchema,
});

/**
 * Types
 */
export type Quote = z.infer<typeof quoteSchema>;
export type Candle = z.infer<typeof candleSchema>;
export type OrderBookLevel = z.infer<typeof orderBookLevelSchema>;
export type OrderBook = z.infer<typeof orderBookSchema>;
export type Trade = z.infer<typeof tradeSchema>;
export type AggregatedPrice = z.infer<typeof aggregatedPriceSchema>;
export type ArbitrageOpportunity = z.infer<typeof arbitrageOpportunitySchema>;
export type GetCandlesQuery = z.infer<typeof getCandlesQuerySchema>;
export type GetOrderBookQuery = z.infer<typeof getOrderBookQuerySchema>;
export type GetTradesQuery = z.infer<typeof getTradesQuerySchema>;
export type GetAggregatedQuery = z.infer<typeof getAggregatedQuerySchema>;
export type GetArbitrageQuery = z.infer<typeof getArbitrageQuerySchema>;
export type SubscribeSymbolsBody = z.infer<typeof subscribeSymbolsBodySchema>;
export type FundingRate = z.infer<typeof fundingRateSchema>;
export type GetFundingRateQuery = z.infer<typeof getFundingRateQuerySchema>;
export type OpenInterest = z.infer<typeof openInterestSchema>;
export type GetOpenInterestQuery = z.infer<typeof getOpenInterestQuerySchema>;
export type OrderBookSnapshot = z.infer<typeof orderBookSnapshotSchema>;
