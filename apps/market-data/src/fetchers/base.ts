import type { Logger } from "@aladdin/shared/logger";
import type { BlockchainFetcher, RateLimitConfig, RetryConfig } from "./types";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Base class for blockchain data fetchers with rate limiting and retry logic
 */
export abstract class BaseFetcher implements BlockchainFetcher {
  protected logger: Logger;
  protected blockchain: string;
  private rateLimitConfig: RateLimitConfig;
  private retryConfig: RetryConfig;
  private requestTimestamps: number[] = [];

  constructor(
    blockchain: string,
    logger: Logger,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.blockchain = blockchain;
    this.logger = logger;
    this.rateLimitConfig = {
      maxRequests: rateLimitConfig?.maxRequests ?? DEFAULT_MAX_REQUESTS,
      windowMs: rateLimitConfig?.windowMs ?? DEFAULT_WINDOW_MS,
    };
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? DEFAULT_MAX_RETRIES,
      initialDelayMs: retryConfig?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS,
      maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    };
  }

  /**
   * Rate-limited fetch with retry logic
   */
  protected async fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        // Wait for rate limit
        await this.waitForRateLimit();

        // Execute fetch
        const result = await fetchFn();

        // Record successful request
        this.recordRequest();

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `${operationName} failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1})`,
          { error: lastError.message }
        );

        // Don't wait after last attempt
        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.initialDelayMs * 2 ** attempt,
            this.retryConfig.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error(`${operationName} failed after all retries`);
  }

  /**
   * Wait if we've hit rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;

    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > windowStart
    );

    // Check if we've hit the limit
    if (this.requestTimestamps.length >= this.rateLimitConfig.maxRequests) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = oldestRequest + this.rateLimitConfig.windowMs - now;

      if (waitTime > 0) {
        this.logger.debug(
          `Rate limit reached, waiting ${waitTime}ms for ${this.blockchain}`
        );
        await this.sleep(waitTime);
      }
    }
  }

  /**
   * Record a request timestamp
   */
  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getBlockchain(): string {
    return this.blockchain;
  }

  // Abstract methods to be implemented by subclasses
  abstract fetchWhaleTransactions(threshold: number): Promise<
    Array<{
      transactionHash: string;
      timestamp: number;
      from: string;
      to: string;
      value: number;
      blockchain: string;
    }>
  >;

  abstract fetchExchangeFlows(): Promise<{
    inflow: number;
    outflow: number;
    netFlow: number;
  }>;

  abstract fetchActiveAddresses(period?: string): Promise<number>;

  abstract fetchNVTRatio(): Promise<number>;

  abstract fetchMarketCap(): Promise<number | undefined>;

  abstract fetchTransactionVolume(): Promise<number>;

  abstract fetchMetrics(): Promise<{
    timestamp: number;
    blockchain: string;
    whaleTransactions: {
      count: number;
      totalVolume: number;
    };
    exchangeFlow: {
      inflow: number;
      outflow: number;
      netFlow: number;
    };
    activeAddresses: number;
    nvtRatio: number;
    marketCap?: number;
    transactionVolume: number;
  }>;
}
