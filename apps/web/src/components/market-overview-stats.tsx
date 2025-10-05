/**
 * Market Overview Statistics Component
 * Общая статистика рынка за 24 часа
 */

import { Activity, BarChart3, TrendingUp } from "lucide-react";
import { useMarketOverview } from "../hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const BILLION = 1_000_000_000;
const MILLION = 1_000_000;
const THOUSAND = 1000;

export function MarketOverviewStats() {
  const { data: marketData, isLoading } = useMarketOverview();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!marketData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Статистика рынка</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Нет данных</p>
        </CardContent>
      </Card>
    );
  }

  const { marketStats } = marketData;

  const DECIMAL_PLACES = 2;

  const formatVolume = (value: number) => {
    if (value >= BILLION) {
      return `$${(value / BILLION).toFixed(DECIMAL_PLACES)}B`;
    }
    if (value >= MILLION) {
      return `$${(value / MILLION).toFixed(DECIMAL_PLACES)}M`;
    }
    if (value >= THOUSAND) {
      return `$${(value / THOUSAND).toFixed(DECIMAL_PLACES)}K`;
    }
    return `$${value.toFixed(DECIMAL_PLACES)}`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Total 24h Volume */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Объем 24ч</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {formatVolume(marketStats.totalVolume24h)}
          </div>
          <p className="text-muted-foreground text-xs">
            Общий торговый объем за 24 часа
          </p>
        </CardContent>
      </Card>

      {/* Total Symbols */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Активные пары</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">{marketStats.totalSymbols}</div>
          <p className="text-muted-foreground text-xs">
            Торговых пар в системе
          </p>
        </CardContent>
      </Card>

      {/* Average Volatility */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">
            Ср. волатильность
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {marketStats.avgVolatility.toFixed(2)}%
          </div>
          <p className="text-muted-foreground text-xs">
            Средняя волатильность по рынку
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
