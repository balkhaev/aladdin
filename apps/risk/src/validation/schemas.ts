import { z } from "zod";

/**
 * Схемы валидации для Risk Management Service
 */

// ============ Constants ============

const CONFIDENCE_LEVEL_95 = 95;
const CONFIDENCE_LEVEL_99 = 99;
const PERCENT_MULTIPLIER = 100;

// ============ Query Parameters ============

export const varQuerySchema = z.object({
  portfolioId: z.string().min(1, "Portfolio ID is required"),
  confidenceLevel: z
    .union([z.string(), z.number()])
    .optional()
    .default("95")
    .transform((val) => {
      // Support both formats: "95", "99" and "0.95", "0.99" (string or number)
      const num =
        typeof val === "string" ? Number.parseFloat(val) : Number(val);
      if (num >= 0 && num < 1) {
        return Math.round(num * PERCENT_MULTIPLIER);
      }
      return Math.round(num);
    })
    .refine(
      (val) => val === CONFIDENCE_LEVEL_95 || val === CONFIDENCE_LEVEL_99,
      {
        message: "Confidence level must be 95 or 99 (or 0.95/0.99)",
      }
    ),
  timeHorizon: z
    .union([z.string(), z.number()])
    .optional()
    .default("30")
    .transform((val) =>
      typeof val === "string" ? Number.parseInt(val, 10) : Number(val)
    ),
});

export const exposureQuerySchema = z.object({
  portfolioId: z.string().min(1, "Portfolio ID is required"),
  includePositions: z
    .string()
    .optional()
    .default("true")
    .transform((val) => val.toLowerCase() === "true"),
});

export const limitsQuerySchema = z.object({
  portfolioId: z.string().optional(),
  enabled: z
    .string()
    .optional()
    .transform((val) => val?.toLowerCase() === "true"),
});

// ============ Request Bodies ============

export const checkOrderRiskSchema = z.object({
  portfolioId: z.string().min(1, "Portfolio ID is required"),
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .transform((val) => val.toUpperCase()),
  side: z.enum(["BUY", "SELL"], {
    errorMap: () => ({ message: "Side must be BUY or SELL" }),
  }),
  quantity: z.number().positive("Quantity must be positive"),
  price: z.number().positive("Price must be positive"),
});

export const createLimitSchema = z.object({
  portfolioId: z.string().optional(),
  type: z.enum(
    ["MAX_LEVERAGE", "MAX_POSITION_SIZE", "MAX_DAILY_LOSS", "MIN_MARGIN"],
    {
      errorMap: () => ({ message: "Invalid limit type" }),
    }
  ),
  value: z.number().positive("Limit value must be positive"),
  enabled: z.boolean().optional().default(true),
});

export const updateLimitSchema = z.object({
  value: z.number().positive("Limit value must be positive").optional(),
  enabled: z.boolean().optional(),
});

// ============ TypeScript Types ============

export type VarQuery = z.infer<typeof varQuerySchema>;
export type ExposureQuery = z.infer<typeof exposureQuerySchema>;
export type LimitsQuery = z.infer<typeof limitsQuerySchema>;
export type CheckOrderRisk = z.infer<typeof checkOrderRiskSchema>;
export type CreateLimit = z.infer<typeof createLimitSchema>;
export type UpdateLimit = z.infer<typeof updateLimitSchema>;
