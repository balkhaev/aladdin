/**
 * HTTP utilities and constants for standardized API responses
 */

import type { ApiResponse } from "@aladdin/core";

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/**
 * Standardized error codes
 */
export const ErrorCode = {
  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",

  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Business logic errors
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  ORDER_LIMIT_EXCEEDED: "ORDER_LIMIT_EXCEEDED",
  POSITION_LIMIT_EXCEEDED: "POSITION_LIMIT_EXCEEDED",
  RISK_LIMIT_EXCEEDED: "RISK_LIMIT_EXCEEDED",

  // Trading errors
  CREATE_ORDER_ERROR: "CREATE_ORDER_ERROR",
  CANCEL_ORDER_ERROR: "CANCEL_ORDER_ERROR",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  INVALID_ORDER_STATUS: "INVALID_ORDER_STATUS",

  // Portfolio errors
  PORTFOLIO_NOT_FOUND: "PORTFOLIO_NOT_FOUND",
  CREATE_PORTFOLIO_ERROR: "CREATE_PORTFOLIO_ERROR",
  UPDATE_PRICES_ERROR: "UPDATE_PRICES_ERROR",
  IMPORT_POSITIONS_ERROR: "IMPORT_POSITIONS_ERROR",

  // Market data errors
  SYMBOL_NOT_FOUND: "SYMBOL_NOT_FOUND",
  QUOTE_NOT_FOUND: "QUOTE_NOT_FOUND",
  SUBSCRIBE_ERROR: "SUBSCRIBE_ERROR",
  AGGREGATION_ERROR: "AGGREGATION_ERROR",
  ARBITRAGE_ERROR: "ARBITRAGE_ERROR",

  // Analytics errors
  INDICATORS_ERROR: "INDICATORS_ERROR",
  BACKTEST_ERROR: "BACKTEST_ERROR",
  STATISTICS_ERROR: "STATISTICS_ERROR",
  REPORT_ERROR: "REPORT_ERROR",

  // Risk errors
  RISK_CHECK_FAILED: "RISK_CHECK_FAILED",
  VAR_CALCULATION_ERROR: "VAR_CALCULATION_ERROR",
  EXPOSURE_ERROR: "EXPOSURE_ERROR",

  // External service errors
  EXCHANGE_API_ERROR: "EXCHANGE_API_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  NATS_ERROR: "NATS_ERROR",
  CLICKHOUSE_ERROR: "CLICKHOUSE_ERROR",

  // Generic errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Create a success response
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: ErrorCode | string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    timestamp: Date.now(),
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return createSuccessResponse({
    items,
    total,
    page,
    pageSize,
    hasNext: page * pageSize < total,
  });
}
