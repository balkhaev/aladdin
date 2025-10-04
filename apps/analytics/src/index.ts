import { CacheService } from "@aladdin/shared/cache";
import {
  errorHandlerMiddleware,
  InternalServerError,
  ValidationError,
} from "@aladdin/shared/errors";
import {
  validateBody,
  validateQuery,
} from "@aladdin/shared/middleware/validation";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { Context } from "hono";
import { AnalyticsService } from "./services/analytics";
import { CombinedSentimentService } from "./services/sentiment/combined-sentiment";
import { SentimentAnalysisService } from "./services/sentiment/sentiment-analysis";
import {
  type BacktestStrategy,
  backtestStrategySchema,
  type IndicatorsQuery,
  indicatorsQuerySchema,
  type ReportsQuery,
  reportsQuerySchema,
  type StatisticsQuery,
  statisticsQuerySchema,
} from "./validation/schemas";
import "dotenv/config";

// Константы
const DEFAULT_PORT = 3014;
const CACHE_INDICATORS_TTL = 60;
const CACHE_MARKET_OVERVIEW_TTL = 120;
const CACHE_COMBINED_SENTIMENT_TTL = 120; // 2 minutes
const CACHE_ADVANCED_METRICS_TTL = 300;
const CACHE_SUMMARY_TTL = 60;
const DEFAULT_WINDOW = "30d";
const DEFAULT_BENCHMARK = "BTC";
const DEFAULT_DAYS_LOOKBACK = 30;
const MILLISECONDS_PER_DAY = 86_400_000;
const HTTP_OK_STATUS = 200;
const TOP_ITEMS_LIMIT = 5;
const VAR_CONFIDENCE = 95;
const VAR_TIME_WINDOW = 30;

// Cache service instance
let cacheService: CacheService | undefined;

// Sentiment analysis service instance
let sentimentService: SentimentAnalysisService | undefined;

// Combined sentiment service instance
let combinedSentimentService: CombinedSentimentService | undefined;

// Note: Sentiment aggregator from old sentiment service could be integrated here if needed

// Helper function to format report as CSV
function formatReportAsCSV(
  report: Awaited<ReturnType<AnalyticsService["generateReport"]>>
): string {
  const lines: string[] = [];

  // Header
  lines.push("# Portfolio Report");
  lines.push(`# Portfolio ID: ${report.portfolioId}`);
  lines.push(
    `# Period: ${report.period.from.toISOString()} to ${report.period.to.toISOString()}`
  );
  lines.push(`# Generated: ${report.generatedAt.toISOString()}`);
  lines.push("");

  // Statistics
  lines.push("# Statistics");
  lines.push("Metric,Value");
  lines.push(`Total Trades,${report.statistics.totalTrades}`);
  lines.push(`Total Volume,${report.statistics.totalVolume}`);
  lines.push(`Total P&L,${report.statistics.totalPnL}`);
  lines.push(`Win Rate,${report.statistics.winRate}%`);
  lines.push(`Average Profit,${report.statistics.avgProfit}`);
  lines.push(`Average Loss,${report.statistics.avgLoss}`);
  lines.push(`Sharpe Ratio,${report.statistics.sharpeRatio}`);
  lines.push(`Max Drawdown,${report.statistics.maxDrawdown}%`);
  lines.push("");

  // Risk Metrics
  lines.push("# Risk Metrics");
  lines.push("Metric,Value");
  lines.push(`VaR 95%,${report.riskMetrics.var95}`);
  lines.push(`VaR 99%,${report.riskMetrics.var99}`);
  lines.push(`Sharpe Ratio,${report.riskMetrics.sharpeRatio}`);
  lines.push(`Max Drawdown,${report.riskMetrics.maxDrawdown}%`);
  lines.push("");

  // Trades
  lines.push("# Trades");
  lines.push("Timestamp,Symbol,Side,Price,Quantity,P&L");
  for (const trade of report.trades) {
    lines.push(
      `${trade.timestamp},${trade.symbol},${trade.side},${trade.price},${trade.quantity},${trade.pnl}`
    );
  }

  return lines.join("\n");
}

