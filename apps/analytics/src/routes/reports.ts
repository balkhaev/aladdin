/**
 * Reports and Backtesting Routes
 */

import { validateBody, validateQuery } from "@aladdin/validation/middleware";
import {
  type BacktestStrategy,
  backtestStrategySchema,
  type GetReportsQuery,
  getReportsQuerySchema,
} from "@aladdin/validation/schemas/analytics";
import type { Hono } from "hono";
import { HTTP_STATUS } from "../config";
import type { AnalyticsService } from "../services/analytics";

/**
 * Helper function to format report as CSV
 */
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

export function setupReportsRoutes(app: Hono, service: AnalyticsService): void {
  /**
   * POST /api/analytics/backtest - Run strategy backtest
   */
  app.post(
    "/api/analytics/backtest",
    validateBody(backtestStrategySchema),
    async (c) => {
      const body = c.get("validatedBody") as BacktestStrategy;

      const result = await service.runBacktest(
        body.symbol,
        body.strategy,
        body.from,
        body.to,
        body.initialBalance,
        body.parameters,
        body.timeframe
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
    validateQuery(getReportsQuerySchema),
    async (c) => {
      const query = c.get("validatedQuery") as GetReportsQuery;

      const report = await service.generateReport(
        query.portfolioId,
        query.from,
        query.to
      );

      // Format as CSV if requested
      if (query.format === "csv") {
        const csv = formatReportAsCSV(report);
        return c.text(csv, HTTP_STATUS.OK, {
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
}
