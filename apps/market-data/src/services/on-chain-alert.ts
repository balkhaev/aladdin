/**
 * On-Chain Alert Service
 * Monitors extreme metric values and generates alerts
 * Phase 3: MVRV/NUPL extremes and Reserve Risk alerts
 */

import type { ClickHouseService } from "@aladdin/clickhouse";
import type { OnChainMetrics } from "@aladdin/core";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";

type OnChainAlert = {
  id: string;
  timestamp: number;
  blockchain: string;
  alertType:
    | "mvrv"
    | "nupl"
    | "reserve_risk"
    | "accumulation"
    | "hodl_wave"
    | "cdd";
  severity: "info" | "warning" | "critical";
  message: string;
  value?: number;
  threshold?: number;
  signal?: "bullish" | "bearish" | "neutral";
  metadata?: Record<string, unknown>;
};

type AlertThresholds = {
  mvrv: {
    extremeUndervalue: number; // < 0.8
    undervalue: number; // < 1.0
    overvalue: number; // > 3.0
    extremeOvervalue: number; // > 3.7
  };
  nupl: {
    capitulation: number; // < -0.25
    fear: number; // < 0
    greed: number; // > 0.5
    euphoria: number; // > 0.75
  };
  reserveRisk: {
    extremeAccumulation: number; // < 0.002
    accumulation: number; // < 0.005
    distribution: number; // > 0.015
    extremeDistribution: number; // > 0.02
  };
  accumulation: {
    strongDistribution: number; // < -50
    distribution: number; // < -20
    accumulation: number; // > 20
    strongAccumulation: number; // > 50
  };
};

const DEFAULT_THRESHOLDS: AlertThresholds = {
  mvrv: {
    extremeUndervalue: 0.8,
    undervalue: 1.0,
    overvalue: 3.0,
    extremeOvervalue: 3.7,
  },
  nupl: {
    capitulation: -0.25,
    fear: 0,
    greed: 0.5,
    euphoria: 0.75,
  },
  reserveRisk: {
    extremeAccumulation: 0.002,
    accumulation: 0.005,
    distribution: 0.015,
    extremeDistribution: 0.02,
  },
  accumulation: {
    strongDistribution: -50,
    distribution: -20,
    accumulation: 20,
    strongAccumulation: 50,
  },
};

const ALERT_CACHE_TTL_MS = 3_600_000; // 1 hour

/**
 * On-Chain Alert Service
 * Monitors extreme values and generates actionable alerts
 */
export class OnChainAlertService {
  private logger: Logger;
  private natsClient: NatsClient;
  private clickhouse: ClickHouseService;
  private thresholds: AlertThresholds;
  private enabled: boolean;

  // Cache to prevent duplicate alerts
  private seenAlerts = new Map<string, number>(); // alertKey -> timestamp

  constructor(config: {
    logger: Logger;
    natsClient: NatsClient;
    clickhouse: ClickHouseService;
    thresholds?: Partial<AlertThresholds>;
    enabled?: boolean;
  }) {
    this.logger = config.logger;
    this.natsClient = config.natsClient;
    this.clickhouse = config.clickhouse;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
    this.enabled = config.enabled ?? true;

    // Cleanup cache periodically
    setInterval(() => {
      this.cleanupCache();
    }, ALERT_CACHE_TTL_MS);
  }

