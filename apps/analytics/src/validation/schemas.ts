import { z } from "zod";

/**
 * Схемы валидации для Analytics Service
 */

// ============ Constants ============

const DAYS_IN_MONTH = 30;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const DEFAULT_INITIAL_BALANCE = 10_000;

// ============ Query Parameters ============

export const indicatorsQuerySchema = z.object({
  indicators: z
    .string()
    .optional()
    .default("RSI,MACD")
    .transform((val) =>
      val
        .split(",")
        .map((i) => i.trim().toUpperCase())
        .filter((i) => ["RSI", "MACD", "EMA", "SMA", "BB"].includes(i))
    ),
  timeframe: z.string().optional().default("1h"),
  limit: z
    .string()
    .optional()
    .default("100")
    .transform((val) => Number.parseInt(val, 10)),
});

export const candlesQuerySchema = z.object({
  timeframe: z.string().optional().default("1h"),
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

export const statisticsQuerySchema = z.object({
  from: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? new Date(val)
        : new Date(
            Date.now() -
              DAYS_IN_MONTH *
                HOURS_IN_DAY *
                MINUTES_IN_HOUR *
                SECONDS_IN_MINUTE *
                MS_IN_SECOND
          )
    ),
  to: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  portfolioId: z.string().optional(),
});

export const backtestQuerySchema = z.object({
  from: z.string().transform((val) => new Date(val)),
  to: z.string().transform((val) => new Date(val)),
  initialBalance: z
    .string()
    .optional()
    .default("10000")
    .transform((val) => Number.parseFloat(val)),
});

export const reportsQuerySchema = z.object({
  portfolioId: z.string().min(1, "Portfolio ID is required"),
  from: z.string().transform((val) => new Date(val)),
  to: z.string().transform((val) => new Date(val)),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

// ============ Request Bodies ============

export const backtestStrategySchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((val) => val.toUpperCase()),
  strategy: z.enum(["SMA_CROSS", "RSI_OVERSOLD", "MACD_CROSS", "BB_BOUNCE"], {
    message: "Invalid strategy",
  }),
  parameters: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional(),
  from: z.string().transform((val) => new Date(val)),
  to: z.string().transform((val) => new Date(val)),
  initialBalance: z
    .number()
    .positive("Initial balance must be positive")
    .default(DEFAULT_INITIAL_BALANCE),
});

// ============ TypeScript Types ============

export type IndicatorsQuery = z.infer<typeof indicatorsQuerySchema>;
export type CandlesQuery = z.infer<typeof candlesQuerySchema>;
export type StatisticsQuery = z.infer<typeof statisticsQuerySchema>;
export type BacktestQuery = z.infer<typeof backtestQuerySchema>;
export type BacktestStrategy = z.infer<typeof backtestStrategySchema>;
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
