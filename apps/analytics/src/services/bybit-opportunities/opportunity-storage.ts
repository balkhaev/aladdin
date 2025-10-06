/**
 * Opportunity Storage Service
 * Stores opportunities in ClickHouse
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { TradingOpportunity } from "./types";

export class OpportunityStorageService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Store opportunity in ClickHouse
   */
  async storeOpportunity(opportunity: TradingOpportunity): Promise<void> {
    try {
      await this.clickhouse.insert("bybit_opportunities", [
        {
          timestamp: new Date(opportunity.timestamp),
          symbol: opportunity.symbol,
          exchange: opportunity.exchange,
          opportunity_type: opportunity.opportunityType,
          total_score: opportunity.totalScore,
          technical_score: opportunity.technicalScore,
          momentum_score: opportunity.momentumScore,
          ml_confidence: opportunity.mlConfidence,
          strength: opportunity.strength,
          confidence: opportunity.confidence,
          price: opportunity.price,
          volume_24h: opportunity.volume24h,
          price_change_1m: opportunity.momentum.priceChange1m,
          price_change_5m: opportunity.momentum.priceChange5m,
          price_change_15m: opportunity.momentum.priceChange15m,
          rsi: opportunity.indicators.rsi,
          macd: opportunity.indicators.macd,
          volume_spike: opportunity.momentum.volumeSpike,
          anomaly_types: opportunity.anomalies?.map((a) => a.type) || [],
          metadata: JSON.stringify(opportunity.metadata || {}),
        },
      ]);
    } catch (error) {
      this.logger.error("Failed to store opportunity", { error, opportunity });
    }
  }

  /**
   * Get recent opportunities
   */
  async getRecentOpportunities(params: {
    limit?: number;
    minScore?: number;
    signal?: string;
    minConfidence?: number;
  }): Promise<TradingOpportunity[]> {
    const { limit = 100, minScore, signal, minConfidence } = params;

    const conditions: string[] = ["timestamp > now() - INTERVAL 24 HOUR"];

    if (minScore !== undefined) {
      conditions.push(`total_score >= ${minScore}`);
    }

    if (signal) {
      conditions.push(`opportunity_type = '${signal}'`);
    }

    if (minConfidence !== undefined) {
      conditions.push(`confidence >= ${minConfidence}`);
    }

    const query = `
      SELECT 
        timestamp,
        symbol,
        exchange,
        opportunity_type,
        total_score,
        technical_score,
        momentum_score,
        ml_confidence,
        strength,
        confidence,
        price,
        volume_24h,
        price_change_1m,
        price_change_5m,
        price_change_15m,
        rsi,
        macd,
        volume_spike,
        anomaly_types,
        metadata
      FROM bybit_opportunities
      WHERE ${conditions.join(" AND ")}
      ORDER BY timestamp DESC 
      LIMIT ${limit}
    `;

    try {
      const rows = await this.clickhouse.query<{
        timestamp: string;
        symbol: string;
        exchange: string;
        opportunity_type: string;
        total_score: number;
        technical_score: number;
        momentum_score: number;
        ml_confidence: number;
        strength: string;
        confidence: number;
        price: number;
        volume_24h: number;
        price_change_1m: number;
        price_change_5m: number;
        price_change_15m: number;
        rsi: number;
        macd: number;
        volume_spike: number;
        anomaly_types: string[];
        metadata: string;
      }>(query);

      return rows.map((row) => ({
        timestamp: new Date(row.timestamp).getTime(),
        symbol: row.symbol,
        exchange: row.exchange,
        opportunityType: row.opportunity_type as "BUY" | "SELL" | "NEUTRAL",
        totalScore: row.total_score,
        technicalScore: row.technical_score,
        momentumScore: row.momentum_score,
        mlConfidence: row.ml_confidence,
        strength: row.strength as "WEAK" | "MODERATE" | "STRONG",
        confidence: row.confidence,
        price: row.price,
        volume24h: row.volume_24h,
        indicators: {
          rsi: row.rsi,
          macd: row.macd,
          macdSignal: 0,
          macdHistogram: 0,
          ema20: 0,
          ema50: 0,
          ema200: 0,
          bbUpper: 0,
          bbMiddle: 0,
          bbLower: 0,
          stochK: 0,
          stochD: 0,
          atr: 0,
          adx: 0,
        },
        momentum: {
          priceChange1m: row.price_change_1m,
          priceChange5m: row.price_change_5m,
          priceChange15m: row.price_change_15m,
          volumeSpike: row.volume_spike,
          acceleration: 0,
          volatility: 0,
        },
        anomalies: row.anomaly_types.map((type) => ({
          type,
          confidence: 0,
          severity: "LOW" as const,
          description: "",
        })),
        metadata: JSON.parse(row.metadata || "{}"),
      }));
    } catch (error) {
      this.logger.error("Failed to get opportunities", { error });
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    bySignal: Record<string, number>;
    byStrength: Record<string, number>;
  }> {
    try {
      const rows = await this.clickhouse.query<{
        total: string;
        buy_count: string;
        sell_count: string;
        neutral_count: string;
        weak_count: string;
        moderate_count: string;
        strong_count: string;
      }>(`
          SELECT 
            COUNT(*) as total,
            countIf(opportunity_type = 'BUY') as buy_count,
            countIf(opportunity_type = 'SELL') as sell_count,
            countIf(opportunity_type = 'NEUTRAL') as neutral_count,
            countIf(strength = 'WEAK') as weak_count,
            countIf(strength = 'MODERATE') as moderate_count,
            countIf(strength = 'STRONG') as strong_count
          FROM bybit_opportunities
          WHERE timestamp > now() - INTERVAL 24 HOUR
        `);

      const row = rows[0];

      return {
        total: Number.parseInt(row.total, 10),
        bySignal: {
          BUY: Number.parseInt(row.buy_count, 10),
          SELL: Number.parseInt(row.sell_count, 10),
          NEUTRAL: Number.parseInt(row.neutral_count, 10),
        },
        byStrength: {
          WEAK: Number.parseInt(row.weak_count, 10),
          MODERATE: Number.parseInt(row.moderate_count, 10),
          STRONG: Number.parseInt(row.strong_count, 10),
        },
      };
    } catch (error) {
      this.logger.error("Failed to get stats", { error });
      return {
        total: 0,
        bySignal: { BUY: 0, SELL: 0, NEUTRAL: 0 },
        byStrength: { WEAK: 0, MODERATE: 0, STRONG: 0 },
      };
    }
  }
}