  /**
   * Check metrics and generate alerts
   */
  async checkMetrics(metrics: OnChainMetrics): Promise<OnChainAlert[]> {
    if (!this.enabled) {
      return [];
    }

    const alerts: OnChainAlert[] = [];

    // Check MVRV extremes
    if (metrics.mvrvRatio !== undefined) {
      const mvrvAlerts = this.checkMVRV(
        metrics.mvrvRatio,
        metrics.blockchain,
        metrics.timestamp
      );
      alerts.push(...mvrvAlerts);
    }

    // Check NUPL extremes
    if (metrics.nupl !== undefined) {
      const nuplAlerts = this.checkNUPL(
        metrics.nupl,
        metrics.blockchain,
        metrics.timestamp
      );
      alerts.push(...nuplAlerts);
    }

    // Check Reserve Risk extremes
    if (metrics.reserveRisk !== undefined) {
      const reserveAlerts = this.checkReserveRisk(
        metrics.reserveRisk,
        metrics.blockchain,
        metrics.timestamp
      );
      alerts.push(...reserveAlerts);
    }

    // Check Accumulation Trend
    if (metrics.accumulationTrend) {
      const accumulationAlerts = this.checkAccumulation(
        metrics.accumulationTrend.score,
        metrics.blockchain,
        metrics.timestamp
      );
      alerts.push(...accumulationAlerts);
    }

    // Check Binary CDD events
    if (metrics.binaryCDD === true) {
      const cddAlert = this.checkBinaryCDD(
        metrics.blockchain,
        metrics.timestamp
      );
      if (cddAlert) alerts.push(cddAlert);
    }

    // Check HODL Waves for significant shifts
    if (metrics.hodlWaves) {
      const hodlAlerts = this.checkHODLWaves(
        metrics.hodlWaves,
        metrics.blockchain,
        metrics.timestamp
      );
      alerts.push(...hodlAlerts);
    }

    // Filter out duplicate alerts
    const uniqueAlerts = alerts.filter((alert) => {
      const key = `${alert.alertType}:${alert.blockchain}:${alert.severity}`;
      const lastSeen = this.seenAlerts.get(key);
      const now = Date.now();

      if (lastSeen && now - lastSeen < ALERT_CACHE_TTL_MS) {
        return false; // Skip duplicate
      }

      this.seenAlerts.set(key, now);
      return true;
    });

    // Store and publish alerts
    if (uniqueAlerts.length > 0) {
      await this.storeAlerts(uniqueAlerts);
      await this.publishAlerts(uniqueAlerts);

      this.logger.info("On-chain alerts generated", {
        blockchain: metrics.blockchain,
        count: uniqueAlerts.length,
        types: uniqueAlerts.map((a) => a.alertType),
      });
    }

    return uniqueAlerts;
  }

  /**
   * Check MVRV ratio for extreme values
   */
  private checkMVRV(
    mvrv: number,
    blockchain: string,
    timestamp: number
  ): OnChainAlert[] {
    const alerts: OnChainAlert[] = [];

    if (mvrv < this.thresholds.mvrv.extremeUndervalue) {
      alerts.push({
        id: `mvrv-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "mvrv",
        severity: "critical",
        signal: "bullish",
        message: `MVRV extremely undervalued at ${mvrv.toFixed(2)} (< ${this.thresholds.mvrv.extremeUndervalue})`,
        value: mvrv,
        threshold: this.thresholds.mvrv.extremeUndervalue,
        metadata: {
          interpretation: "Historic buying opportunity",
          confidence: "high",
        },
      });
    } else if (mvrv < this.thresholds.mvrv.undervalue) {
      alerts.push({
        id: `mvrv-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "mvrv",
        severity: "warning",
        signal: "bullish",
        message: `MVRV undervalued at ${mvrv.toFixed(2)} (< ${this.thresholds.mvrv.undervalue})`,
        value: mvrv,
        threshold: this.thresholds.mvrv.undervalue,
        metadata: {
          interpretation: "Potential buying zone",
          confidence: "medium",
        },
      });
    } else if (mvrv > this.thresholds.mvrv.extremeOvervalue) {
      alerts.push({
        id: `mvrv-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "mvrv",
        severity: "critical",
        signal: "bearish",
        message: `MVRV extremely overvalued at ${mvrv.toFixed(2)} (> ${this.thresholds.mvrv.extremeOvervalue})`,
        value: mvrv,
        threshold: this.thresholds.mvrv.extremeOvervalue,
        metadata: {
          interpretation: "Historic cycle top zone",
          confidence: "high",
        },
      });
    } else if (mvrv > this.thresholds.mvrv.overvalue) {
      alerts.push({
        id: `mvrv-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "mvrv",
        severity: "warning",
        signal: "bearish",
        message: `MVRV overvalued at ${mvrv.toFixed(2)} (> ${this.thresholds.mvrv.overvalue})`,
        value: mvrv,
        threshold: this.thresholds.mvrv.overvalue,
        metadata: {
          interpretation: "Potential profit-taking zone",
          confidence: "medium",
        },
      });
    }

    return alerts;
  }

