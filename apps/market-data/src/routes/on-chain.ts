import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { OnChainMetrics } from "@aladdin/core";
import { NotFoundError } from "@aladdin/http/errors";
import { validateParams, validateQuery } from "@aladdin/validation/middleware";
import type { Context, Hono } from "hono";
import {
  blockchainParamSchema,
  type MetricsQuery,
  metricsQuerySchema,
  type PeriodQuery,
  periodQuerySchema,
} from "../validation/schemas";

export function setupOnChainRoutes(
  app: Hono,
  clickhouse: ClickHouseClient | undefined
) {
  /**
   * GET /api/market-data/on-chain/metrics/:blockchain - Get historical metrics
   */
  app.get(
    "/api/market-data/on-chain/metrics/:blockchain",
    validateParams(blockchainParamSchema),
    validateQuery(metricsQuerySchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };
      const query = c.get("validatedQuery") as MetricsQuery;

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const metrics = await clickhouse.query<{
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
      }>(
        `
        SELECT *
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
          AND timestamp >= {from:DateTime64(3)}
          AND timestamp <= {to:DateTime64(3)}
        ORDER BY timestamp DESC
        LIMIT {limit:UInt32}
      `,
        {
          blockchain,
          from: query.from,
          to: query.to,
          limit: query.limit,
        }
      );

      return c.json({
        success: true,
        data: {
          blockchain,
          from: query.from,
          to: query.to,
          metrics,
        },
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/market-data/on-chain/metrics/:blockchain/latest - Get latest metrics
   */
  app.get(
    "/api/market-data/on-chain/metrics/:blockchain/latest",
    validateParams(blockchainParamSchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const rawMetrics = await clickhouse.query<{
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
        throw new NotFoundError(`Metrics for blockchain ${blockchain}`);
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
        binaryCDD:
          raw.binary_cdd === 1
            ? true
            : raw.binary_cdd === 0
              ? false
              : undefined,
      };

      return c.json({
        success: true,
        data: metrics,
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/market-data/on-chain/whale-transactions/:blockchain - Get whale transactions
   */
  app.get(
    "/api/market-data/on-chain/whale-transactions/:blockchain",
    validateParams(blockchainParamSchema),
    validateQuery(periodQuerySchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };
      const query = c.get("validatedQuery") as PeriodQuery;

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const rawTransactions = await clickhouse.query<{
        timestamp: string;
        blockchain: string;
        transaction_hash: string;
        value: number;
        from_address: string;
        to_address: string;
      }>(
        `
        SELECT *
        FROM whale_transactions FINAL
        WHERE blockchain = {blockchain:String}
          AND timestamp >= {from:DateTime64(3)}
          AND timestamp <= {to:DateTime64(3)}
        ORDER BY timestamp DESC, value DESC
        LIMIT {limit:UInt32}
      `,
        {
          blockchain,
          from: query.from,
          to: query.to,
          limit: query.limit,
        }
      );

      const transactions = rawTransactions.map((tx) => ({
        timestamp: new Date(tx.timestamp).getTime(),
        blockchain: tx.blockchain,
        transactionHash: tx.transaction_hash,
        value: tx.value,
        from: tx.from_address,
        to: tx.to_address,
      }));

      return c.json({
        success: true,
        data: transactions,
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/market-data/on-chain/summary/:blockchain - Get summary statistics
   */
  app.get(
    "/api/market-data/on-chain/summary/:blockchain",
    validateParams(blockchainParamSchema),
    validateQuery(periodQuerySchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };
      const query = c.get("validatedQuery") as PeriodQuery;

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const summary = await clickhouse.query<{
        avg_whale_tx_count: number;
        total_whale_tx_volume: number;
        avg_exchange_inflow: number;
        avg_exchange_outflow: number;
        avg_active_addresses: number;
        avg_nvt_ratio: number;
      }>(
        `
        SELECT
          AVG(whale_tx_count) as avg_whale_tx_count,
          SUM(whale_tx_volume) as total_whale_tx_volume,
          AVG(exchange_inflow) as avg_exchange_inflow,
          AVG(exchange_outflow) as avg_exchange_outflow,
          AVG(active_addresses) as avg_active_addresses,
          AVG(nvt_ratio) as avg_nvt_ratio
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
          AND timestamp >= {from:DateTime64(3)}
          AND timestamp <= {to:DateTime64(3)}
      `,
        {
          blockchain,
          from: query.from,
          to: query.to,
        }
      );

      return c.json({
        success: true,
        data: {
          blockchain,
          period: {
            from: query.from,
            to: query.to,
          },
          summary: summary[0] ?? {},
        },
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/market-data/on-chain/exchange-reserves/:blockchain - Get exchange reserves
   */
  app.get(
    "/api/market-data/on-chain/exchange-reserves/:blockchain",
    validateParams(blockchainParamSchema),
    validateQuery(periodQuerySchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };
      const query = c.get("validatedQuery") as PeriodQuery;

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const reserves = await clickhouse.query<{
        timestamp: string;
        exchange: string;
        inflow: number;
        outflow: number;
        net_flow: number;
      }>(
        `
        SELECT
          timestamp,
          exchange,
          inflow,
          outflow,
          net_flow
        FROM exchange_flows
        WHERE blockchain = {blockchain:String}
          AND timestamp >= {from:DateTime64(3)}
          AND timestamp <= {to:DateTime64(3)}
        ORDER BY timestamp DESC, exchange
        LIMIT {limit:UInt32}
      `,
        {
          blockchain,
          from: query.from,
          to: query.to,
          limit: query.limit,
        }
      );

      return c.json({
        success: true,
        data: {
          blockchain,
          reserves: reserves.map((r) => ({
            timestamp: new Date(r.timestamp).getTime(),
            exchange: r.exchange,
            inflow: r.inflow,
            outflow: r.outflow,
            netFlow: r.net_flow,
          })),
        },
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/market-data/on-chain/metrics/:blockchain/chart - Get metrics for charting
   */
  app.get(
    "/api/market-data/on-chain/metrics/:blockchain/chart",
    validateParams(blockchainParamSchema),
    validateQuery(periodQuerySchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };
      const query = c.get("validatedQuery") as PeriodQuery;
      const interval = c.req.query("interval") ?? "1h";

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      let groupByClause = "toStartOfHour(timestamp)";
      if (interval === "6h") {
        groupByClause =
          "toDateTime(toUnixTimestamp(timestamp) - (toUnixTimestamp(timestamp) % 21600))";
      } else if (interval === "1d") {
        groupByClause = "toStartOfDay(timestamp)";
      }

      const chartData = await clickhouse.query<{
        time_bucket: string;
        avg_whale_tx_count: number;
        avg_whale_tx_volume: number;
        avg_exchange_inflow: number;
        avg_exchange_outflow: number;
        avg_exchange_net_flow: number;
        avg_active_addresses: number;
        avg_nvt_ratio: number;
      }>(
        `
        SELECT
          ${groupByClause} as time_bucket,
          AVG(whale_tx_count) as avg_whale_tx_count,
          AVG(whale_tx_volume) as avg_whale_tx_volume,
          AVG(exchange_inflow) as avg_exchange_inflow,
          AVG(exchange_outflow) as avg_exchange_outflow,
          AVG(exchange_net_flow) as avg_exchange_net_flow,
          AVG(active_addresses) as avg_active_addresses,
          AVG(nvt_ratio) as avg_nvt_ratio
        FROM on_chain_metrics
        WHERE blockchain = {blockchain:String}
          AND timestamp >= {from:DateTime64(3)}
          AND timestamp <= {to:DateTime64(3)}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      `,
        {
          blockchain,
          from: query.from,
          to: query.to,
        }
      );

      return c.json({
        success: true,
        data: {
          blockchain,
          interval,
          chart: chartData.map((row) => ({
            timestamp: new Date(row.time_bucket).getTime(),
            whaleTxCount: row.avg_whale_tx_count,
            whaleTxVolume: row.avg_whale_tx_volume,
            exchangeInflow: row.avg_exchange_inflow,
            exchangeOutflow: row.avg_exchange_outflow,
            exchangeNetFlow: row.avg_exchange_net_flow,
            activeAddresses: row.avg_active_addresses,
            nvtRatio: row.avg_nvt_ratio,
          })),
        },
        timestamp: Date.now(),
      });
    }
  );

  /**
   * GET /api/market-data/on-chain/comparison - Compare BTC vs ETH metrics
   */
  app.get("/api/market-data/on-chain/comparison", async (c: Context) => {
    if (!clickhouse) {
      throw new NotFoundError("ClickHouse connection");
    }

    try {
      // Fetch latest metrics for both blockchains
      const [btcMetrics, ethMetrics] = await Promise.all([
        clickhouse.query<{
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
        }>(
          `
          SELECT *
          FROM on_chain_metrics
          WHERE blockchain = 'BTC'
          ORDER BY timestamp DESC
          LIMIT 1
        `
        ),
        clickhouse.query<{
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
        }>(
          `
          SELECT *
          FROM on_chain_metrics
          WHERE blockchain = 'ETH'
          ORDER BY timestamp DESC
          LIMIT 1
        `
        ),
      ]);

      const mapToMetrics = (raw: {
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
      }): OnChainMetrics => ({
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
      });

      return c.json({
        success: true,
        data: {
          btc: btcMetrics.length > 0 ? mapToMetrics(btcMetrics[0]) : null,
          eth: ethMetrics.length > 0 ? mapToMetrics(ethMetrics[0]) : null,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorAny = error as { message?: string };
      return c.json(
        {
          success: false,
          error: {
            code: "COMPARISON_ERROR",
            message: errorAny.message || "Failed to compare metrics",
          },
          timestamp: Date.now(),
        },
        500
      );
    }
  });

  /**
   * GET /api/market-data/on-chain/correlations/:blockchain - Get metric correlations
   */
  app.get(
    "/api/market-data/on-chain/correlations/:blockchain",
    validateParams(blockchainParamSchema),
    validateQuery(periodQuerySchema),
    async (c: Context) => {
      const { blockchain } = c.get("validatedParams") as {
        blockchain: string;
      };
      const query = c.get("validatedQuery") as PeriodQuery;

      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      try {
        // Fetch historical data for correlation analysis
        const metrics = await clickhouse.query<{
          mvrv_ratio: number | null;
          nupl: number | null;
          reserve_risk: number | null;
          exchange_net_flow: number;
          whale_tx_count: number;
          active_addresses: number;
          puell_multiple: number | null;
          sopr: number | null;
        }>(
          `
          SELECT 
            mvrv_ratio,
            nupl,
            reserve_risk,
            exchange_net_flow,
            whale_tx_count,
            active_addresses,
            puell_multiple,
            sopr
          FROM on_chain_metrics
          WHERE blockchain = {blockchain:String}
            AND timestamp >= {from:DateTime64(3)}
            AND timestamp <= {to:DateTime64(3)}
          ORDER BY timestamp ASC
        `,
          {
            blockchain,
            from: query.from,
            to: query.to,
          }
        );

        // Calculate correlations between metrics
        const metricNames = [
          "mvrv_ratio",
          "nupl",
          "reserve_risk",
          "exchange_net_flow",
          "whale_tx_count",
          "active_addresses",
          "puell_multiple",
          "sopr",
        ];

        const correlationMatrix: Record<string, Record<string, number>> = {};

        // Initialize correlation matrix
        for (const metric1 of metricNames) {
          correlationMatrix[metric1] = {};
          for (const metric2 of metricNames) {
            correlationMatrix[metric1][metric2] = 0;
          }
        }

        // Calculate Pearson correlation coefficient for each pair
        for (const metric1 of metricNames) {
          for (const metric2 of metricNames) {
            if (metric1 === metric2) {
              correlationMatrix[metric1][metric2] = 1;
              continue;
            }

            const values1: number[] = [];
            const values2: number[] = [];

            for (const row of metrics) {
              const val1 = row[metric1 as keyof typeof row];
              const val2 = row[metric2 as keyof typeof row];

              if (
                val1 !== null &&
                val1 !== undefined &&
                val2 !== null &&
                val2 !== undefined
              ) {
                values1.push(Number(val1));
                values2.push(Number(val2));
              }
            }

            if (values1.length > 1) {
              const correlation = calculatePearsonCorrelation(values1, values2);
              correlationMatrix[metric1][metric2] = correlation;
            }
          }
        }

        return c.json({
          success: true,
          data: {
            blockchain,
            period: {
              from: query.from,
              to: query.to,
            },
            correlationMatrix,
            metricNames,
            dataPoints: metrics.length,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: {
              code: "CORRELATION_ERROR",
              message: errorAny.message || "Failed to calculate correlations",
            },
            timestamp: Date.now(),
          },
          500
        );
      }
    }
  );
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || n !== y.length) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] ?? 0), 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;

  return numerator / denominator;
}
