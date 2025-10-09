import type { Logger } from "@aladdin/logger";
import Redis, { type RedisOptions } from "ioredis";

/**
 * Cache Options
 */
export type CacheOptions = {
  /**
   * Redis connection string or options
   */
  redis?: string | RedisOptions;

  /**
   * Default TTL in seconds
   * @default 60
   */
  defaultTTL?: number;

  /**
   * Key prefix для namespace isolation
   * @default "aladdin:"
   */
  keyPrefix?: string;

  /**
   * Logger
   */
  logger?: Logger;

  /**
   * Enable compression for large values
   * @default false
   */
  compression?: boolean;

  /**
   * Maximum retries for failed operations
   * @default 3
   */
  maxRetries?: number;
};

/**
 * Cache Statistics
 */
export type CacheStats = {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
};

/**
 * Cache Service
 *
 * Высокопроизводительное кэширование с Redis
 *
 * @example
 * ```typescript
 * const cache = new CacheService({
 *   redis: process.env.REDIS_URL,
 *   keyPrefix: 'market-data:',
 *   defaultTTL: 60,
 *   logger: logger
 * });
 *
 * // Set value
 * await cache.set('aggregated:BTCUSDT', priceData, 1);
 *
 * // Get value
 * const data = await cache.get('aggregated:BTCUSDT');
 *
 * // Wrap function with cache
 * const result = await cache.wrap('expensive-query', async () => {
 *   return await fetchExpensiveData();
 * }, 300);
 * ```
 */
export class CacheService {
  private redis: Redis;
  private options: Required<CacheOptions>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.options = {
      redis: options.redis ?? process.env.REDIS_URL ?? "redis://localhost:6379",
      defaultTTL: options.defaultTTL ?? 60,
      keyPrefix: options.keyPrefix ?? "aladdin:",
      logger: options.logger ?? undefined,
      compression: options.compression ?? false,
      maxRetries: options.maxRetries ?? 3,
    } as Required<CacheOptions>;

    // Initialize Redis client
    if (typeof this.options.redis === "string") {
      this.redis = new Redis(this.options.redis, {
        maxRetriesPerRequest: this.options.maxRetries,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } else {
      this.redis = new Redis({
        ...this.options.redis,
        maxRetriesPerRequest: this.options.maxRetries,
      });
    }

    // Setup event handlers
    this.redis.on("connect", () => {
      this.options.logger?.info("Redis connected", {
        keyPrefix: this.options.keyPrefix,
      });
    });

    this.redis.on("error", (error: Error) => {
      this.stats.errors++;
      this.options.logger?.error("Redis error", error);
    });

    this.redis.on("reconnecting", () => {
      this.options.logger?.warn("Redis reconnecting");
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key);
      const data = await this.redis.get(fullKey);

      if (!data) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      return JSON.parse(data) as T;
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache get failed", error, { key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      const ttl = ttlSeconds ?? this.options.defaultTTL;
      const data = JSON.stringify(value);

      await this.redis.setex(fullKey, ttl, data);
      this.stats.sets++;

      this.options.logger?.debug("Cache set", {
        key,
        ttl,
        size: data.length,
      });
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache set failed", error, { key });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.redis.del(fullKey);
      this.stats.deletes++;
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache delete failed", error, { key });
    }
  }

  /**
   * Invalidate multiple keys by pattern
   */
  async invalidate(pattern: string): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern);
      const keys = await this.redis.keys(fullPattern);

      if (keys.length === 0) {
        return 0;
      }

      await this.redis.del(...keys);
      this.stats.deletes += keys.length;

      this.options.logger?.info("Cache invalidated", {
        pattern,
        count: keys.length,
      });

      return keys.length;
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache invalidate failed", error, { pattern });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const fullKey = this.buildKey(key);
      const exists = await this.redis.exists(fullKey);
      return exists === 1;
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache has failed", error, { key });
      return false;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      const fullKeys = keys.map((k) => this.buildKey(k));
      const values = await this.redis.mget(...fullKeys);

      return values.map((value) => {
        if (!value) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;
        return JSON.parse(value) as T;
      });
    } finally {
      this.updateHitRate();
    }
  }

  /**
   * Set multiple values at once
   */
  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();

      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key);
        const ttl = entry.ttl ?? this.options.defaultTTL;
        const data = JSON.stringify(entry.value);

        pipeline.setex(fullKey, ttl, data);
      }

      await pipeline.exec();
      this.stats.sets += entries.length;
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache mset failed", error);
    }
  }

  /**
   * Wrap function with cache
   * Automatically caches function result
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn();

    // Cache result
    await this.set(key, result, ttlSeconds);

    return result;
  }

  /**
   * Increment counter
   */
  async increment(key: string, amount = 1): Promise<number> {
    try {
      const fullKey = this.buildKey(key);
      return await this.redis.incrby(fullKey, amount);
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache increment failed", error, { key });
      return 0;
    }
  }

  /**
   * Decrement counter
   */
  async decrement(key: string, amount = 1): Promise<number> {
    try {
      const fullKey = this.buildKey(key);
      return await this.redis.decrby(fullKey, amount);
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache decrement failed", error, { key });
      return 0;
    }
  }

  /**
   * Get TTL of key
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.buildKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache ttl failed", error, { key });
      return -1;
    }
  }

  /**
   * Set expiration for key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      const fullKey = this.buildKey(key);
      await this.redis.expire(fullKey, ttlSeconds);
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache expire failed", error, { key });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Flush all keys matching prefix
   */
  async flush(): Promise<void> {
    try {
      const pattern = this.buildKey("*");
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.options.logger?.info("Cache flushed", { count: keys.length });
    } catch (error) {
      this.stats.errors++;
      this.options.logger?.error("Cache flush failed", error);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    this.options.logger?.info("Redis connection closed");
  }

  /**
   * Build full key with prefix
   */
  private buildKey(key: string): string {
    return `${this.options.keyPrefix}${key}`;
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Get Redis client (for advanced usage)
   */
  getClient(): Redis {
    return this.redis;
  }
}

/**
 * Cache key builder helper
 */
export class CacheKeyBuilder {
  private parts: string[] = [];

  constructor(private prefix = "") {
    if (prefix) {
      this.parts.push(prefix);
    }
  }

  add(part: string | number): this {
    this.parts.push(String(part));
    return this;
  }

  build(): string {
    return this.parts.join(":");
  }

  static create(prefix = ""): CacheKeyBuilder {
    return new CacheKeyBuilder(prefix);
  }
}

/**
 * Cache strategies
 */
export const CacheStrategies = {
  /**
   * Aggregated prices - 1 second TTL
   */
  AGGREGATED_PRICES: 1,

  /**
   * Technical indicators - 60 seconds TTL
   */
  INDICATORS: 60,

  /**
   * Portfolio positions - 5 seconds TTL
   */
  POSITIONS: 5,

  /**
   * User settings - 300 seconds TTL
   */
  USER_SETTINGS: 300,

  /**
   * Exchange symbols - 3600 seconds TTL
   */
  EXCHANGE_SYMBOLS: 3600,

  /**
   * Market overview - 30 seconds TTL
   */
  MARKET_OVERVIEW: 30,

  /**
   * On-chain metrics - 300 seconds TTL
   */
  ONCHAIN_METRICS: 300,
} as const;
