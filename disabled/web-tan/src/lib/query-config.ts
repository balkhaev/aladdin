/**
 * Centralized configuration for React Query
 * Provides consistent refetch intervals, stale times, and other query options
 */

/**
 * Refetch intervals for different data update frequencies
 * All values in milliseconds
 */
export const REFETCH_INTERVALS = {
  /**
   * Real-time data (5 seconds)
   * For critical data that changes frequently: prices, order book, trades
   */
  REALTIME: 5000,

  /**
   * Fast updates (30 seconds)
   * For frequently changing data: market stats, active orders
   */
  FAST: 30_000,

  /**
   * Normal updates (1 minute)
   * For regularly updated data: portfolio values, indicators
   */
  NORMAL: 60_000,

  /**
   * Slow updates (2 minutes)
   * For slowly changing data: sentiment, correlations
   */
  SLOW: 120_000,

  /**
   * Very slow updates (5 minutes)
   * For infrequently changing data: advanced metrics, historical analysis
   */
  VERY_SLOW: 300_000,

  /**
   * Static data (10 minutes)
   * For rarely changing data: configuration, settings
   */
  STATIC: 600_000,
} as const;

/**
 * Stale time configurations
 * Determines how long data is considered fresh before refetching
 * All values in milliseconds
 */
export const STALE_TIME = {
  /**
   * Real-time data (0 seconds)
   * Always considered stale, refetch on every render
   */
  REALTIME: 0,

  /**
   * Fast updates (15 seconds)
   */
  FAST: 15_000,

  /**
   * Normal updates (30 seconds)
   */
  NORMAL: 30_000,

  /**
   * Slow updates (1 minute)
   */
  SLOW: 60_000,

  /**
   * Very slow updates (2 minutes)
   */
  VERY_SLOW: 120_000,

  /**
   * Static data (5 minutes)
   */
  STATIC: 300_000,
} as const;

/**
 * Cache time (garbage collection time)
 * Time to keep unused data in cache before removing
 */
export const CACHE_TIME = {
  SHORT: 60_000, // 1 minute
  NORMAL: 300_000, // 5 minutes
  LONG: 600_000, // 10 minutes
  INFINITE: Number.POSITIVE_INFINITY,
} as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  /**
   * Number of retry attempts
   */
  ATTEMPTS: {
    NONE: 0,
    ONCE: 1,
    NORMAL: 3,
    PERSISTENT: 5,
  },

  /**
   * Delay between retries (exponential backoff)
   */
  DELAY: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30_000),
} as const;

/**
 * Helper function to create query options with consistent defaults
 */
export function createQueryOptions<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: {
    updateFrequency?: keyof typeof REFETCH_INTERVALS;
    cacheTime?: keyof typeof CACHE_TIME;
    retry?: keyof typeof RETRY_CONFIG.ATTEMPTS;
    enabled?: boolean;
  }
) {
  const updateFrequency = options?.updateFrequency || "NORMAL";

  return {
    queryKey,
    queryFn,
    refetchInterval: REFETCH_INTERVALS[updateFrequency],
    staleTime: STALE_TIME[updateFrequency],
    gcTime: options?.cacheTime
      ? CACHE_TIME[options.cacheTime]
      : CACHE_TIME.NORMAL,
    retry: options?.retry
      ? RETRY_CONFIG.ATTEMPTS[options.retry]
      : RETRY_CONFIG.ATTEMPTS.NORMAL,
    retryDelay: RETRY_CONFIG.DELAY,
    enabled: options?.enabled ?? true,
  };
}

/**
 * Preset configurations for common query types
 */
export const QUERY_PRESETS = {
  /**
   * Real-time market data (prices, order book)
   */
  MARKET_DATA: {
    refetchInterval: REFETCH_INTERVALS.REALTIME,
    staleTime: STALE_TIME.REALTIME,
    gcTime: CACHE_TIME.SHORT,
  },

  /**
   * Portfolio data (positions, values)
   */
  PORTFOLIO: {
    refetchInterval: REFETCH_INTERVALS.NORMAL,
    staleTime: STALE_TIME.NORMAL,
    gcTime: CACHE_TIME.NORMAL,
  },

  /**
   * Analytics and metrics
   */
  ANALYTICS: {
    refetchInterval: REFETCH_INTERVALS.SLOW,
    staleTime: STALE_TIME.SLOW,
    gcTime: CACHE_TIME.LONG,
  },

  /**
   * Static/configuration data
   */
  STATIC: {
    refetchInterval: REFETCH_INTERVALS.STATIC,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.INFINITE,
  },
} as const;