  /**
   * Check NUPL for extreme sentiment
   */
  private checkNUPL(
    nupl: number,
    blockchain: string,
    timestamp: number
  ): OnChainAlert[] {
    const alerts: OnChainAlert[] = [];

    if (nupl < this.thresholds.nupl.capitulation) {
      alerts.push({
        id: `nupl-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "nupl",
        severity: "critical",
        signal: "bullish",
        message: `NUPL capitulation at ${(nupl * 100).toFixed(1)}% (< ${(this.thresholds.nupl.capitulation * 100).toFixed(0)}%)`,
        value: nupl,
        threshold: this.thresholds.nupl.capitulation,
        metadata: {
          interpretation: "Extreme fear - capitulation",
          confidence: "high",
        },
      });
    } else if (nupl < this.thresholds.nupl.fear) {
      alerts.push({
        id: `nupl-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "nupl",
        severity: "warning",
        signal: "bullish",
        message: `NUPL in fear zone at ${(nupl * 100).toFixed(1)}% (< 0%)`,
        value: nupl,
        threshold: this.thresholds.nupl.fear,
        metadata: {
          interpretation: "Fear - potential accumulation",
          confidence: "medium",
        },
      });
    } else if (nupl > this.thresholds.nupl.euphoria) {
      alerts.push({
        id: `nupl-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "nupl",
        severity: "critical",
        signal: "bearish",
        message: `NUPL euphoria at ${(nupl * 100).toFixed(1)}% (> ${(this.thresholds.nupl.euphoria * 100).toFixed(0)}%)`,
        value: nupl,
        threshold: this.thresholds.nupl.euphoria,
        metadata: {
          interpretation: "Extreme greed - euphoria",
          confidence: "high",
        },
      });
    } else if (nupl > this.thresholds.nupl.greed) {
      alerts.push({
        id: `nupl-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "nupl",
        severity: "warning",
        signal: "bearish",
        message: `NUPL in greed zone at ${(nupl * 100).toFixed(1)}% (> ${(this.thresholds.nupl.greed * 100).toFixed(0)}%)`,
        value: nupl,
        threshold: this.thresholds.nupl.greed,
        metadata: {
          interpretation: "Greed - consider profit-taking",
          confidence: "medium",
        },
      });
    }

    return alerts;
  }

  /**
   * Check Reserve Risk for accumulation/distribution zones
   */
  private checkReserveRisk(
    reserveRisk: number,
    blockchain: string,
    timestamp: number
  ): OnChainAlert[] {
    const alerts: OnChainAlert[] = [];

    if (reserveRisk < this.thresholds.reserveRisk.extremeAccumulation) {
      alerts.push({
        id: `reserve-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "reserve_risk",
        severity: "critical",
        signal: "bullish",
        message: `Reserve Risk extremely low at ${reserveRisk.toFixed(4)} (< ${this.thresholds.reserveRisk.extremeAccumulation})`,
        value: reserveRisk,
        threshold: this.thresholds.reserveRisk.extremeAccumulation,
        metadata: {
          interpretation: "Extreme accumulation zone",
          confidence: "high",
        },
      });
    } else if (reserveRisk < this.thresholds.reserveRisk.accumulation) {
      alerts.push({
        id: `reserve-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "reserve_risk",
        severity: "info",
        signal: "bullish",
        message: `Reserve Risk in accumulation zone at ${reserveRisk.toFixed(4)}`,
        value: reserveRisk,
        threshold: this.thresholds.reserveRisk.accumulation,
        metadata: { interpretation: "Accumulation zone", confidence: "medium" },
      });
    } else if (reserveRisk > this.thresholds.reserveRisk.extremeDistribution) {
      alerts.push({
        id: `reserve-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "reserve_risk",
        severity: "critical",
        signal: "bearish",
        message: `Reserve Risk extremely high at ${reserveRisk.toFixed(4)} (> ${this.thresholds.reserveRisk.extremeDistribution})`,
        value: reserveRisk,
        threshold: this.thresholds.reserveRisk.extremeDistribution,
        metadata: {
          interpretation: "Extreme distribution zone",
          confidence: "high",
        },
      });
    } else if (reserveRisk > this.thresholds.reserveRisk.distribution) {
      alerts.push({
        id: `reserve-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "reserve_risk",
        severity: "warning",
        signal: "bearish",
        message: `Reserve Risk in distribution zone at ${reserveRisk.toFixed(4)}`,
        value: reserveRisk,
        threshold: this.thresholds.reserveRisk.distribution,
        metadata: { interpretation: "Distribution zone", confidence: "medium" },
      });
    }

    return alerts;
  }

