/**
 * Portfolio Summary Dashboard
 * Comprehensive dashboard with all portfolio metrics in one view
 */

import {
  Activity,
  AlertTriangle,
  Network,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortfolioSummary } from "@/hooks/use-advanced-metrics";
import { AdvancedMetricsGrid } from "./advanced-metrics-grid";
import { SentimentCard } from "./sentiment-card";
import { TradingStatsCard } from "./trading-stats-card";

interface PortfolioSummaryDashboardProps {
  portfolioId: string;
}

export function PortfolioSummaryDashboard({
  portfolioId,
}: PortfolioSummaryDashboardProps) {
  const { data: summary, isLoading, error } = usePortfolioSummary(portfolioId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton className="h-40" key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-muted-foreground text-sm">
            Failed to load portfolio summary
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Overview */}
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {/* Sharpe Ratio */}
        {summary.performance && (
          <QuickStatCard
            icon={<Activity className="h-4 w-4" />}
            title="Sharpe Ratio"
            trend={summary.performance.sharpeRatio > 1 ? "up" : "down"}
            value={summary.performance.sharpeRatio.toFixed(2)}
          />
        )}

        {/* Max Drawdown */}
        {summary.risk.maxDrawdown !== null && (
          <QuickStatCard
            icon={<TrendingDown className="h-4 w-4" />}
            title="Max Drawdown"
            trend={summary.risk.maxDrawdown < 10 ? "up" : "down"}
            value={`${summary.risk.maxDrawdown.toFixed(2)}%`}
          />
        )}

        {/* Win Rate */}
        {summary.trading && (
          <QuickStatCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="Win Rate"
            trend={summary.trading.winRate > 50 ? "up" : "down"}
            value={`${summary.trading.winRate.toFixed(1)}%`}
          />
        )}

        {/* Diversification */}
        {summary.correlations && (
          <QuickStatCard
            icon={<Network className="h-4 w-4" />}
            title="Diversification"
            trend={
              summary.correlations.diversificationScore > 50 ? "up" : "down"
            }
            value={summary.correlations.diversificationScore.toFixed(0)}
          />
        )}
      </div>

      {/* Tabs for Different Sections */}
      <Tabs className="space-y-4" defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="market">Market</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent className="space-y-4" value="performance">
          {summary.performance ? (
            <AdvancedMetricsGrid portfolioId={portfolioId} />
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-muted-foreground text-sm">
                  No performance data available
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trading Tab */}
        <TabsContent className="space-y-4" value="trading">
          {summary.trading ? (
            <TradingStatsCard portfolioId={portfolioId} />
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-muted-foreground text-sm">
                  No trading data available
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Risk Tab */}
        <TabsContent className="space-y-4" value="risk">
          <div className="grid gap-4 md:grid-cols-2">
            {/* VaR Card */}
            <Card>
              <CardHeader>
                <CardTitle>Value at Risk (VaR)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      VaR 95%
                    </span>
                    <span className="font-bold text-2xl text-red-500">
                      ${summary.risk.var95?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      VaR 99%
                    </span>
                    <span className="font-bold text-2xl text-red-600">
                      ${summary.risk.var99?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Maximum expected loss at 95% and 99% confidence levels
                </p>
              </CardContent>
            </Card>

            {/* Correlations Card */}
            {summary.correlations && (
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Diversification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Diversification Score
                      </span>
                      <Badge
                        variant={
                          summary.correlations.diversificationScore > 60
                            ? "default"
                            : "secondary"
                        }
                      >
                        {summary.correlations.diversificationScore.toFixed(0)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">
                        Avg Correlation
                      </span>
                      <span className="font-semibold text-lg">
                        {summary.correlations.avgCorrelation.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {summary.correlations.highlyCorrelated.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-muted-foreground text-xs">
                        Highly Correlated Pairs:
                      </div>
                      {summary.correlations.highlyCorrelated.map((pair, i) => (
                        <div
                          className="flex items-center justify-between rounded bg-muted/50 p-2 text-xs"
                          key={i}
                        >
                          <span>
                            {pair.symbol1} ↔ {pair.symbol2}
                          </span>
                          <Badge variant="outline">
                            {pair.correlation.toFixed(2)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Market Tab */}
        <TabsContent className="space-y-4" value="market">
          {summary.market && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Top Gainers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Top Gainers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.market.topGainers.map((coin, i) => (
                      <div
                        className="flex items-center justify-between rounded p-2 hover:bg-muted/50"
                        key={i}
                      >
                        <div>
                          <div className="font-medium">{coin.symbol}</div>
                          <div className="text-muted-foreground text-xs">
                            ${coin.price.toFixed(2)}
                          </div>
                        </div>
                        <Badge className="bg-green-500">
                          +{coin.changePercent24h.toFixed(2)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Losers */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    Top Losers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {summary.market.topLosers.map((coin, i) => (
                      <div
                        className="flex items-center justify-between rounded p-2 hover:bg-muted/50"
                        key={i}
                      >
                        <div>
                          <div className="font-medium">{coin.symbol}</div>
                          <div className="text-muted-foreground text-xs">
                            ${coin.price.toFixed(2)}
                          </div>
                        </div>
                        <Badge className="bg-red-500">
                          {coin.changePercent24h.toFixed(2)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface QuickStatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: "up" | "down";
}

function QuickStatCard({ title, value, icon, trend }: QuickStatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div
          className={`font-bold text-2xl ${trend === "up" ? "text-green-500" : "text-red-500"}`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
