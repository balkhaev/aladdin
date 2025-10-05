/**
 * Validation middleware for request validation using Zod
 */

import {
  createErrorResponse,
  ErrorCode,
  HTTP_STATUS,
} from "@aladdin/http/responses";
import type { Context, Next } from "hono";
import { ZodError, type z } from "zod";

/**
 * Middleware to validate request body
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);

      // Store validated data in context
      c.set("validatedBody", validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return c.json(
          createErrorResponse(ErrorCode.VALIDATION_ERROR, "Validation failed", {
            errors: formattedErrors,
          }),
          HTTP_STATUS.BAD_REQUEST
        );
      }

      return c.json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Invalid request body",
          undefined
        ),
        HTTP_STATUS.BAD_REQUEST
      );
    }
  };
}

/**
 * Middleware to validate query parameters
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();

      // Convert numeric strings to numbers for proper validation
      const parsedQuery: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(query)) {
        // Try to parse as number if it looks like a number
        const numValue = Number(value);
        if (!Number.isNaN(numValue) && value !== "") {
          parsedQuery[key] = numValue;
        } else {
          parsedQuery[key] = value;
        }
      }

      const validated = schema.parse(parsedQuery);

      // Store validated data in context
      c.set("validatedQuery", validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return c.json(
          createErrorResponse(ErrorCode.VALIDATION_ERROR, "Validation failed", {
            errors: formattedErrors,
          }),
          HTTP_STATUS.BAD_REQUEST
        );
      }

      return c.json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Invalid query parameters",
          undefined
        ),
        HTTP_STATUS.BAD_REQUEST
      );
    }
  };
}

/**
 * Middleware to validate route parameters
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);

      // Store validated data in context
      c.set("validatedParams", validated);

      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return c.json(
          createErrorResponse(ErrorCode.VALIDATION_ERROR, "Validation failed", {
            errors: formattedErrors,
          }),
          HTTP_STATUS.BAD_REQUEST
        );
      }

      return c.json(
        createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Invalid route parameters",
          undefined
        ),
        HTTP_STATUS.BAD_REQUEST
      );
    }
  };
}

/**
 * Type helpers for accessing validated data from context
 */
declare module "hono" {
  // biome-ignore lint/nursery/useConsistentTypeDefinitions: module augmentation requires interface, not type
  interface ContextVariableMap {
    validatedBody: unknown;
    validatedQuery: unknown;
    validatedParams: unknown;
  }
}
