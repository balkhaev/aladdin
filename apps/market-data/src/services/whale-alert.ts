import type { ClickHouseService } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import type { WhaleAlert, WhaleTransaction } from "@aladdin/core";
import { isExchangeAddress } from "../data/exchange-addresses";

type WhaleAlertConfig = {
  logger: Logger;
  natsClient: NatsClient;
  clickhouse: ClickHouseService;
  btcThreshold?: number;
  ethThreshold?: number;
  exchangeThreshold?: number;
  enabled?: boolean;
};

const DEFAULT_BTC_THRESHOLD = 10;
const DEFAULT_ETH_THRESHOLD = 100;
const DEFAULT_EXCHANGE_THRESHOLD = 50;
const ALERT_CACHE_TTL_MS = 3_600_000; // 1 hour

/**
 * Whale Alert Service
 * Monitors whale transactions and sends real-time alerts via NATS
 */
export class WhaleAlertService {
  private logger: Logger;
  private natsClient: NatsClient;
  private clickhouse: ClickHouseService;
  private btcThreshold: number;
  private ethThreshold: number;
  private exchangeThreshold: number;
  private enabled: boolean;

  // Cache to prevent duplicate alerts
  private seenTransactions = new Map<string, number>(); // txHash -> timestamp

  constructor(config: WhaleAlertConfig) {
    this.logger = config.logger;
    this.natsClient = config.natsClient;
    this.clickhouse = config.clickhouse;
    this.btcThreshold = config.btcThreshold ?? DEFAULT_BTC_THRESHOLD;
    this.ethThreshold = config.ethThreshold ?? DEFAULT_ETH_THRESHOLD;
    this.exchangeThreshold =
      config.exchangeThreshold ?? DEFAULT_EXCHANGE_THRESHOLD;
    this.enabled = config.enabled ?? true;

    // Cleanup seen transactions periodically
    setInterval(() => {
      this.cleanupCache();
    }, ALERT_CACHE_TTL_MS);
  }