initializeService({
  serviceName: "analytics",
  port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,

  dependencies: {
    clickhouse: true,
  },

  createService: (deps) => new AnalyticsService(deps),

  beforeInit: async (deps) => {
    await Promise.resolve(); // Ensure async
    // Initialize Redis cache
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      cacheService = new CacheService({
        redis: redisUrl,
        logger: deps.logger,
        keyPrefix: "analytics:",
        defaultTTL: CACHE_INDICATORS_TTL,
      });
      deps.logger.info("Redis cache initialized for analytics");
    } else {
      deps.logger.warn("Redis URL not configured, caching disabled");
    }

    // Initialize Sentiment Analysis service
    if (deps.clickhouse) {
      sentimentService = new SentimentAnalysisService(
        deps.clickhouse,
        deps.logger
      );
      deps.logger.info("Sentiment Analysis service initialized");

      // Initialize Combined Sentiment service
      const analyticsBaseUrl =
        process.env.ANALYTICS_BASE_URL || "http://localhost:3014";
      const marketDataBaseUrl =
        process.env.MARKET_DATA_BASE_URL || "http://localhost:3010";

      combinedSentimentService = new CombinedSentimentService(
        deps.logger,
        analyticsBaseUrl,
        marketDataBaseUrl
      );
      deps.logger.info("Combined Sentiment service initialized");
    }
  },

  setupRoutes: (app, service) => {
    // Apply error handling middleware
    app.use("*", errorHandlerMiddleware());

    /**
     * GET /api/analytics/indicators/:symbol - Get technical indicators
     */
    app.get(
      "/api/analytics/indicators/:symbol",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(indicatorsQuerySchema as any),
      async (c: Context) => {
        const symbol = c.req.param("symbol").toUpperCase();
        const query = c.get("validatedQuery") as IndicatorsQuery;

        // Try cache first
        if (cacheService) {
          const cacheKey = `indicators:${symbol}:${query.timeframe}:${query.indicators.join(",")}:${query.limit}`;
          const cached = await cacheService.get(cacheKey);
          if (cached) {
            return c.json({
              success: true,
              data: cached,
              timestamp: Date.now(),
            });
          }
        }

        const indicators = await service.calculateIndicators(
          symbol,
          query.indicators,
          query.timeframe,
          query.limit
        );

        // Cache for 60 seconds
        if (cacheService) {
          const cacheKey = `indicators:${symbol}:${query.timeframe}:${query.indicators.join(",")}:${query.limit}`;
          await cacheService.set(cacheKey, indicators, CACHE_INDICATORS_TTL);
        }

        return c.json({
          success: true,
          data: indicators,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * GET /api/analytics/statistics - Get trading statistics
     */
    app.get(
      "/api/analytics/statistics",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(statisticsQuerySchema as any),
      async (c: Context) => {
        // TODO: Get portfolioId from auth or query
        const query = c.get("validatedQuery") as StatisticsQuery;
        const portfolioId = query.portfolioId ?? "default-portfolio";

        const statistics = await service.getStatistics(
          portfolioId,
          query.from,
          query.to
        );

        return c.json({
          success: true,
          data: statistics,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * POST /api/analytics/backtest - Run strategy backtest
     */
    app.post(
      "/api/analytics/backtest",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateBody(backtestStrategySchema as any),
      async (c: Context) => {
        const body = c.get("validatedBody") as BacktestStrategy;

        const result = await service.runBacktest(
          body.symbol,
          body.strategy,
          body.from,
          body.to,
          body.initialBalance,
          body.parameters
        );

        return c.json({
          success: true,
          data: result,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * GET /api/analytics/reports - Generate report
     */
    app.get(
      "/api/analytics/reports",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateQuery(reportsQuerySchema as any),
      async (c: Context) => {
        const query = c.get("validatedQuery") as ReportsQuery;

        const report = await service.generateReport(
          query.portfolioId,
          query.from,
          query.to
        );

        // Format as CSV if requested
        if (query.format === "csv") {
          const csv = formatReportAsCSV(report);
          return c.text(csv, HTTP_OK_STATUS, {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="portfolio-report-${query.portfolioId}-${Date.now()}.csv"`,
          });
        }

        // Return JSON by default
        return c.json({
          success: true,
          data: report,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * GET /api/analytics/market-overview - Get market overview
     */
    app.get("/api/analytics/market-overview", async (c: Context) => {
      // Try cache first
      if (cacheService) {
        const cacheKey = "market-overview";
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return c.json({
            success: true,
            data: cached,
            timestamp: Date.now(),
          });
        }
      }

      const marketOverview = await service.getMarketOverview();

      // Cache for 2 minutes (market overview changes frequently)
      if (cacheService) {
        const cacheKey = "market-overview";
        await cacheService.set(
          cacheKey,
          marketOverview,
          CACHE_MARKET_OVERVIEW_TTL
        );
      }

      return c.json({
        success: true,
        data: marketOverview,
        timestamp: Date.now(),
      });
    });

    /**
     * GET /api/analytics/portfolio/:portfolioId/advanced-metrics
     * Get advanced performance metrics (Sortino, Calmar, Information Ratio, Omega, etc.)
     */
    app.get(
      "/api/analytics/portfolio/:portfolioId/advanced-metrics",
      async (c: Context) => {
        const portfolioId = c.req.param("portfolioId");
        const fromQuery = c.req.query("from");
        const toQuery = c.req.query("to");
        const benchmark = c.req.query("benchmark") ?? DEFAULT_BENCHMARK;

        // Default to last 30 days if not specified
        const from = fromQuery
          ? new Date(fromQuery)
          : new Date(Date.now() - DEFAULT_DAYS_LOOKBACK * MILLISECONDS_PER_DAY);
        const to = toQuery ? new Date(toQuery) : new Date();

        // Try cache first (longer TTL for historical data)
        if (cacheService) {
          const cacheKey = `advanced-metrics:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${benchmark}`;
          const cached = await cacheService.get(cacheKey);
          if (cached) {
            return c.json({
              success: true,
              data: cached,
              timestamp: Date.now(),
            });
          }
        }

        // Get advanced metrics from service
        const metrics = await service.getAdvancedMetrics(
          portfolioId,
          from,
          to,
          benchmark
        );

        // Cache for 5 minutes (historical data doesn't change often)
        if (cacheService) {
          const cacheKey = `advanced-metrics:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${benchmark}`;
          await cacheService.set(cacheKey, metrics, CACHE_ADVANCED_METRICS_TTL);
        }

        return c.json({
          success: true,
          data: metrics,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * GET /api/analytics/portfolio/:portfolioId/summary
     * Get comprehensive portfolio summary with all metrics in one call
     */
    app.get(
      "/api/analytics/portfolio/:portfolioId/summary",
      async (c: Context) => {
        const portfolioId = c.req.param("portfolioId");
        const fromQuery = c.req.query("from");
        const toQuery = c.req.query("to");
        const window =
          (c.req.query("window") as "7d" | "30d" | "90d" | "1y") ??
          DEFAULT_WINDOW;

        // Default to last 30 days if not specified
        const from = fromQuery
          ? new Date(fromQuery)
          : new Date(Date.now() - DEFAULT_DAYS_LOOKBACK * MILLISECONDS_PER_DAY);
        const to = toQuery ? new Date(toQuery) : new Date();

        // Try cache first
        if (cacheService) {
          const cacheKey = `summary:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${window}`;
          const cached = await cacheService.get(cacheKey);
          if (cached) {
            return c.json({
              success: true,
              data: cached,
              timestamp: Date.now(),
            });
          }
        }

        // Fetch all data in parallel for maximum performance
        const [advancedMetrics, marketOverview, riskMetrics, correlations] =
          await Promise.allSettled([
            // Advanced performance metrics
            service.getAdvancedMetrics(
              portfolioId,
              from,
              to,
              DEFAULT_BENCHMARK
            ),

            // Market overview
            service.getMarketOverview(),

            // Risk metrics (VaR) - call external Risk service
            fetch(
              `http://localhost:3013/api/risk/var?portfolioId=${portfolioId}&confidenceLevel=${VAR_CONFIDENCE}&timeHorizon=${VAR_TIME_WINDOW}`
            )
              .then((res) => res.json())
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then((data: any) => (data.success ? data.data : null))
              .catch(() => null),

            // Correlations - call external Risk service
            fetch(
              `http://localhost:3013/api/risk/portfolio/${portfolioId}/correlations?window=${window}`
            )
              .then((res) => res.json())
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .then((data: any) => (data.success ? data.data : null))
              .catch(() => null),
          ]);

        // Build summary response with error handling
        const summary = {
          portfolioId,
          period: {
            from,
            to,
          },
          performance:
            advancedMetrics.status === "fulfilled"
              ? advancedMetrics.value.performance
              : null,
          trading:
            advancedMetrics.status === "fulfilled"
              ? advancedMetrics.value.trading
              : null,
          risk: {
            var95:
              riskMetrics.status === "fulfilled" && riskMetrics.value
                ? (riskMetrics.value as any).var95
                : null,
            var99:
              riskMetrics.status === "fulfilled" && riskMetrics.value
                ? (riskMetrics.value as any).var99
                : null,
            sharpeRatio:
              riskMetrics.status === "fulfilled" && riskMetrics.value
                ? (riskMetrics.value as any).sharpeRatio
                : null,
            maxDrawdown:
              riskMetrics.status === "fulfilled" && riskMetrics.value
                ? (riskMetrics.value as any).maxDrawdown
                : null,
          },
          correlations:
            correlations.status === "fulfilled" && correlations.value
              ? {
                  diversificationScore: (correlations.value as any)
                    .diversificationScore,
                  avgCorrelation: (correlations.value as any).avgCorrelation,
                  highlyCorrelated:
                    (correlations.value as any).highlyCorrelated?.slice(
                      0,
                      TOP_ITEMS_LIMIT
                    ) ?? [],
                }
              : null,
          market:
            marketOverview.status === "fulfilled"
              ? {
                  topGainers: marketOverview.value.topGainers.slice(
                    0,
                    TOP_ITEMS_LIMIT
                  ),
                  topLosers: marketOverview.value.topLosers.slice(
                    0,
                    TOP_ITEMS_LIMIT
                  ),
                  totalVolume24h:
                    marketOverview.value.marketStats.totalVolume24h,
                  avgVolatility: marketOverview.value.marketStats.avgVolatility,
                }
              : null,
          generatedAt: new Date(),
        };

        // Cache for 60 seconds
        if (cacheService) {
          const cacheKey = `summary:${portfolioId}:${from.toISOString()}:${to.toISOString()}:${window}`;
          await cacheService.set(cacheKey, summary, CACHE_SUMMARY_TTL);
        }

        return c.json({
          success: true,
          data: summary,
          timestamp: Date.now(),
        });
      }
    );

    /**
     * GET /api/analytics/sentiment/batch
     * Get sentiment for multiple symbols
     * ВАЖНО: этот роут должен быть ПЕРЕД /api/analytics/sentiment/:symbol
     */
    app.get("/api/analytics/sentiment/batch", async (c: Context) => {
      const symbolsParam = c.req.query("symbols");

      if (!symbolsParam) {
        throw new ValidationError("symbols query parameter is required");
      }

      const symbols = symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase());

      // Check if sentiment service is initialized
      if (!sentimentService) {
        throw new InternalServerError(
          "Sentiment analysis service not initialized"
        );
      }

      // Calculate sentiment for all symbols in parallel
      const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
          // Try cache first
          if (cacheService) {
            const cacheKey = `sentiment:${symbol}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
              return { symbol, ...cached, cached: true };
            }
          }

          if (!sentimentService) {
            throw new Error("Sentiment service not initialized");
          }
          const sentiment =
            await sentimentService.getCompositeSentiment(symbol);

          // Cache for 2 minutes
          if (cacheService) {
            const cacheKey = `sentiment:${symbol}`;
            await cacheService.set(
              cacheKey,
              sentiment,
              CACHE_MARKET_OVERVIEW_TTL
            );
          }

          return sentiment;
        })
      );

      // Format results
      const sentiments = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<any>).value);

      const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason);

      return c.json({
        success: true,
        data: sentiments,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: Date.now(),
      });
    });

    /**
     * GET /api/analytics/sentiment/:symbol
     * Get composite sentiment analysis for a single symbol
     */
    app.get("/api/analytics/sentiment/:symbol", async (c: Context) => {
      const symbol = c.req.param("symbol").toUpperCase();

      // Check if sentiment service is initialized
      if (!sentimentService) {
        throw new InternalServerError(
          "Sentiment analysis service not initialized"
        );
      }

      // Try cache first
      if (cacheService) {
        const cacheKey = `sentiment:${symbol}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return c.json({
            success: true,
            data: cached,
            cached: true,
            timestamp: Date.now(),
          });
        }
      }

      // Calculate sentiment
      const sentiment = await sentimentService.getCompositeSentiment(symbol);

      // Cache for 2 minutes (sentiment changes frequently)
      if (cacheService) {
        const cacheKey = `sentiment:${symbol}`;
        await cacheService.set(cacheKey, sentiment, CACHE_MARKET_OVERVIEW_TTL);
      }

      return c.json({
        success: true,
        data: sentiment,
        timestamp: Date.now(),
      });
    });

    /**
     * GET /api/analytics/sentiment/:symbol/combined
     * Get combined sentiment analysis (Analytics + Futures + Order Book)
     */
    app.get("/api/analytics/sentiment/:symbol/combined", async (c: Context) => {
      const symbol = c.req.param("symbol").toUpperCase();

      // Check if combined sentiment service is initialized
      if (!combinedSentimentService) {
        throw new InternalServerError(
          "Combined sentiment service not initialized"
        );
      }

      // Try cache first
      if (cacheService) {
        const cacheKey = `combined-sentiment:${symbol}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return c.json({
            success: true,
            data: cached,
            cached: true,
            timestamp: Date.now(),
          });
        }
      }

      // Calculate combined sentiment
      const sentiment =
        await combinedSentimentService.getCombinedSentiment(symbol);

      // Cache for 2 minutes
      if (cacheService) {
        const cacheKey = `combined-sentiment:${symbol}`;
        await cacheService.set(
          cacheKey,
          sentiment,
          CACHE_COMBINED_SENTIMENT_TTL
        );
      }

      return c.json({
        success: true,
        data: sentiment,
        timestamp: Date.now(),
      });
    });

    /**
     * POST /api/analytics/sentiment/analyze-batch
     * Analyze sentiment for multiple symbols (backward compatibility with old sentiment service)
     */
    app.post("/api/analytics/sentiment/analyze-batch", async (c: Context) => {
      const body = await c.req.json();
      const symbols = body.symbols as string[];

      if (!symbols || !Array.isArray(symbols)) {
        throw new ValidationError("symbols array is required in request body");
      }
      
      if (symbols.length === 0) {
        throw new ValidationError("symbols array cannot be empty");
      }

      // Check if sentiment service is initialized
      if (!sentimentService) {
        throw new InternalServerError(
          "Sentiment analysis service not initialized"
        );
      }

      // Calculate sentiment for all symbols in parallel
      const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
          // Try cache first
          if (cacheService) {
            const cacheKey = `sentiment:${symbol}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
              return { symbol, ...cached, cached: true };
            }
          }

          if (!sentimentService) {
            throw new Error("Sentiment service not initialized");
          }
          const sentiment =
            await sentimentService.getCompositeSentiment(symbol);

          // Cache for 2 minutes
          if (cacheService) {
            const cacheKey = `sentiment:${symbol}`;
            await cacheService.set(
              cacheKey,
              sentiment,
              CACHE_MARKET_OVERVIEW_TTL
            );
          }

          return { symbol, ...sentiment };
        })
      );

      const sentiments = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<typeof r.value>).value);

      return c.json({
        success: true,
        data: sentiments,
        timestamp: Date.now(),
      });
    });

    /**
     * GET /api/analytics/sentiment/batch/combined
     * Get combined sentiment for multiple symbols
     */
    app.get("/api/analytics/sentiment/batch/combined", async (c: Context) => {
      const symbolsParam = c.req.query("symbols");

      if (!symbolsParam) {
        throw new ValidationError("symbols query parameter is required");
      }

      const symbols = symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase());

      // Check if combined sentiment service is initialized
      if (!combinedSentimentService) {
        throw new InternalServerError(
          "Combined sentiment service not initialized"
        );
      }

      // Calculate sentiment for all symbols in parallel
      const results = await Promise.allSettled(
        symbols.map(async (symbol) => {
          // Try cache first
          if (cacheService) {
            const cacheKey = `combined-sentiment:${symbol}`;
            const cached = await cacheService.get(cacheKey);
            if (cached) {
              return { symbol, ...cached, cached: true };
            }
          }

          if (!combinedSentimentService) {
            throw new Error("Combined sentiment service not initialized");
          }
          const sentiment =
            await combinedSentimentService.getCombinedSentiment(symbol);

          // Cache for 2 minutes
          if (cacheService) {
            const cacheKey = `combined-sentiment:${symbol}`;
            await cacheService.set(
              cacheKey,
              sentiment,
              CACHE_COMBINED_SENTIMENT_TTL
            );
          }

          return sentiment;
        })
      );

      // Format results
      const sentiments = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<unknown>).value);

      const errors = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason);

      return c.json({
        success: true,
        data: sentiments,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: Date.now(),
      });
    });

    /**
     * GET /api/analytics/cache/stats - Get cache statistics
     */
    app.get("/api/analytics/cache/stats", (c) => {
      if (!cacheService) {
        return c.json({
          success: false,
          error: {
            code: "CACHE_DISABLED",
            message: "Redis cache is not configured",
          },
          timestamp: Date.now(),
        });
      }

      const stats = cacheService.getStats();
      return c.json({
        success: true,
        data: {
          ...stats,
          enabled: true,
        },
        timestamp: Date.now(),
      });
    });

    /**
     * POST /api/analytics/cache/flush - Flush cache
     */
    app.post("/api/analytics/cache/flush", async (c) => {
      if (!cacheService) {
        return c.json({
          success: false,
          error: {
            code: "CACHE_DISABLED",
            message: "Redis cache is not configured",
          },
          timestamp: Date.now(),
        });
      }

      await cacheService.flush();
      return c.json({
        success: true,
        data: {
          message: "Cache flushed successfully",
        },
        timestamp: Date.now(),
      });
    });

    // Note: Sentiment aggregator endpoints would be added here if needed
    // The sentiment aggregator from the old sentiment service can be initialized
    // in beforeInit and used to aggregate sentiment from multiple sources
  },
});
