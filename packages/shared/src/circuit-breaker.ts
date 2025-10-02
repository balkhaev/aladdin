import type { Logger } from "./logger";

/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = "CLOSED", // Нормальная работа
  OPEN = "OPEN", // Circuit открыт, запросы не проходят
  HALF_OPEN = "HALF_OPEN", // Тестовый режим после восстановления
}

/**
 * Circuit Breaker Options
 */
export interface CircuitBreakerOptions {
  /**
   * Таймаут запроса в миллисекундах
   * @default 3000
   */
  timeout?: number;

  /**
   * Порог ошибок для открытия circuit (%)
   * @default 50
   */
  errorThresholdPercentage?: number;

  /**
   * Минимальное количество запросов для расчета процента
   * @default 10
   */
  minimumRequests?: number;

  /**
   * Время в миллисекундах перед попыткой восстановления
   * @default 30000
   */
  resetTimeout?: number;

  /**
   * Количество успешных запросов в HALF_OPEN для закрытия circuit
   * @default 3
   */
  successThreshold?: number;

  /**
   * Название circuit для логирования
   */
  name?: string;

  /**
   * Logger для отслеживания событий
   */
  logger?: Logger;

  /**
   * Fallback функция при открытом circuit
   */
  fallback?: <T>() => T | Promise<T>;
}

/**
 * Circuit Breaker Statistics
 */
interface CircuitStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public circuitName: string,
    public state: CircuitState
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit Breaker Implementation
 *
 * Защищает систему от каскадных отказов, останавливая запросы
 * к неработающему сервису.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   timeout: 3000,
 *   errorThresholdPercentage: 50,
 *   resetTimeout: 30000,
 *   name: 'portfolio-service',
 *   logger: logger,
 *   fallback: () => ({ cached: true, data: [] })
 * });
 *
 * const result = await breaker.execute(async () => {
 *   return await fetch('http://localhost:3012/api/portfolio/positions');
 * });
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private stats: CircuitStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastFailureTime: null,
    lastSuccessTime: null,
  };
  private resetTimer: NodeJS.Timeout | null = null;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 3000,
      errorThresholdPercentage: options.errorThresholdPercentage ?? 50,
      minimumRequests: options.minimumRequests ?? 10,
      resetTimeout: options.resetTimeout ?? 30_000,
      successThreshold: options.successThreshold ?? 3,
      name: options.name ?? "unnamed-circuit",
      logger: options.logger ?? undefined,
      fallback:
        options.fallback ??
        (() => {
          throw new CircuitBreakerError(
            "Circuit breaker is open and no fallback provided",
            this.options.name,
            this.state
          );
        }),
    } as Required<CircuitBreakerOptions>;
  }

  /**
   * Выполнить функцию через circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Проверяем состояние circuit
    if (this.state === CircuitState.OPEN) {
      this.options.logger?.warn("Circuit breaker is open, using fallback", {
        circuit: this.options.name,
        stats: this.getStats(),
      });

      return this.options.fallback<T>();
    }

    try {
      // Выполняем функцию с таймаутом
      const result = await this.executeWithTimeout(fn);

      // Успешное выполнение
      this.onSuccess();

      return result;
    } catch (error) {
      // Ошибка выполнения
      this.onFailure(error);

      throw error;
    }
  }

  /**
   * Выполнить функцию с таймаутом
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Request timeout after ${this.options.timeout}ms in circuit ${this.options.name}`
          )
        );
      }, this.options.timeout);

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
   * Обработка успешного запроса
   */
  private onSuccess(): void {
    this.stats.totalRequests++;
    this.stats.successfulRequests++;
    this.stats.consecutiveSuccesses++;
    this.stats.consecutiveFailures = 0;
    this.stats.lastSuccessTime = Date.now();

    // Если в HALF_OPEN и достигли порога успехов, закрываем circuit
    if (
      this.state === CircuitState.HALF_OPEN &&
      this.stats.consecutiveSuccesses >= this.options.successThreshold
    ) {
      this.closeCircuit();
    }
  }

  /**
   * Обработка неудачного запроса
   */
  private onFailure(error: unknown): void {
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    this.stats.consecutiveFailures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();

    this.options.logger?.error("Circuit breaker request failed", error, {
      circuit: this.options.name,
      state: this.state,
      stats: this.getStats(),
    });

    // Проверяем, нужно ли открыть circuit
    if (this.shouldOpenCircuit()) {
      this.openCircuit();
    }
  }

  /**
   * Проверить, нужно ли открыть circuit
   */
  private shouldOpenCircuit(): boolean {
    // Недостаточно запросов для расчета
    if (this.stats.totalRequests < this.options.minimumRequests) {
      return false;
    }

    // Вычисляем процент ошибок
    const errorPercentage =
      (this.stats.failedRequests / this.stats.totalRequests) * 100;

    return errorPercentage >= this.options.errorThresholdPercentage;
  }

  /**
   * Открыть circuit (перестать пропускать запросы)
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;

    this.options.logger?.error("Circuit breaker opened", undefined, {
      circuit: this.options.name,
      stats: this.getStats(),
    });

    // Запланировать переход в HALF_OPEN
    this.scheduleReset();
  }

  /**
   * Закрыть circuit (восстановить нормальную работу)
   */
  private closeCircuit(): void {
    this.state = CircuitState.CLOSED;

    // Сбросить статистику
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureTime: this.stats.lastFailureTime,
      lastSuccessTime: this.stats.lastSuccessTime,
    };

    this.options.logger?.info("Circuit breaker closed", {
      circuit: this.options.name,
    });

    // Отменить таймер сброса
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Запланировать переход в HALF_OPEN
   */
  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.state = CircuitState.HALF_OPEN;
      this.stats.consecutiveSuccesses = 0;

      this.options.logger?.info("Circuit breaker transitioned to HALF_OPEN", {
        circuit: this.options.name,
      });
    }, this.options.resetTimeout);
  }

  /**
   * Получить текущее состояние
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Получить статистику
   */
  getStats(): CircuitStats {
    return { ...this.stats };
  }

  /**
   * Принудительно открыть circuit
   */
  forceOpen(): void {
    this.openCircuit();
  }

  /**
   * Принудительно закрыть circuit
   */
  forceClose(): void {
    this.closeCircuit();
  }

  /**
   * Сбросить статистику
   */
  reset(): void {
    this.closeCircuit();
  }
}

/**
 * Circuit Breaker Manager
 * Управляет множеством circuit breakers
 */
export class CircuitBreakerManager {
  private circuits = new Map<string, CircuitBreaker>();
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * Создать или получить circuit breaker
   */
  getCircuit(
    name: string,
    options?: Omit<CircuitBreakerOptions, "name">
  ): CircuitBreaker {
    if (!this.circuits.has(name)) {
      this.circuits.set(
        name,
        new CircuitBreaker({
          ...options,
          name,
          logger: this.logger,
        })
      );
    }

    return this.circuits.get(name)!;
  }

  /**
   * Получить все circuit breakers
   */
  getAllCircuits(): Map<string, CircuitBreaker> {
    return this.circuits;
  }

  /**
   * Получить статистику всех circuits
   */
  getAllStats(): Record<string, CircuitStats & { state: CircuitState }> {
    const stats: Record<string, CircuitStats & { state: CircuitState }> = {};

    for (const [name, circuit] of this.circuits) {
      stats[name] = {
        ...circuit.getStats(),
        state: circuit.getState(),
      };
    }

    return stats;
  }

  /**
   * Сбросить все circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }
}
