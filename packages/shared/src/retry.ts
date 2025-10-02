import type { Logger } from "./logger";

/**
 * Retry Options
 */
export interface RetryOptions {
  /**
   * Максимальное количество попыток
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Начальная задержка между попытками (мс)
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Множитель для exponential backoff
   * @default 2
   */
  multiplier?: number;

  /**
   * Максимальная задержка между попытками (мс)
   * @default 30000
   */
  maxDelay?: number;

  /**
   * Добавить случайное отклонение (jitter) для избежания thundering herd
   * @default true
   */
  jitter?: boolean;

  /**
   * Функция проверки, нужно ли повторять запрос при ошибке
   * @default (error) => true
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * Таймаут для каждой попытки (мс)
   * @default undefined (без таймаута)
   */
  timeout?: number;

  /**
   * Функция вызываемая перед каждой повторной попыткой
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;

  /**
   * Logger для отслеживания
   */
  logger?: Logger;
}

/**
 * Retry Result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalDelay: number;
}

/**
 * Retry Error
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: unknown
  ) {
    super(message);
    this.name = "RetryError";
  }
}

/**
 * Выполнить функцию с retry логикой и exponential backoff
 *
 * @param fn - Функция для выполнения
 * @param options - Опции retry
 * @returns Результат выполнения функции
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     const response = await fetch('http://api.example.com/data');
 *     if (!response.ok) throw new Error('API error');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 5,
 *     initialDelay: 1000,
 *     multiplier: 2,
 *     maxDelay: 30000,
 *     shouldRetry: (error, attempt) => {
 *       // Не повторять при 4xx ошибках
 *       if (error instanceof Response && error.status >= 400 && error.status < 500) {
 *         return false;
 *       }
 *       return true;
 *     }
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    multiplier = 2,
    maxDelay = 30_000,
    jitter = true,
    shouldRetry = () => true,
    timeout,
    onRetry,
    logger,
  } = options;

  let attempt = 0;
  let totalDelay = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt++;

    try {
      // Выполняем функцию с опциональным таймаутом
      const result = timeout
        ? await executeWithTimeout(fn, timeout)
        : await fn();

      if (attempt > 1) {
        logger?.info("Retry succeeded", {
          attempt,
          totalDelay,
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      // Проверяем, нужно ли повторять
      if (!shouldRetry(error, attempt) || attempt >= maxAttempts) {
        logger?.error("Retry failed, giving up", error, {
          attempt,
          maxAttempts,
          totalDelay,
        });

        throw new RetryError(
          `Failed after ${attempt} attempts`,
          attempt,
          error
        );
      }

      // Вычисляем задержку с exponential backoff
      const delay = calculateDelay(
        initialDelay,
        multiplier,
        maxDelay,
        attempt,
        jitter
      );

      totalDelay += delay;

      logger?.warn("Retry attempt failed, will retry", {
        attempt,
        maxAttempts,
        delay,
        totalDelay,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : error,
      });

      // Callback перед повторной попыткой
      onRetry?.(error, attempt, delay);

      // Ждем перед следующей попыткой
      await sleep(delay);
    }
  }

  throw new RetryError(`Failed after ${attempt} attempts`, attempt, lastError);
}

/**
 * Выполнить функцию с таймаутом
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Вычислить задержку с exponential backoff
 */
function calculateDelay(
  initialDelay: number,
  multiplier: number,
  maxDelay: number,
  attempt: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * multiplier^(attempt - 1)
  let delay = initialDelay * multiplier ** (attempt - 1);

  // Ограничить максимальной задержкой
  delay = Math.min(delay, maxDelay);

  // Добавить jitter (случайное отклонение ±25%)
  if (jitter) {
    const jitterFactor = 0.25;
    const randomFactor = 1 + (Math.random() * 2 - 1) * jitterFactor;
    delay = Math.floor(delay * randomFactor);
  }

  return delay;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry с Circuit Breaker
 * Комбинирует retry логику с circuit breaker
 *
 * @param fn - Функция для выполнения
 * @param retryOptions - Опции retry
 * @param circuitBreaker - Circuit breaker instance
 * @returns Результат выполнения
 *
 * @example
 * ```typescript
 * import { CircuitBreaker } from './circuit-breaker';
 *
 * const breaker = new CircuitBreaker({
 *   timeout: 5000,
 *   errorThresholdPercentage: 50,
 *   name: 'my-service',
 * });
 *
 * const result = await retryWithCircuitBreaker(
 *   async () => await fetchData(),
 *   { maxAttempts: 3, initialDelay: 1000 },
 *   breaker
 * );
 * ```
 */
export async function retryWithCircuitBreaker<T>(
  fn: () => Promise<T>,
  retryOptions: RetryOptions,
  circuitBreaker: { execute: <T>(fn: () => Promise<T>) => Promise<T> }
): Promise<T> {
  return retry(async () => circuitBreaker.execute(fn), retryOptions);
}

/**
 * Batch Retry
 * Повторяет несколько операций с retry логикой
 *
 * @param operations - Массив функций для выполнения
 * @param options - Опции retry
 * @returns Массив результатов
 *
 * @example
 * ```typescript
 * const results = await batchRetry([
 *   () => fetch('http://api1.com/data'),
 *   () => fetch('http://api2.com/data'),
 *   () => fetch('http://api3.com/data'),
 * ], { maxAttempts: 3 });
 * ```
 */
export async function batchRetry<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  const results = await Promise.allSettled(
    operations.map(async (op, index) => {
      const startTime = Date.now();
      let attempts = 0;

      try {
        const result = await retry(op, {
          ...options,
          onRetry: (error, attempt, delay) => {
            attempts = attempt;
            options.onRetry?.(error, attempt, delay);
          },
        });

        return {
          success: true,
          result,
          attempts: attempts + 1,
          totalDelay: Date.now() - startTime,
        };
      } catch (error) {
        return {
          success: false,
          error,
          attempts: options.maxAttempts ?? 3,
          totalDelay: Date.now() - startTime,
        };
      }
    })
  );

  return results.map((result) =>
    result.status === "fulfilled" ? result.value : result.reason
  );
}

/**
 * Retry decorator для методов класса
 *
 * @example
 * ```typescript
 * class MyService {
 *   @Retry({ maxAttempts: 3, initialDelay: 1000 })
 *   async fetchData() {
 *     return await fetch('http://api.example.com/data');
 *   }
 * }
 * ```
 */
export function Retry(options: RetryOptions = {}) {
  return (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return retry(async () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Проверка, является ли ошибка retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes("ECONNREFUSED")) return true;
    if (error.message.includes("ETIMEDOUT")) return true;
    if (error.message.includes("ENOTFOUND")) return true;
    if (error.message.includes("timeout")) return true;

    // HTTP errors (5xx)
    if ("status" in error) {
      const status = (error as { status: number }).status;
      return status >= 500 && status < 600;
    }
  }

  return false;
}

/**
 * Создать shouldRetry функцию для HTTP запросов
 */
export function createHttpRetryPolicy(
  retryOn5xx = true,
  retryOn429 = true
): (error: unknown) => boolean {
  return (error: unknown) => {
    if (error instanceof Response) {
      // Retry на server errors (5xx)
      if (retryOn5xx && error.status >= 500 && error.status < 600) {
        return true;
      }

      // Retry на rate limit (429)
      if (retryOn429 && error.status === 429) {
        return true;
      }

      return false;
    }

    // Retry на network errors
    return isRetryableError(error);
  };
}
