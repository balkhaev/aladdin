/**
 * Portfolio Summary Card Component
 * Displays comprehensive portfolio summary using single API request
 * More efficient than multiple separate requests
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Link2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolioSummary } from "@/hooks/use-portfolio-summary";

type PortfolioSummaryCardProps = {
  portfolioId: string;
};

const PERCENT_DECIMALS = 2;
const METRIC_DECIMALS = 2;
const TOP_ITEMS_LIMIT = 3;
const HIGH_CORRELATION_THRESHOLD = 0.8;

export function PortfolioSummaryCard({
  portfolioId,
}: PortfolioSummaryCardProps) {
  const { data: summary, isLoading, error } = usePortfolioSummary(portfolioId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load portfolio summary
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    return `${value.toFixed(PERCENT_DECIMALS)}%`;
  };

  const formatMetric = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    return value.toFixed(METRIC_DECIMALS);
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) {
      return "N/A";
    }
    return value.toFixed(PERCENT_DECIMALS);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Portfolio Summary</CardTitle>
          <Badge className="text-xs" variant="outline">
            Single API Request
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">
          Comprehensive metrics loaded efficiently
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Performance Metrics */}
        {summary.performance && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Performance</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Sharpe Ratio
                </div>
                <div className="font-bold text-lg">
                  {formatMetric(summary.performance.sharpeRatio)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Sortino Ratio
                </div>
                <div className="font-bold text-lg">
                  {formatMetric(summary.performance.sortinoRatio)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Max Drawdown
                </div>
                <div className="font-bold text-lg text-red-500">
                  {formatPercent(summary.performance.maxDrawdown)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trading Stats */}
        {summary.trading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              <h3 className="font-semibold text-sm">Trading</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Total Trades
                </div>
                <div className="font-bold text-lg">
                  {summary.trading.totalTrades}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">Win Rate</div>
                <div className="font-bold text-green-500 text-lg">
                  {formatPercent(summary.trading.winRate)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Profit Factor
                </div>
                <div className="font-bold text-lg">
                  {formatMetric(summary.trading.profitFactor)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">Largest Win</div>
                <div className="font-bold text-green-500 text-lg">
                  ${formatMetric(summary.trading.largestWin)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Risk Metrics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="font-semibold text-sm">Risk</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-muted-foreground text-xs">VaR (95%)</div>
              <div className="font-bold text-lg text-red-500">
                {summary.risk.var95
                  ? `$${formatMetric(summary.risk.var95)}`
                  : "N/A"}
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-muted-foreground text-xs">VaR (99%)</div>
              <div className="font-bold text-lg text-red-600">
                {summary.risk.var99
                  ? `$${formatMetric(summary.risk.var99)}`
                  : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Correlations */}
        {summary.correlations && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-500" />
              <h3 className="font-semibold text-sm">Correlations</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Diversification Score
                </div>
                <div className="font-bold text-lg">
                  {formatMetric(summary.correlations.diversificationScore)}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground text-xs">
                  Avg Correlation
                </div>
                <div className="font-bold text-lg">
                  {formatMetric(summary.correlations.avgCorrelation)}
                </div>
              </div>
            </div>
            {summary.correlations.highlyCorrelated.length > 0 && (
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs">
                  Highly Correlated Assets:
                </div>
                {summary.correlations.highlyCorrelated.map((pair, idx) => (
                  <div
                    className="flex items-center justify-between rounded-md border bg-card p-2"
                    key={idx}
                  >
                    <span className="text-sm">
                      {pair.symbol1} ↔ {pair.symbol2}
                    </span>
                    <Badge
                      className="text-xs"
                      variant={
                        pair.correlation > HIGH_CORRELATION_THRESHOLD
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {formatMetric(pair.correlation)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Market Context */}
        {summary.market && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold text-sm">Market Context</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs">Top Gainers</div>
                {summary.market.topGainers
                  .slice(0, TOP_ITEMS_LIMIT)
                  .map((gainer) => (
                    <div
                      className="flex items-center justify-between text-xs"
                      key={gainer.symbol}
                    >
                      <span>{gainer.symbol.replace("USDT", "")}</span>
                      <span className="font-semibold text-green-500">
                        +{formatNumber(gainer.changePercent24h)}%
                      </span>
                    </div>
                  ))}
              </div>
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs">Top Losers</div>
                {summary.market.topLosers
                  .slice(0, TOP_ITEMS_LIMIT)
                  .map((loser) => (
                    <div
                      className="flex items-center justify-between text-xs"
                      key={loser.symbol}
                    >
                      <span>{loser.symbol.replace("USDT", "")}</span>
                      <span className="font-semibold text-red-500">
                        {formatPercent(loser.changePercent24h)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Generated At */}
        <div className="text-right text-muted-foreground text-xs">
          Generated: {new Date(summary.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
