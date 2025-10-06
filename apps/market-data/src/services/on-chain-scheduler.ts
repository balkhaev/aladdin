import type { ClickHouseService } from "@aladdin/clickhouse";
import type { OnChainMetrics, WhaleTransaction } from "@aladdin/core";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import type { BlockchainFetcher } from "../fetchers/types";
import { OnChainAlertService } from "./on-chain-alert";
import { WhaleAlertService } from "./whale-alert";

type SchedulerOptions = {
  logger: Logger;
  natsClient: NatsClient;
  clickhouse: ClickHouseService;
  fetchers: BlockchainFetcher[];
  updateIntervalMs: number;
};

const MIN_UPDATE_INTERVAL = 60_000; // 1 minute minimum
const DEFAULT_WHALE_THRESHOLD_BTC = 10;
const DEFAULT_WHALE_THRESHOLD_ETH = 100;
const INITIAL_FETCH_DELAY = 5000; // 5 seconds delay before initial fetch
const CACHE_DURATION = 600_000; // 10 minutes cache
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const MS_IN_SECOND = 1000;
const MILLISECONDS_IN_HOUR = MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SECOND;
const CACHE_TTL_MS = MILLISECONDS_IN_HOUR; // 1 hour TTL
const MAX_CACHE_SIZE = 50; // Maximum 50 blockchains

type CachedMetrics = {
  metrics: OnChainMetrics;
  cachedAt: number;
};

/**
 * Background scheduler for fetching on-chain metrics periodically
 */
export class MetricsScheduler {
  private logger: Logger;
  private natsClient: NatsClient;
  private clickhouse: ClickHouseService;
  private fetchers: BlockchainFetcher[];
  private updateIntervalMs: number;
  private intervalId: Timer | null = null;
  private isRunning = false;
  private lastFetchTime = 0;
  private metricsCache = new Map<string, CachedMetrics>();
  private whaleAlertService: WhaleAlertService;
  private onChainAlertService: OnChainAlertService;

  constructor(options: SchedulerOptions) {
    this.logger = options.logger;
    this.natsClient = options.natsClient;
    this.clickhouse = options.clickhouse;
    this.fetchers = options.fetchers;
    this.updateIntervalMs = Math.max(
      options.updateIntervalMs,
      MIN_UPDATE_INTERVAL
    );

    // Initialize whale alert service
    this.whaleAlertService = new WhaleAlertService({
      logger: this.logger,
      natsClient: this.natsClient,
      clickhouse: this.clickhouse,
      btcThreshold: Number(process.env.WHALE_ALERT_BTC_THRESHOLD) || undefined,
      ethThreshold: Number(process.env.WHALE_ALERT_ETH_THRESHOLD) || undefined,
      exchangeThreshold:
        Number(process.env.WHALE_ALERT_EXCHANGE_THRESHOLD) || undefined,
      enabled: process.env.WHALE_ALERT_ENABLED !== "false",
    });

    // Initialize on-chain alert service
    this.onChainAlertService = new OnChainAlertService({
      logger: this.logger,
      natsClient: this.natsClient,
      clickhouse: this.clickhouse,
      enabled: process.env.ONCHAIN_ALERT_ENABLED !== "false",
    });
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn("Scheduler is already running");
      return;
    }

    this.logger.info("Starting metrics scheduler", {
      intervalMs: this.updateIntervalMs,
      fetcherCount: this.fetchers.length,
    });

    this.isRunning = true;

    // Delay initial fetch to avoid rate limits on hot reload
    const timeSinceLastFetch = Date.now() - this.lastFetchTime;
    const shouldFetch = timeSinceLastFetch > CACHE_DURATION;

    if (shouldFetch) {
      this.logger.info("Scheduling initial fetch with delay", {
        delayMs: INITIAL_FETCH_DELAY,
      });
      setTimeout(() => {
        this.fetchAllMetrics().catch((error) => {
          this.logger.error("Initial metrics fetch failed", error);
        });
      }, INITIAL_FETCH_DELAY);
    } else {
      this.logger.info("Skipping initial fetch, using cached data", {
        timeSinceLastFetch,
      });
    }

