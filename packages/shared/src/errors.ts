/**
 * Centralized error handling for all services
 */

import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { createErrorResponse, ErrorCode, HTTP_STATUS } from "./http";
import type { Logger } from "./logger";

// Re-export ErrorCode for convenience
export { ErrorCode } from "./http";

/**
 * Base application error
 */
export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_ERROR,
    details?: unknown
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      ErrorCode.VALIDATION_ERROR,
      message,
      HTTP_STATUS.BAD_REQUEST,
      details
    );
    this.name = "ValidationError";
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(ErrorCode.NOT_FOUND, message, HTTP_STATUS.NOT_FOUND);
    this.name = "NotFoundError";
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(ErrorCode.UNAUTHORIZED, message, HTTP_STATUS.UNAUTHORIZED);
    this.name = "UnauthorizedError";
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(ErrorCode.FORBIDDEN, message, HTTP_STATUS.FORBIDDEN);
    this.name = "ForbiddenError";
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCode.CONFLICT, message, HTTP_STATUS.CONFLICT);
    this.name = "ConflictError";
  }
}

/**
 * Business logic error (422)
 */
export class BusinessError extends AppError {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HTTP_STATUS.UNPROCESSABLE_ENTITY, details);
    this.name = "BusinessError";
  }
}

/**
 * Internal server error (500)
 */
export class InternalServerError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      ErrorCode.INTERNAL_ERROR,
      message,
      HTTP_STATUS.INTERNAL_ERROR,
      details
    );
    this.name = "InternalServerError";
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(
      ErrorCode.EXCHANGE_API_ERROR,
      `${service} error: ${message}`,
      HTTP_STATUS.BAD_GATEWAY,
      details
    );
    this.name = "ExternalServiceError";
  }
}

/**
 * Database error (500)
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super(
      ErrorCode.DATABASE_ERROR,
      message,
      HTTP_STATUS.INTERNAL_ERROR,
      details
    );
    this.name = "DatabaseError";
  }
}

const INTERNAL_ERROR_STATUS_CODE = 500;

/**
 * Convert error to standardized format
 */
function normalizeError(error: unknown): {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
} {
  // AppError and its subclasses
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  // Hono HTTPException
  if (error instanceof HTTPException) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: error.message,
      statusCode: error.status,
      details: error.cause,
    };
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((err) => ({
      path: err.path.join("."),
      message: err.message,
      code: err.code,
    }));

    return {
      code: ErrorCode.VALIDATION_ERROR,
      message: "Validation failed",
      statusCode: HTTP_STATUS.BAD_REQUEST,
      details: { errors: formattedErrors },
    };
  }

  // Standard Error
  if (error instanceof Error) {
    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message,
      statusCode: HTTP_STATUS.INTERNAL_ERROR,
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  // Unknown error
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: "An unexpected error occurred",
    statusCode: HTTP_STATUS.INTERNAL_ERROR,
    details: process.env.NODE_ENV === "development" ? error : undefined,
  };
}

const HTTP_OK_STATUS = 200;

/**
 * Error handler middleware for Hono
 */
export function errorHandlerMiddleware(
  logger?: Logger
): (c: Context, next: Next) => Promise<Response | undefined> {
  return async (c: Context, next: Next) => {
    try {
      await next();
    } catch (error) {
      const normalized = normalizeError(error);

      // Log error
      if (logger) {
        if (normalized.statusCode >= INTERNAL_ERROR_STATUS_CODE) {
          logger.error(normalized.message, error, {
            code: normalized.code,
            path: c.req.path,
            method: c.req.method,
            details: normalized.details,
          });
        } else {
          logger.warn(normalized.message, {
            code: normalized.code,
            path: c.req.path,
            method: c.req.method,
            statusCode: normalized.statusCode,
          });
        }
      }

      // Return error response
      const response = createErrorResponse(
        normalized.code,
        normalized.message,
        normalized.details
      );

      // Type assertion needed because statusCode might be any HTTP code
      return c.json(response, normalized.statusCode as typeof HTTP_OK_STATUS);
    }
  };
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handler
 */
export function asyncHandler(
  handler: (c: Context) => Promise<Response>
): (c: Context) => Promise<Response> {
  return async (c: Context) => await handler(c); // Errors will be caught by errorHandlerMiddleware
}
