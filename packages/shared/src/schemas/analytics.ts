/**
 * Analytics validation schemas
 */

import { z } from "zod";
import {
  dateRangeSchema,
  portfolioIdSchema,
  symbolSchema,
  timeframeSchema,
} from "./common";

/**
 * Indicator types
 */
export const indicatorTypeSchema = z.enum([
  "SMA",
  "EMA",
  "RSI",
  "MACD",
  "BB",
  "STOCH",
  "ATR",
  "ADX",
  "OBV",
  "VWAP",
]);

/**
 * Get indicators query schema
 */
export const getIndicatorsQuerySchema = z.object({
  indicators: z
    .string()
    .transform((val) => val.split(","))
    .pipe(z.array(indicatorTypeSchema)),
  timeframe: timeframeSchema.default("1h"),
  limit: z.coerce.number().int().positive().max(1000).default(100),
});

/**
 * Statistics query schema
 */
export const getStatisticsQuerySchema = dateRangeSchema.extend({
  portfolioId: portfolioIdSchema.optional(),
});

/**
 * Backtest strategy schema
 */
export const backtestStrategySchema = z.object({
  symbol: symbolSchema,
  strategy: z.enum([
    "SMA_CROSSOVER",
    "RSI",
    "MACD",
    "BOLLINGER_BANDS",
    "CUSTOM",
  ]),
  from: z.coerce.date(),
  to: z.coerce.date(),
  initialBalance: z.number().positive().default(10_000),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Reports query schema
 */
export const getReportsQuerySchema = dateRangeSchema.extend({
  portfolioId: portfolioIdSchema,
  format: z.enum(["json", "csv"]).default("json"),
});

/**
 * Indicator value schema
 */
export const indicatorValueSchema = z.object({
  timestamp: z.number(),
  value: z.number().or(
    z.object({
      // Для индикаторов типа MACD или BB с несколькими значениями
      [z.string()]: z.number(),
    })
  ),
});

/**
 * Indicators response schema
 */
export const indicatorsResponseSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  indicators: z.record(indicatorTypeSchema, z.array(indicatorValueSchema)),
});

/**
 * Trading statistics schema
 */
export const tradingStatisticsSchema = z.object({
  totalTrades: z.number().int().nonnegative(),
  totalVolume: z.number().nonnegative(),
  totalPnL: z.number(),
  winRate: z.number().min(0).max(100),
  avgProfit: z.number(),
  avgLoss: z.number(),
  sharpeRatio: z.number(),
  maxDrawdown: z.number(),
  profitFactor: z.number().optional(),
  avgHoldingPeriod: z.number().optional(),
});

/**
 * Risk metrics schema
 */
export const riskMetricsSchema = z.object({
  var95: z.number(),
  var99: z.number(),
  sharpeRatio: z.number(),
  sortinoRatio: z.number().optional(),
  maxDrawdown: z.number(),
  maxDrawdownPercent: z.number(),
  volatility: z.number(),
  beta: z.number().optional(),
});

/**
 * Trade for report schema
 */
export const reportTradeSchema = z.object({
  timestamp: z.coerce.date(),
  symbol: symbolSchema,
  side: z.enum(["BUY", "SELL"]),
  price: z.number().positive(),
  quantity: z.number().positive(),
  pnl: z.number(),
});

/**
 * Report schema
 */
export const reportSchema = z.object({
  portfolioId: portfolioIdSchema,
  period: dateRangeSchema,
  statistics: tradingStatisticsSchema,
  riskMetrics: riskMetricsSchema,
  trades: z.array(reportTradeSchema),
  generatedAt: z.coerce.date(),
});

/**
 * Market overview schema
 */
export const marketOverviewSchema = z.object({
  topGainers: z.array(
    z.object({
      symbol: symbolSchema,
      price: z.number().positive(),
      change24h: z.number(),
      changePercent24h: z.number(),
      volume24h: z.number().nonnegative(),
    })
  ),
  topLosers: z.array(
    z.object({
      symbol: symbolSchema,
      price: z.number().positive(),
      change24h: z.number(),
      changePercent24h: z.number(),
      volume24h: z.number().nonnegative(),
    })
  ),
  marketStats: z.object({
    totalVolume24h: z.number().nonnegative(),
    avgVolatility: z.number().nonnegative(),
    marketCap: z.number().nonnegative().optional(),
  }),
});