    // Schedule periodic updates
    this.intervalId = setInterval(() => {
      this.fetchAllMetrics().catch((error) => {
        this.logger.error("Scheduled metrics fetch failed", error);
      });
    }, this.updateIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("Stopping metrics scheduler");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, cached] of this.metricsCache.entries()) {
      if (now - cached.cachedAt > CACHE_TTL_MS) {
        this.metricsCache.delete(key);
        removed++;
      }
    }

    // If still too large, remove oldest entries (LRU)
    if (this.metricsCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(this.metricsCache.entries());
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      const toRemove = this.metricsCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        this.metricsCache.delete(entries[i][0]);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.info("Cleaned up metrics cache", { removed });
    }
  }

  /**
   * Fetch metrics from all blockchain fetchers
   */
  private async fetchAllMetrics(): Promise<void> {
    this.logger.info("Fetching metrics from all blockchains");

    // Update last fetch time
    this.lastFetchTime = Date.now();

    const results = await Promise.allSettled(
      this.fetchers.map((fetcher) => this.fetchAndStore(fetcher))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    this.logger.info("Metrics fetch completed", {
      successful,
      failed,
      total: results.length,
    });
  }

  /**
   * Fetch metrics from a single blockchain and store in ClickHouse
   */
  private async fetchAndStore(fetcher: BlockchainFetcher): Promise<void> {
    const blockchain = fetcher.getBlockchain();

    try {
      // Fetch metrics
      const metrics = await fetcher.fetchMetrics();

      // Fetch whale transactions details
      const whaleTransactions = await fetcher.fetchWhaleTransactions(
        blockchain === "BTC"
          ? DEFAULT_WHALE_THRESHOLD_BTC
          : DEFAULT_WHALE_THRESHOLD_ETH
      );

      // Cache successful metrics with timestamp
      this.metricsCache.set(blockchain, {
        metrics,
        cachedAt: Date.now(),
      });

      // Cleanup old cache entries periodically
      this.cleanupCache();

      // Store in ClickHouse
      await this.storeMetrics(metrics);
      await this.storeWhaleTransactions(whaleTransactions);

      // Check for whale alerts and send notifications
      await this.whaleAlertService.checkAndAlert(
        whaleTransactions,
        blockchain as "BTC" | "ETH"
      );

      // Check for on-chain metric alerts (MVRV, NUPL, Reserve Risk, etc.)
      await this.onChainAlertService.checkMetrics(metrics);

      // Publish to NATS
      await this.publishMetrics(metrics);

      this.logger.info(`Metrics stored for ${blockchain}`, {
        activeAddresses: metrics.activeAddresses,
        whaleCount: metrics.whaleTransactions.count,
        whaleTransactionsStored: whaleTransactions.length,
      });
    } catch (error) {
      // Try to use cached metrics if available
      const cached = this.metricsCache.get(blockchain);
      if (cached) {
        // Check if cache is not expired
        const cacheAge = Date.now() - cached.cachedAt;
        if (cacheAge < CACHE_TTL_MS) {
          this.logger.warn(
            `Using cached metrics for ${blockchain} due to fetch error`,
            { error, cacheAgeMs: cacheAge }
          );
          // Update timestamp and republish cached data
          const updatedMetrics = { ...cached.metrics, timestamp: Date.now() };
          await this.publishMetrics(updatedMetrics);
        } else {
          this.logger.error(
            `Failed to fetch metrics for ${blockchain} and cache is expired`,
            error
          );
          // Remove expired cache entry
          this.metricsCache.delete(blockchain);
          throw error;
        }
      } else {
        this.logger.error(
          `Failed to fetch and store metrics for ${blockchain} (no cache available)`,
          error
        );
        throw error;
      }
    }
  }

  /**
   * Store metrics in ClickHouse
   */
  private async storeMetrics(metrics: OnChainMetrics): Promise<void> {
    try {
      await this.clickhouse.insert("on_chain_metrics", [
        {
          timestamp: metrics.timestamp, // DateTime64(3) expects milliseconds
          blockchain: metrics.blockchain,
          whale_tx_count: metrics.whaleTransactions.count,
          whale_tx_volume: metrics.whaleTransactions.totalVolume,
          exchange_inflow: metrics.exchangeFlow.inflow,
          exchange_outflow: metrics.exchangeFlow.outflow,
          exchange_net_flow: metrics.exchangeFlow.netFlow,
          active_addresses: metrics.activeAddresses,
          nvt_ratio: metrics.nvtRatio,
          market_cap: metrics.marketCap ?? null,
          transaction_volume: metrics.transactionVolume,
          mvrv_ratio: metrics.mvrvRatio ?? null,
          sopr: metrics.sopr ?? null,
          nupl: metrics.nupl ?? null,
          exchange_reserve: metrics.exchangeReserve ?? null,
          puell_multiple: metrics.puellMultiple ?? null,
          stock_to_flow: metrics.stockToFlow ?? null,
          // New Phase 1 metrics
          reserve_risk: metrics.reserveRisk ?? null,
          accumulation_score: metrics.accumulationTrend?.score ?? null,
          accumulation_trend_7d: metrics.accumulationTrend?.trend7d ?? null,
          accumulation_trend_30d: metrics.accumulationTrend?.trend30d ?? null,
          accumulation_trend_90d: metrics.accumulationTrend?.trend90d ?? null,
          hodl_under1m: metrics.hodlWaves?.under1m ?? null,
          hodl_m1to3: metrics.hodlWaves?.m1to3 ?? null,
          hodl_m3to6: metrics.hodlWaves?.m3to6 ?? null,
          hodl_m6to12: metrics.hodlWaves?.m6to12 ?? null,
          hodl_y1to2: metrics.hodlWaves?.y1to2 ?? null,
          hodl_y2to3: metrics.hodlWaves?.y2to3 ?? null,
          hodl_y3to5: metrics.hodlWaves?.y3to5 ?? null,
          hodl_over5y: metrics.hodlWaves?.over5y ?? null,
          binary_cdd: metrics.binaryCDD ? 1 : null,
        },
      ]);
    } catch (error) {
      this.logger.error("Failed to store metrics in ClickHouse", error);
      throw error;
    }
  }

  /**
   * Store whale transactions in ClickHouse
   */
  private async storeWhaleTransactions(
    transactions: WhaleTransaction[]
  ): Promise<void> {
    if (transactions.length === 0) {
      return;
    }

    try {
      const records = transactions.map((tx) => ({
        timestamp: tx.timestamp, // DateTime64(3) expects milliseconds
        blockchain: tx.blockchain,
        transaction_hash: tx.transactionHash,
        value: tx.value,
        from_address: tx.from,
        to_address: tx.to,
      }));

      await this.clickhouse.insert("whale_transactions", records);

      this.logger.debug("Stored whale transactions", {
        count: transactions.length,
        blockchain: transactions[0]?.blockchain,
      });
    } catch (error) {
      this.logger.error(
        "Failed to store whale transactions in ClickHouse",
        error
      );
      // Don't throw - this is not critical
    }
  }

  /**
   * Publish metrics to NATS
   */
  private async publishMetrics(metrics: OnChainMetrics): Promise<void> {
    try {
      await this.natsClient.publish(
        `on-chain.metrics.${metrics.blockchain.toLowerCase()}`,
        metrics
      );
    } catch (error) {
      this.logger.error("Failed to publish metrics to NATS", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    updateIntervalMs: number;
    fetcherCount: number;
  } {
    return {
      isRunning: this.isRunning,
      updateIntervalMs: this.updateIntervalMs,
      fetcherCount: this.fetchers.length,
    };
  }

  /**
   * Get whale alert service
   */
  getWhaleAlertService(): WhaleAlertService {
    return this.whaleAlertService;
  }

  /**
   * Get on-chain alert service
   */
  getOnChainAlertService(): OnChainAlertService {
    return this.onChainAlertService;
  }
}