  /**
   * Check Accumulation Trend
   */
  private checkAccumulation(
    score: number,
    blockchain: string,
    timestamp: number
  ): OnChainAlert[] {
    const alerts: OnChainAlert[] = [];

    if (score < this.thresholds.accumulation.strongDistribution) {
      alerts.push({
        id: `accumulation-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "accumulation",
        severity: "warning",
        signal: "bearish",
        message: `Strong distribution detected (score: ${score.toFixed(0)})`,
        value: score,
        threshold: this.thresholds.accumulation.strongDistribution,
        metadata: {
          interpretation: "Smart money distributing",
          confidence: "medium",
        },
      });
    } else if (score > this.thresholds.accumulation.strongAccumulation) {
      alerts.push({
        id: `accumulation-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "accumulation",
        severity: "info",
        signal: "bullish",
        message: `Strong accumulation detected (score: ${score.toFixed(0)})`,
        value: score,
        threshold: this.thresholds.accumulation.strongAccumulation,
        metadata: {
          interpretation: "Smart money accumulating",
          confidence: "medium",
        },
      });
    }

    return alerts;
  }

  /**
   * Check Binary CDD events
   */
  private checkBinaryCDD(
    blockchain: string,
    timestamp: number
  ): OnChainAlert | null {
    return {
      id: `cdd-${blockchain}-${timestamp}`,
      timestamp,
      blockchain,
      alertType: "cdd",
      severity: "warning",
      signal: "neutral",
      message: "Old coins moving - high Coin Days Destroyed activity",
      metadata: {
        interpretation: "Long-term holders selling or repositioning",
        confidence: "medium",
        action: "Monitor for capitulation or distribution",
      },
    };
  }

