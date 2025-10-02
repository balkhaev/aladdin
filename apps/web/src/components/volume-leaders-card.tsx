/**
 * Volume Leaders Card Component
 * Монеты с наибольшим торговым объемом за 24 часа
 */

import { BarChart2 } from "lucide-react";
import { useMarketOverview } from "../hooks/use-analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function VolumeLeadersCard() {
  const { data: marketData, isLoading } = useMarketOverview();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Лидеры по объему</CardTitle>
          <CardDescription>Самые торгуемые за 24 часа</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!marketData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Лидеры по объему</CardTitle>
          <CardDescription>Самые торгуемые за 24 часа</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Нет данных</p>
        </CardContent>
      </Card>
    );
  }

  const { volumeLeaders } = marketData;

  const BILLION = 1_000_000_000;
  const MILLION = 1_000_000;
  const THOUSAND = 1000;
  const MIN_FRACTION_DIGITS = 2;
  const MAX_FRACTION_DIGITS = 2;
  const SMALL_VALUE_DECIMALS = 6;
  const LARGE_NUMBER_DECIMAL = 1;

  const formatPrice = (value: number) => {
    if (value >= THOUSAND) {
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: MIN_FRACTION_DIGITS, maximumFractionDigits: MAX_FRACTION_DIGITS })}`;
    }
    if (value >= 1) {
      return `$${value.toFixed(MIN_FRACTION_DIGITS)}`;
    }
    return `$${value.toFixed(SMALL_VALUE_DECIMALS)}`;
  };

  const formatVolume = (value: number) => {
    if (value >= BILLION) {
      return `${(value / BILLION).toFixed(MIN_FRACTION_DIGITS)}B`;
    }
    if (value >= MILLION) {
      return `${(value / MILLION).toFixed(MIN_FRACTION_DIGITS)}M`;
    }
    if (value >= THOUSAND) {
      return `${(value / THOUSAND).toFixed(MIN_FRACTION_DIGITS)}K`;
    }
    return value.toFixed(MIN_FRACTION_DIGITS);
  };

  const formatTrades = (value: number) => {
    if (value >= MILLION) {
      return `${(value / MILLION).toFixed(LARGE_NUMBER_DECIMAL)}M`;
    }
    if (value >= THOUSAND) {
      return `${(value / THOUSAND).toFixed(LARGE_NUMBER_DECIMAL)}K`;
    }
    return value.toString();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Лидеры по объему</CardTitle>
        <CardDescription>Самые торгуемые за 24 часа</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {volumeLeaders.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет данных</p>
          ) : (
            volumeLeaders.map((coin, index) => (
              <div
                className="flex items-center justify-between rounded-lg border p-3"
                key={coin.symbol}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{coin.symbol}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatPrice(coin.price)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <BarChart2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">
                      {formatVolume(coin.volume24h)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatTrades(coin.trades24h)} сделок
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
