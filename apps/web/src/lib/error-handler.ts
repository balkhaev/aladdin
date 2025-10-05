/**
 * Error handling utilities
 * Centralized error handling with toast notifications
 */

import type { ToastType } from "@/components/ui/use-toast";
import { logger } from "./logger";

type ErrorHandlerOptions = {
  showToast?: boolean;
  logError?: boolean;
  context?: string;
};

/**
 * API Error with structured information
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * WebSocket Error with structured information
 */
export class WebSocketError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "WebSocketError";
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unknown error occurred";
}

/**
 * Handle error with optional toast notification
 */
export function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): string {
  const { logError = true, context = "Error" } = options;

  const message = getErrorMessage(error);

  if (logError) {
    logger.error(context, message, error);
  }

  return message;
}

/**
 * Create toast configuration for error
 */
export function createErrorToast(
  error: unknown,
  defaultTitle = "Error"
): { title: string; description: string; variant: ToastType } {
  const message = getErrorMessage(error);

  return {
    title: defaultTitle,
    description: message,
    variant: "destructive" as ToastType,
  };
}

/**
 * Create toast configuration for success
 */
export function createSuccessToast(
  title: string,
  description?: string
): { title: string; description?: string; variant?: ToastType } {
  return {
    title,
    description,
  };
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("fetch")
    );
  }
  return false;
}

/**
 * Check if error is an authentication error
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 401 || error.statusCode === 403;
  }
  return false;
}

/**
 * Retry logic for failed requests
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = initialDelay * 2 ** attempt;
        logger.warn(
          "Retry",
          `Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