  /**
   * Check whale transactions and send alerts
   */
  async checkAndAlert(
    transactions: WhaleTransaction[],
    blockchain: "BTC" | "ETH"
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const threshold =
      blockchain === "BTC" ? this.btcThreshold : this.ethThreshold;
    const alerts: WhaleAlert[] = [];

    for (const tx of transactions) {
      // Skip if already seen
      if (this.seenTransactions.has(tx.transactionHash)) {
        continue;
      }

      // Mark as seen
      this.seenTransactions.set(tx.transactionHash, Date.now());

      // Check if transaction exceeds threshold
      if (tx.value < threshold) {
        continue;
      }

      // Determine alert type
      const fromExchange = isExchangeAddress(tx.from, blockchain);
      const toExchange = isExchangeAddress(tx.to, blockchain);

      let alertType: WhaleAlert["alertType"] = "whale_tx";
      let exchange: string | undefined;
      let isInflow: boolean | undefined;

      if (fromExchange.isExchange && !toExchange.isExchange) {
        // Outflow from exchange
        alertType = "exchange_outflow";
        exchange = fromExchange.exchange;
        isInflow = false;
      } else if (!fromExchange.isExchange && toExchange.isExchange) {
        // Inflow to exchange
        alertType = "exchange_inflow";
        exchange = toExchange.exchange;
        isInflow = true;
      } else if (tx.value >= this.exchangeThreshold) {
        // Very large transfer
        alertType = "large_transfer";
      }

      const alert: WhaleAlert = {
        timestamp: tx.timestamp,
        blockchain: tx.blockchain,
        alertType,
        transactionHash: tx.transactionHash,
        value: tx.value,
        fromAddress: tx.from,
        toAddress: tx.to,
        exchange,
        isInflow,
      };

      alerts.push(alert);
    }

    if (alerts.length > 0) {
      // Store alerts in ClickHouse
      await this.storeAlerts(alerts);

      // Publish alerts to NATS
      await this.publishAlerts(alerts, blockchain);

      this.logger.info("Whale alerts processed", {
        blockchain,
        count: alerts.length,
        types: alerts.reduce(
          (acc, a) => {
            acc[a.alertType] = (acc[a.alertType] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      });
    }
  }

  /**
   * Store alerts in ClickHouse
   */
  private async storeAlerts(alerts: WhaleAlert[]): Promise<void> {
    try {
      const records = alerts.map((alert) => ({
        timestamp: alert.timestamp,
        blockchain: alert.blockchain,
        alert_type: alert.alertType,
        transaction_hash: alert.transactionHash,
        value: alert.value,
        from_address: alert.fromAddress,
        to_address: alert.toAddress,
        exchange: alert.exchange ?? "",
        is_inflow: alert.isInflow ? 1 : 0,
        usd_value: alert.usdValue ?? null,
      }));

      await this.clickhouse.insert("whale_alerts", records);

      this.logger.debug("Stored whale alerts in ClickHouse", {
        count: alerts.length,
      });
    } catch (error) {
      this.logger.error("Failed to store whale alerts", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Publish alerts to NATS
   */
  private async publishAlerts(
    alerts: WhaleAlert[],
    blockchain: "BTC" | "ETH"
  ): Promise<void> {
    try {
      // Publish to blockchain-specific topic
      await this.natsClient.publish(
        `whale.alert.${blockchain.toLowerCase()}`,
        alerts
      );

      // Publish exchange-specific alerts
      const exchangeAlerts = alerts.filter(
        (a) =>
          a.alertType === "exchange_inflow" ||
          a.alertType === "exchange_outflow"
      );

      if (exchangeAlerts.length > 0) {
        await this.natsClient.publish("whale.alert.exchange", exchangeAlerts);
      }

      // Publish very large transfers
      const largeTransfers = alerts.filter(
        (a) => a.alertType === "large_transfer"
      );

      if (largeTransfers.length > 0) {
        await this.natsClient.publish("whale.alert.large", largeTransfers);
      }

      this.logger.debug("Published whale alerts to NATS", {
        blockchain,
        total: alerts.length,
        exchange: exchangeAlerts.length,
        large: largeTransfers.length,
      });
    } catch (error) {
      this.logger.error("Failed to publish whale alerts", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Clean up old entries from seen transactions cache
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [txHash, timestamp] of this.seenTransactions.entries()) {
      if (now - timestamp > ALERT_CACHE_TTL_MS) {
        this.seenTransactions.delete(txHash);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug("Cleaned up whale alert cache", { removed });
    }
  }

  /**
   * Get recent alerts from ClickHouse
   */
  async getRecentAlerts(
    blockchain?: string,
    limit = 50
  ): Promise<WhaleAlert[]> {
    try {
      const whereClause = blockchain
        ? "WHERE blockchain = {blockchain:String}"
        : "";

      const rawAlerts = await this.clickhouse.query<{
        timestamp: string;
        blockchain: string;
        alert_type: string;
        transaction_hash: string;
        value: number;
        from_address: string;
        to_address: string;
        exchange: string;
        is_inflow: number;
        usd_value: number | null;
      }>(
        `
        SELECT *
        FROM whale_alerts
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
      `,
        blockchain ? { blockchain, limit } : { limit }
      );

      return rawAlerts.map((raw) => ({
        timestamp: new Date(raw.timestamp).getTime(),
        blockchain: raw.blockchain,
        alertType: raw.alert_type as WhaleAlert["alertType"],
        transactionHash: raw.transaction_hash,
        value: raw.value,
        fromAddress: raw.from_address,
        toAddress: raw.to_address,
        exchange: raw.exchange || undefined,
        isInflow: raw.is_inflow === 1 ? true : undefined,
        usdValue: raw.usd_value ?? undefined,
      }));
    } catch (error) {
      this.logger.error("Failed to get recent alerts", error);
      return [];
    }
  }

  /**
   * Enable/disable whale alerts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    const status = enabled ? "enabled" : "disabled";
    this.logger.info("Whale alerts status changed", { status });
  }

  /**
   * Update thresholds
   */
  setThresholds(btc?: number, eth?: number, exchange?: number): void {
    if (btc !== undefined) {
      this.btcThreshold = btc;
    }
    if (eth !== undefined) {
      this.ethThreshold = eth;
    }
    if (exchange !== undefined) {
      this.exchangeThreshold = exchange;
    }

    this.logger.info("Updated whale alert thresholds", {
      btc: this.btcThreshold,
      eth: this.ethThreshold,
      exchange: this.exchangeThreshold,
    });
  }
}
