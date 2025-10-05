import type { ClickHouseClient } from "@aladdin/clickhouse";
import { NotFoundError } from "@aladdin/http/errors";
import {
  validateParams,
  validateQuery,
} from "@aladdin/validation/middleware";
import type { OnChainMetrics } from "@aladdin/core";
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
}
