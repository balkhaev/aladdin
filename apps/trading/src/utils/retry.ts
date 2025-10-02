/**
 * Retry utility with exponential backoff
 */

type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000; // 1 second
const DEFAULT_MAX_DELAY_MS = 10_000; // 10 seconds
const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    backoffMultiplier = DEFAULT_BACKOFF_MULTIPLIER,
    retryableErrors = [],
  } = options;

  let lastError: Error | undefined;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (retryableErrors.length > 0) {
        const isRetryable = retryableErrors.some((retryableError) =>
          lastError?.message.includes(retryableError)
        );

        if (!isRetryable) {
          throw lastError;
        }
      }

      // Don't retry if we've exhausted all attempts
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      await sleep(delayMs);

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new Error("Retry failed");
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is network-related and retryable
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const networkErrors = [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ENETUNREACH",
    "timeout",
    "network",
    "socket hang up",
  ];

  return networkErrors.some((networkError) =>
    error.message.toLowerCase().includes(networkError.toLowerCase())
  );
}

/**
 * Check if error is rate limit related
 */
export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const rateLimitErrors = [
    "rate limit",
    "too many requests",
    "429",
    "quota exceeded",
  ];

  return rateLimitErrors.some((rateLimitError) =>
    error.message.toLowerCase().includes(rateLimitError.toLowerCase())
  );
}
