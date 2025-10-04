/**
 * Trading Statistics Card
 * Displays comprehensive trading performance statistics
 */

import { Activity, Award, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvancedMetrics } from "@/hooks/use-advanced-metrics";

// Trading statistics thresholds
const WIN_RATE_EXCELLENT_THRESHOLD = 60;
const WIN_RATE_GOOD_THRESHOLD = 50;
const PROFIT_FACTOR_EXCELLENT_THRESHOLD = 2;
const PROFIT_FACTOR_GOOD_THRESHOLD = 1.5;

type TradingStatsCardProps = {
  portfolioId: string;
  from?: Date;
  to?: Date;
};

export function TradingStatsCard({
  portfolioId,
  from,
  to,
}: TradingStatsCardProps) {
  const { data, isLoading, error } = useAdvancedMetrics(portfolioId, {
    from,
    to,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trading Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton className="h-16 w-full" key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trading Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load trading statistics
          </div>
        </CardContent>
      </Card>
    );
  }

  const { trading } = data;

  // Safe number formatting
  const safeNumber = (value: number | null | undefined): number => value ?? 0;

  const getWinRateColor = (winRate: number) => {
    if (winRate >= WIN_RATE_EXCELLENT_THRESHOLD) return "bg-green-500";
    if (winRate >= WIN_RATE_GOOD_THRESHOLD) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getProfitFactorColor = (pf: number) => {
    if (pf >= PROFIT_FACTOR_EXCELLENT_THRESHOLD) return "text-green-500";
    if (pf >= PROFIT_FACTOR_GOOD_THRESHOLD) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trading Statistics</CardTitle>
          <Badge variant="outline">{trading.totalTrades} trades</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Win Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Win Rate</span>
            </div>
            <Badge className={getWinRateColor(safeNumber(trading.winRate))}>
              {safeNumber(trading.winRate).toFixed(1)}%
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Winning Trades</div>
              <div className="font-semibold text-green-500 text-lg">
                {trading.winningTrades}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Losing Trades</div>
              <div className="font-semibold text-lg text-red-500">
                {trading.losingTrades}
              </div>
            </div>
          </div>
        </div>

        {/* Profit Factor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Profit Factor</span>
            </div>
            <span
              className={`font-bold text-xl ${getProfitFactorColor(safeNumber(trading.profitFactor))}`}
            >
              {safeNumber(trading.profitFactor).toFixed(2)}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Total wins / Total losses. Higher is better. {">"} 2 is excellent.
          </p>
        </div>

        {/* Average Win/Loss */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">Avg Win</span>
            </div>
            <div className="font-semibold text-green-500 text-lg">
              ${safeNumber(trading.avgWin).toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-muted-foreground">Avg Loss</span>
            </div>
            <div className="font-semibold text-lg text-red-500">
              ${safeNumber(trading.avgLoss).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Largest Win/Loss */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Largest Win</div>
            <div className="font-semibold text-green-500 text-lg">
              ${safeNumber(trading.largestWin).toFixed(2)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Largest Loss</div>
            <div className="font-semibold text-lg text-red-500">
              ${safeNumber(trading.largestLoss).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Consecutive Wins/Losses */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Max Win Streak</div>
            <div className="font-semibold text-lg">
              {trading.consecutiveWins}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">Max Loss Streak</div>
            <div className="font-semibold text-lg">
              {trading.consecutiveLosses}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