  /**
   * Check HODL Waves for significant shifts
   */
  private checkHODLWaves(
    hodlWaves: NonNullable<OnChainMetrics["hodlWaves"]>,
    blockchain: string,
    timestamp: number
  ): OnChainAlert[] {
    const alerts: OnChainAlert[] = [];

    // Alert if long-term holders (5y+) drop significantly
    if (hodlWaves.over5y < 35) {
      alerts.push({
        id: `hodl-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "hodl_wave",
        severity: "warning",
        signal: "bearish",
        message: `Long-term holder supply low at ${hodlWaves.over5y.toFixed(1)}% (< 35%)`,
        value: hodlWaves.over5y,
        threshold: 35,
        metadata: {
          interpretation: "Long-term holders distributing",
          confidence: "medium",
        },
      });
    }

    // Alert if long-term holders increase significantly
    if (hodlWaves.over5y > 50) {
      alerts.push({
        id: `hodl-${blockchain}-${timestamp}`,
        timestamp,
        blockchain,
        alertType: "hodl_wave",
        severity: "info",
        signal: "bullish",
        message: `Long-term holder supply high at ${hodlWaves.over5y.toFixed(1)}% (> 50%)`,
        value: hodlWaves.over5y,
        threshold: 50,
        metadata: {
          interpretation: "Strong hodling behavior",
          confidence: "medium",
        },
      });
    }

    return alerts;
  }

  /**
   * Store alerts in ClickHouse
   */
  private async storeAlerts(alerts: OnChainAlert[]): Promise<void> {
    try {
      const records = alerts.map((alert) => ({
        timestamp: alert.timestamp,
        blockchain: alert.blockchain,
        alert_type: alert.alertType,
        severity: alert.severity,
        signal: alert.signal ?? "neutral",
        message: alert.message,
        value: alert.value ?? null,
        threshold: alert.threshold ?? null,
        metadata: JSON.stringify(alert.metadata ?? {}),
      }));

      // Insert into a dedicated alerts table (create if needed)
      await this.clickhouse.insert("on_chain_alerts", records);

      this.logger.debug("Stored on-chain alerts", { count: alerts.length });
    } catch (error) {
      this.logger.error("Failed to store on-chain alerts", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Publish alerts to NATS
   */
  private async publishAlerts(alerts: OnChainAlert[]): Promise<void> {
    try {
      for (const alert of alerts) {
        // Publish to specific topics
        await this.natsClient.publish(
          `onchain.alert.${alert.alertType}`,
          alert
        );

        // Also publish to blockchain-specific topic
        await this.natsClient.publish(
          `onchain.alert.${alert.blockchain.toLowerCase()}.${alert.alertType}`,
          alert
        );

        // Publish critical alerts to general topic
        if (alert.severity === "critical") {
          await this.natsClient.publish("onchain.alert.critical", alert);
        }
      }

      this.logger.debug("Published on-chain alerts to NATS", {
        count: alerts.length,
      });
    } catch (error) {
      this.logger.error("Failed to publish on-chain alerts", error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Clean up old entries from seen alerts cache
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, timestamp] of this.seenAlerts.entries()) {
      if (now - timestamp > ALERT_CACHE_TTL_MS) {
        this.seenAlerts.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.logger.debug("Cleaned up on-chain alert cache", { removed });
    }
  }

  /**
   * Get recent alerts from ClickHouse
   */
  async getRecentAlerts(options?: {
    blockchain?: string;
    alertType?: string;
    severity?: string;
    limit?: number;
  }): Promise<OnChainAlert[]> {
    try {
      const conditions: string[] = [];
      const params: Record<string, unknown> = {};

      if (options?.blockchain) {
        conditions.push("blockchain = {blockchain:String}");
        params.blockchain = options.blockchain;
      }

      if (options?.alertType) {
        conditions.push("alert_type = {alertType:String}");
        params.alertType = options.alertType;
      }

      if (options?.severity) {
        conditions.push("severity = {severity:String}");
        params.severity = options.severity;
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      params.limit = options?.limit ?? 100;

      const rawAlerts = await this.clickhouse.query<{
        timestamp: string;
        blockchain: string;
        alert_type: string;
        severity: string;
        signal: string;
        message: string;
        value: number | null;
        threshold: number | null;
        metadata: string;
      }>(
        `
        SELECT *
        FROM on_chain_alerts
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
      `,
        params
      );

      return rawAlerts.map((raw, index) => ({
        id: `${raw.alert_type}-${raw.blockchain}-${raw.timestamp}-${index}`,
        timestamp: new Date(raw.timestamp).getTime(),
        blockchain: raw.blockchain,
        alertType: raw.alert_type as OnChainAlert["alertType"],
        severity: raw.severity as OnChainAlert["severity"],
        signal: raw.signal as OnChainAlert["signal"],
        message: raw.message,
        value: raw.value ?? undefined,
        threshold: raw.threshold ?? undefined,
        metadata: raw.metadata ? JSON.parse(raw.metadata) : undefined,
      }));
    } catch (error) {
      this.logger.error("Failed to get recent alerts", error);
      return [];
    }
  }

  /**
   * Enable/disable alerts
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`On-chain alerts ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info("Updated on-chain alert thresholds", thresholds);
  }
}