/**
 * Advanced metrics schema
 */
export const advancedMetricsSchema = z.object({
  performance: z.object({
    totalReturn: z.number(),
    annualizedReturn: z.number(),
    sharpeRatio: z.number(),
    sortinoRatio: z.number(),
    calmarRatio: z.number(),
    omegaRatio: z.number(),
    informationRatio: z.number().optional(),
  }),
  trading: z.object({
    totalTrades: z.number().int().nonnegative(),
    winRate: z.number().min(0).max(100),
    profitFactor: z.number(),
    avgWin: z.number(),
    avgLoss: z.number(),
    largestWin: z.number(),
    largestLoss: z.number(),
    avgHoldingPeriod: z.number(),
  }),
  risk: z.object({
    maxDrawdown: z.number(),
    maxDrawdownPercent: z.number(),
    volatility: z.number(),
    downsideDeviation: z.number(),
    var95: z.number(),
    var99: z.number(),
    cvar95: z.number().optional(),
  }),
});

/**
 * Sentiment schema
 */
export const sentimentSchema = z.object({
  symbol: symbolSchema,
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  sources: z.object({
    technical: z.number().optional(),
    fundamental: z.number().optional(),
    social: z.number().optional(),
    news: z.number().optional(),
  }),
  timestamp: z.string(),
});

/**
 * Combined sentiment schema (technical + orderbook + funding rate)
 */
export const combinedSentimentSchema = z.object({
  symbol: symbolSchema,
  overall: z.number().min(-1).max(1),
  technical: z.object({
    score: z.number().min(-1).max(1),
    signals: z.record(z.string(), z.number()),
  }),
  orderbook: z.object({
    bidAskImbalance: z.number(),
    buyPressure: z.number(),
    sellPressure: z.number(),
  }),
  futures: z.object({
    fundingRate: z.number(),
    openInterest: z.number(),
    longShortRatio: z.number().optional(),
  }),
  confidence: z.number().min(0).max(1),
  timestamp: z.string(),
});

/**
 * Social sentiment schema
 */
export const socialSentimentSchema = z.object({
  symbol: symbolSchema,
  overall: z.number().min(-1).max(1),
  telegram: z.object({
    score: z.number().min(-1).max(1),
    bullish: z.number().nonnegative(),
    bearish: z.number().nonnegative(),
    signals: z.number().nonnegative(),
  }),
  twitter: z.object({
    score: z.number().min(-1).max(1),
    positive: z.number().nonnegative(),
    negative: z.number().nonnegative(),
    neutral: z.number().nonnegative(),
    tweets: z.number().nonnegative(),
  }),
  reddit: z
    .object({
      score: z.number().min(-1).max(1),
      posts: z.number().nonnegative(),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
  timestamp: z.string(),
});

/**
 * Batch sentiment analysis
 */
export const batchSentimentRequestSchema = z.object({
  symbols: z.array(symbolSchema).min(1).max(50),
});

/**
 * Types
 */
export type IndicatorType = z.infer<typeof indicatorTypeSchema>;
export type GetIndicatorsQuery = z.infer<typeof getIndicatorsQuerySchema>;
export type GetStatisticsQuery = z.infer<typeof getStatisticsQuerySchema>;
export type BacktestStrategy = z.infer<typeof backtestStrategySchema>;
export type GetReportsQuery = z.infer<typeof getReportsQuerySchema>;
export type IndicatorValue = z.infer<typeof indicatorValueSchema>;
export type IndicatorsResponse = z.infer<typeof indicatorsResponseSchema>;
export type TradingStatistics = z.infer<typeof tradingStatisticsSchema>;
export type RiskMetrics = z.infer<typeof riskMetricsSchema>;
export type ReportTrade = z.infer<typeof reportTradeSchema>;
export type Report = z.infer<typeof reportSchema>;
export type MarketOverview = z.infer<typeof marketOverviewSchema>;
export type AdvancedMetrics = z.infer<typeof advancedMetricsSchema>;
export type Sentiment = z.infer<typeof sentimentSchema>;
export type CombinedSentiment = z.infer<typeof combinedSentimentSchema>;
export type SocialSentiment = z.infer<typeof socialSentimentSchema>;
export type BatchSentimentRequest = z.infer<typeof batchSentimentRequestSchema>;
