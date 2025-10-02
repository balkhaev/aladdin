import { errorHandlerMiddleware, NotFoundError } from "@aladdin/shared/errors";
import {
  validateParams,
  validateQuery,
} from "@aladdin/shared/middleware/validation";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { OnChainMetrics } from "@aladdin/shared/types";
import type { Context } from "hono";
import { OnChainService } from "./services/on-chain";
import {
  blockchainParamSchema,
  type MetricsQuery,
  metricsQuerySchema,
  type PeriodQuery,
  periodQuerySchema,
} from "./validation/schemas";
import "dotenv/config";

// Константы
const DEFAULT_PORT = 3015;
const DEFAULT_UPDATE_INTERVAL = 300_000;
const DEFAULT_WHALE_THRESHOLD_BTC = 10;
const DEFAULT_WHALE_THRESHOLD_ETH = 100;

initializeService({
  serviceName: "on-chain",
  port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,

  dependencies: {
    nats: true,
    clickhouse: true,
  },

  createService: (deps) =>
    new OnChainService({
      ...deps,
      cmcApiKey: process.env.CMC_API_KEY ?? "",
      enabledChains: process.env.ENABLED_CHAINS ?? "BTC,ETH",
      updateIntervalMs: process.env.UPDATE_INTERVAL_MS
        ? Number(process.env.UPDATE_INTERVAL_MS)
        : DEFAULT_UPDATE_INTERVAL,
      whaleThresholdBTC: process.env.WHALE_THRESHOLD_BTC
        ? Number(process.env.WHALE_THRESHOLD_BTC)
        : DEFAULT_WHALE_THRESHOLD_BTC,
      whaleThresholdETH: process.env.WHALE_THRESHOLD_ETH
        ? Number(process.env.WHALE_THRESHOLD_ETH)
        : DEFAULT_WHALE_THRESHOLD_ETH,
      blockchairApiKey: process.env.BLOCKCHAIR_API_KEY,
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
    }),

  afterInit: async (service, deps) => {
    // Initialize ClickHouse schema
    const clickhouse = service.clickhouseClient;
    if (clickhouse) {
      deps.logger.info("Initializing ClickHouse schema");

      try {
        // Main metrics table
        await clickhouse.command(`
          CREATE TABLE IF NOT EXISTS on_chain_metrics (
            timestamp DateTime64(3),
            blockchain String,
            whale_tx_count UInt32,
            whale_tx_volume Float64,
            exchange_inflow Float64,
            exchange_outflow Float64,
            exchange_net_flow Float64,
            active_addresses UInt32,
            nvt_ratio Float64,
            market_cap Nullable(Float64),
            transaction_volume Float64,
            mvrv_ratio Nullable(Float64),
            sopr Nullable(Float64),
            puell_multiple Nullable(Float64),
            stock_to_flow Nullable(Float64),
            nupl Nullable(Float64),
            exchange_reserve Nullable(Float64)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (blockchain, timestamp)
        `);

        // Whale transactions detail table
        // Using ReplacingMergeTree to automatically deduplicate transactions by hash
        await clickhouse.command(`
          CREATE TABLE IF NOT EXISTS whale_transactions (
            timestamp DateTime64(3),
            blockchain String,
            transaction_hash String,
            value Float64,
            from_address String,
            to_address String
          ) ENGINE = ReplacingMergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (blockchain, transaction_hash)
          PRIMARY KEY (blockchain, transaction_hash)
        `);

        // Whale alerts table for real-time notifications
        await clickhouse.command(`
          CREATE TABLE IF NOT EXISTS whale_alerts (
            timestamp DateTime64(3),
            blockchain String,
            alert_type String,
            transaction_hash String,
            value Float64,
            from_address String,
            to_address String,
            exchange String,
            is_inflow UInt8,
            usd_value Nullable(Float64)
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (blockchain, timestamp)
        `);

        // Exchange flow details table (per-exchange tracking)
        await clickhouse.command(`
          CREATE TABLE IF NOT EXISTS exchange_flows (
            timestamp DateTime64(3),
            blockchain String,
            exchange String,
            inflow Float64,
            outflow Float64,
            net_flow Float64,
            inflow_tx_count UInt32,
            outflow_tx_count UInt32
          ) ENGINE = MergeTree()
          PARTITION BY toYYYYMM(timestamp)
          ORDER BY (blockchain, exchange, timestamp)
        `);

        deps.logger.info("ClickHouse schema initialized");
      } catch (error) {
        deps.logger.error("Failed to initialize ClickHouse schema", error);
        throw error;
      }
    }
  },

  setupRoutes: (app, service) => {
    // Apply error handling middleware
    app.use("*", errorHandlerMiddleware());

    /**
     * GET /api/on-chain/metrics/:blockchain - Get historical metrics for a blockchain
     */
    app.get(
      "/api/on-chain/metrics/:blockchain",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateParams(blockchainParamSchema as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(metricsQuerySchema as any),
      async (c: Context) => {
        const { blockchain } = c.get("validatedParams") as {
          blockchain: string;
        };
        const query = c.get("validatedQuery") as MetricsQuery;

        const clickhouse = service.clickhouseClient;
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
     * GET /api/on-chain/metrics/:blockchain/latest - Get latest metrics
     */
    app.get(
      "/api/on-chain/metrics/:blockchain/latest",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateParams(blockchainParamSchema as any),
      async (c: Context) => {
        const { blockchain } = c.get("validatedParams") as {
          blockchain: string;
        };

        const clickhouse = service.clickhouseClient;
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

        // Transform to OnChainMetrics format
        const metrics: OnChainMetrics = {
          timestamp: new Date(raw.timestamp).getTime(), // ClickHouse DateTime64(3) to ms
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
        };

        return c.json({
          success: true,
          data: metrics,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * GET /api/on-chain/whale-transactions/:blockchain - Get whale transactions
     */
    app.get(
      "/api/on-chain/whale-transactions/:blockchain",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateParams(blockchainParamSchema as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(periodQuerySchema as any),
      async (c: Context) => {
        const { blockchain } = c.get("validatedParams") as {
          blockchain: string;
        };
        const query = c.get("validatedQuery") as PeriodQuery;

        const clickhouse = service.clickhouseClient;
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

        // Transform to frontend-friendly format
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
     * GET /api/on-chain/summary/:blockchain - Get summary statistics
     */
    app.get(
      "/api/on-chain/summary/:blockchain",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateParams(blockchainParamSchema as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(periodQuerySchema as any),
      async (c: Context) => {
        const { blockchain } = c.get("validatedParams") as {
          blockchain: string;
        };
        const query = c.get("validatedQuery") as PeriodQuery;

        const clickhouse = service.clickhouseClient;
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
     * GET /api/on-chain/alerts/recent - Get recent whale alerts
     */
    app.get("/api/on-chain/alerts/recent", async (c: Context) => {
      const blockchain = c.req.query("blockchain");
      const limit = c.req.query("limit");

      const scheduler = service.metricsScheduler;
      if (!scheduler) {
        throw new NotFoundError("Metrics scheduler");
      }

      const whaleAlertService = scheduler.getWhaleAlertService();
      const alerts = await whaleAlertService.getRecentAlerts(
        blockchain,
        limit ? Number.parseInt(limit) : undefined
      );

      return c.json({
        success: true,
        data: alerts,
        timestamp: Date.now(),
      });
    });

    /**
     * GET /api/on-chain/exchange-reserves/:blockchain - Get exchange reserve balance over time
     */
    app.get(
      "/api/on-chain/exchange-reserves/:blockchain",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateParams(blockchainParamSchema as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(periodQuerySchema as any),
      async (c: Context) => {
        const { blockchain } = c.get("validatedParams") as {
          blockchain: string;
        };
        const query = c.get("validatedQuery") as PeriodQuery;

        const clickhouse = service.clickhouseClient;
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
     * GET /api/on-chain/metrics/:blockchain/chart - Get metrics for charting (aggregated)
     */
    app.get(
      "/api/on-chain/metrics/:blockchain/chart",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateParams(blockchainParamSchema as any),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(periodQuerySchema as any),
      async (c: Context) => {
        const { blockchain } = c.get("validatedParams") as {
          blockchain: string;
        };
        const query = c.get("validatedQuery") as PeriodQuery;
        const interval = c.req.query("interval") ?? "1h"; // 1h, 6h, 1d

        const clickhouse = service.clickhouseClient;
        if (!clickhouse) {
          throw new NotFoundError("ClickHouse connection");
        }

        // Determine grouping interval
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
  },
});
