/**
 * AI Cache Service
 * Кэширование результатов GPT для экономии API calls
 */

import type { Logger } from "@aladdin/logger";
import type { CachedSentiment, SentimentScore } from "./types";

const DEFAULT_TTL_HOURS = 24;
const HOURS_TO_MS = 3_600_000;

export class AICacheService {
  private cache: Map<string, CachedSentiment> = new Map();
  private readonly ttlMs: number;

  constructor(
    private logger: Logger,
    ttlHours = DEFAULT_TTL_HOURS
  ) {
    this.ttlMs = ttlHours * HOURS_TO_MS;
  }

  /**
   * Generate cache key from text
   */
  private generateKey(text: string): string {
    // Simple hash function
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = hash * 33 + text.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached sentiment
   */
  get(text: string): SentimentScore | null {
    const key = this.generateKey(text);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - cached.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug("AI cache hit", { key });
    return cached.sentiment;
  }

  /**
   * Set sentiment in cache
   */
  set(text: string, sentiment: SentimentScore, model: string): void {
    const key = this.generateKey(text);
    this.cache.set(key, {
      sentiment,
      timestamp: Date.now(),
      model,
    });

    this.logger.debug("AI cache set", { key, model });
  }

  /**
   * Clear expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.info("AI cache cleanup", {
        removed,
        remaining: this.cache.size,
      });
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    if (this.cache.size === 0) {
      return { size: 0, oldestEntry: null, newestEntry: null };
    }

    let oldest = Number.POSITIVE_INFINITY;
    let newest = 0;

    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldest) oldest = entry.timestamp;
      if (entry.timestamp > newest) newest = entry.timestamp;
    }

    return {
      size: this.cache.size,
      oldestEntry: oldest === Number.POSITIVE_INFINITY ? null : oldest,
      newestEntry: newest || null,
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.logger.info("AI cache cleared");
  }
}
