/**
 * Trading Statistics Card Component
 * Отображает статистику торговли (win rate, PnL, Sharpe ratio и т.д.)
 */

import { BarChart3, TrendingUp } from "lucide-react";
import { useTradingStatistics } from "../hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";

type AnalyticsStatisticsCardProps = {
  portfolioId: string;
  from?: string;
  to?: string;
};

export function AnalyticsStatisticsCard({
  portfolioId,
  from,
  to,
}: AnalyticsStatisticsCardProps) {
  const { data: stats, isLoading } = useTradingStatistics({
    portfolioId,
    from,
    to,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Статистика торговли
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Статистика торговли
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Нет данных по статистике
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return "text-green-600";
    if (rate >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getSharpeColor = (sharpe: number) => {
    if (sharpe >= 2) return "text-green-600";
    if (sharpe >= 1) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Статистика торговли
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total PnL */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Общий P&L</p>
          <p
            className={`font-bold text-3xl ${
              stats.totalPnL >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatCurrency(stats.totalPnL)}
          </p>
        </div>

        {/* Trades Summary */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Всего сделок</span>
            <span className="font-semibold">{stats.totalTrades}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Прибыльных</span>
            <span className="font-semibold text-green-600">
              {stats.winningTrades}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Убыточных</span>
            <span className="font-semibold text-red-600">
              {stats.losingTrades}
            </span>
          </div>
        </div>

        {/* Win Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Win Rate</span>
            <span
              className={`font-bold text-xl ${getWinRateColor(stats.winRate)}`}
            >
              {stats.winRate.toFixed(1)}%
            </span>
          </div>
          <Progress value={stats.winRate} />
        </div>

        {/* Average Profit/Loss */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Средняя прибыль</p>
            <p className="font-semibold text-green-600">
              {formatCurrency(stats.averageProfit)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Средний убыток</p>
            <p className="font-semibold text-red-600">
              {formatCurrency(stats.averageLoss)}
            </p>
          </div>
        </div>

        {/* Sharpe Ratio */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Sharpe Ratio</span>
            <span className={`font-bold ${getSharpeColor(stats.sharpeRatio)}`}>
              {stats.sharpeRatio.toFixed(2)}
            </span>
          </div>
          <div className="rounded-md bg-muted p-2 text-xs">
            <p className="text-muted-foreground">
              {stats.sharpeRatio >= 2 &&
                "Отлично! Высокая доходность с учетом риска"}
              {stats.sharpeRatio >= 1 &&
                stats.sharpeRatio < 2 &&
                "Хорошо. Доходность превышает риск"}
              {stats.sharpeRatio < 1 && "Низкая доходность с учетом риска"}
            </p>
          </div>
        </div>

        {/* Max Drawdown */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Макс. просадка
            </span>
            <span className="font-bold text-red-600">
              {stats.maxDrawdown.toFixed(2)}%
            </span>
          </div>
          <div className="rounded-md bg-muted p-2 text-xs">
            <p className="text-muted-foreground">
              Максимальное снижение стоимости портфеля от пика
            </p>
          </div>
        </div>

        {/* Period */}
        {stats.period && (
          <div className="border-t pt-3 text-muted-foreground text-xs">
            <p>
              Период: {new Date(stats.period.from).toLocaleDateString()} -{" "}
              {new Date(stats.period.to).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
