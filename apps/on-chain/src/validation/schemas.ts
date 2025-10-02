import { z } from "zod";

/**
 * Validation schemas for On-Chain Service
 */

// ============ Constants ============

const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const MS_IN_DAY =
  HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SECOND;

// ============ Query Parameters ============

export const metricsQuerySchema = z.object({
  from: z
    .string()
    .optional()
    .transform((val) =>
      val ? new Date(val) : new Date(Date.now() - MS_IN_DAY)
    ),
  to: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .default("100")
    .transform((val) =>
      typeof val === "string" ? Number.parseInt(val, 10) : val
    ),
});

export const periodQuerySchema = z.object({
  from: z
    .string()
    .optional()
    .transform((val) =>
      val ? new Date(val) : new Date(Date.now() - MS_IN_DAY)
    ),
  to: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .default("100")
    .transform((val) =>
      typeof val === "string" ? Number.parseInt(val, 10) : val
    ),
});

export const blockchainParamSchema = z.object({
  blockchain: z
    .string()
    .toUpperCase()
    .refine((val) => ["BTC", "ETH"].includes(val), {
      message: "Blockchain must be BTC or ETH",
    }),
});

// ============ TypeScript Types ============

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type PeriodQuery = z.infer<typeof periodQuerySchema>;
export type BlockchainParam = z.infer<typeof blockchainParamSchema>;
