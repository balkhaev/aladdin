/**
 * On-Chain Cache Service
 * Multi-level caching for on-chain metrics
 * Level 1: In-memory cache (fast, short TTL)
 * Level 2: ClickHouse materialized views (pre-aggregated)
 * Level 3: ClickHouse main table (fallback)
 */

import type { ClickHouseService } from "@aladdin/clickhouse";
import type { OnChainMetrics } from "@aladdin/core";
import type { Logger } from "@aladdin/logger";

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

type MetricsHistory = {
  blockchain: string;
  from: number;
  to: number;
  metrics: OnChainMetrics[];
};

const ONE_MINUTE = 60_000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

/**
 * Multi-level cache for on-chain metrics
 */
export class OnChainCacheService {
  private logger: Logger;
  private clickhouse: ClickHouseService;

  // Level 1: In-memory cache
  private memoryCache = new Map<string, CacheEntry<unknown>>();
  private maxCacheSize = 100;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
  };

  constructor(logger: Logger, clickhouse: ClickHouseService) {
    this.logger = logger;
    this.clickhouse = clickhouse;

    // Periodic cleanup of expired entries
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, ONE_MINUTE);
  }

  /**
   * Get latest metrics for a blockchain
   * Uses in-memory cache first, then ClickHouse
   */
  async getLatestMetrics(blockchain: string): Promise<OnChainMetrics | null> {
    const cacheKey = `metrics:latest:${blockchain}`;

    // Level 1: Check memory cache
    const cached = this.getFromMemory<OnChainMetrics>(cacheKey);
    if (cached) {
      this.stats.hits++;
      this.logger.debug("Cache hit (memory)", { blockchain, key: cacheKey });
      return cached;
    }

    this.stats.misses++;

    // Level 2: Fetch from ClickHouse
    try {
      const rawMetrics = await this.clickhouse.query<{
        timestamp: string;
        blockchain: string;
        whale_tx_count: number;
        whale_tx_volume: number;
        exchange_inflow: number;
        exchange_outflow: number;
        exchange_net_flow: number;
        active_addresses: number;
        nvt_ratio: number;
        market_cap: number | null;
        transaction_volume: number;
        mvrv_ratio: number | null;
        sopr: number | null;
        nupl: number | null;
        exchange_reserve: number | null;
        puell_multiple: number | null;
        stock_to_flow: number | null;
        reserve_risk: number | null;
        accumulation_score: number | null;
        accumulation_trend_7d: number | null;
        accumulation_trend_30d: number | null;
        accumulation_trend_90d: number | null;
        hodl_under1m: number | null;
        hodl_m1to3: number | null;
        hodl_m3to6: number | null;
        hodl_m6to12: number | null;
        hodl_y1to2: number | null;
        hodl_y2to3: number | null;
        hodl_y3to5: number | null;
        hodl_over5y: number | null;
        binary_cdd: number | null;
      }>(
        `
        SELECT *
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
        ORDER BY timestamp DESC
        LIMIT 1
      `,
        { blockchain }
      );

      if (rawMetrics.length === 0) {
        return null;
      }

      const raw = rawMetrics[0];
      const metrics: OnChainMetrics = {
        timestamp: new Date(raw.timestamp).getTime(),
        blockchain: raw.blockchain,
        whaleTransactions: {
          count: raw.whale_tx_count,
          totalVolume: raw.whale_tx_volume,
        },
        exchangeFlow: {
          inflow: raw.exchange_inflow,
          outflow: raw.exchange_outflow,
          netFlow: raw.exchange_net_flow,
        },
        activeAddresses: raw.active_addresses,
        nvtRatio: raw.nvt_ratio,
        marketCap: raw.market_cap ?? undefined,
        transactionVolume: raw.transaction_volume,
        mvrvRatio: raw.mvrv_ratio ?? undefined,
        sopr: raw.sopr ?? undefined,
        nupl: raw.nupl ?? undefined,
        exchangeReserve: raw.exchange_reserve ?? undefined,
        puellMultiple: raw.puell_multiple ?? undefined,
        stockToFlow: raw.stock_to_flow ?? undefined,
        reserveRisk: raw.reserve_risk ?? undefined,
        accumulationTrend:
          raw.accumulation_score !== null
            ? {
                score: raw.accumulation_score,
                trend7d: raw.accumulation_trend_7d ?? 0,
                trend30d: raw.accumulation_trend_30d ?? 0,
                trend90d: raw.accumulation_trend_90d ?? 0,
              }
            : undefined,
        hodlWaves:
          raw.hodl_under1m !== null
            ? {
                under1m: raw.hodl_under1m,
                m1to3: raw.hodl_m1to3 ?? 0,
                m3to6: raw.hodl_m3to6 ?? 0,
                m6to12: raw.hodl_m6to12 ?? 0,
                y1to2: raw.hodl_y1to2 ?? 0,
                y2to3: raw.hodl_y2to3 ?? 0,
                y3to5: raw.hodl_y3to5 ?? 0,
                over5y: raw.hodl_over5y ?? 0,
              }
            : undefined,
        binaryCDD: (() => {
          if (raw.binary_cdd === 1) return true;
          if (raw.binary_cdd === 0) return false;
          return;
        })(),
      };

      // Store in memory cache (1 minute TTL)
      this.setInMemory(cacheKey, metrics, ONE_MINUTE);

      return metrics;
    } catch (error) {
      this.logger.error("Failed to fetch metrics from ClickHouse", error);
      return null;
    }
  }

  /**
   * Get historical metrics for a blockchain
   * Uses materialized views for better performance
   */
  async getHistoricalMetrics(
    blockchain: string,
    from: number,
    to: number,
    interval: "hourly" | "daily" | "weekly" = "hourly"
  ): Promise<MetricsHistory | null> {
    const cacheKey = `metrics:history:${blockchain}:${from}:${to}:${interval}`;

    // Check memory cache (5 minute TTL for historical data)
    const cached = this.getFromMemory<MetricsHistory>(cacheKey);
    if (cached) {
      this.stats.hits++;
      this.logger.debug("Cache hit (memory) for historical data", {
        blockchain,
        interval,
      });
      return cached;
    }

    this.stats.misses++;

    // Fetch from appropriate materialized view
    try {
      const tableName = `on_chain_metrics_${interval}`;
      let timeColumn = "hour";
      if (interval === "weekly") {
        timeColumn = "week";
      } else if (interval === "daily") {
        timeColumn = "day";
      }

      const rawData = await this.clickhouse.query<{
        [key: string]: unknown;
        blockchain: string;
        timestamp: string;
      }>(
        `
        SELECT 
          blockchain,
          ${timeColumn} as timestamp,
          avgMerge(avg_whale_count) as whale_tx_count,
          sumMerge(total_whale_volume) as whale_tx_volume,
          avgMerge(avg_net_flow) as exchange_net_flow,
          avgMerge(avg_mvrv) as mvrv_ratio,
          avgMerge(avg_nupl) as nupl,
          avgMerge(avg_reserve_risk) as reserve_risk,
          avgMerge(avg_accumulation) as accumulation_score,
          countMerge(data_points) as data_points
        FROM ${tableName}
        WHERE blockchain = {blockchain:String}
          AND ${timeColumn} >= {from:DateTime64(3)}
          AND ${timeColumn} <= {to:DateTime64(3)}
        GROUP BY blockchain, ${timeColumn}
        ORDER BY ${timeColumn} ASC
      `,
        { blockchain, from, to }
      );

      // Convert to OnChainMetrics format (simplified for historical view)
      const metrics: OnChainMetrics[] = rawData.map((row) => ({
        timestamp: new Date(row.timestamp as string).getTime(),
        blockchain: row.blockchain,
        whaleTransactions: {
          count: (row.whale_tx_count as number) || 0,
          totalVolume: (row.whale_tx_volume as number) || 0,
        },
        exchangeFlow: {
          inflow: 0,
          outflow: 0,
          netFlow: (row.exchange_net_flow as number) || 0,
        },
        activeAddresses: 0,
        nvtRatio: 0,
        transactionVolume: 0,
        mvrvRatio: (row.mvrv_ratio as number) || undefined,
        nupl: (row.nupl as number) || undefined,
        reserveRisk: (row.reserve_risk as number) || undefined,
        accumulationTrend:
          row.accumulation_score !== null
            ? {
                score: (row.accumulation_score as number) || 0,
                trend7d: 0,
                trend30d: 0,
                trend90d: 0,
              }
            : undefined,
      }));

      const result: MetricsHistory = {
        blockchain,
        from,
        to,
        metrics,
      };

      // Store in memory cache (5 minutes TTL)
      this.setInMemory(cacheKey, result, FIVE_MINUTES);

      return result;
    } catch (error) {
      this.logger.error("Failed to fetch historical metrics", error);
      return null;
    }
  }

  /**
   * Invalidate cache for a blockchain
   */
  invalidate(blockchain: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.memoryCache.keys()) {
      if (key.includes(blockchain)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    this.logger.debug("Invalidated cache", {
      blockchain,
      keysDeleted: keysToDelete.length,
    });
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.logger.info("Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate =
      this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
        : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate.toFixed(2)}%`,
      cacheSize: this.memoryCache.size,
      maxCacheSize: this.maxCacheSize,
    };
  }

  /**
   * Get value from memory cache
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set value in memory cache
   */
  private setInMemory<T>(key: string, data: T, ttl: number): void {
    // Evict oldest entries if cache is full
    if (this.memoryCache.size >= this.maxCacheSize) {
      const firstKey = this.memoryCache.keys().next().value as string;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    this.stats.sets++;
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      this.logger.debug("Cleaned up expired cache entries", {
        count: keysToDelete.length,
      });
    }
  }
}
