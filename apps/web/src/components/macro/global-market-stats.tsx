/**
 * Global Market Stats Component
 * Карточки с основными рыночными метриками
 */

import {
  Activity,
  Coins,
  DollarSign,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalMetrics } from "@/hooks/use-macro-data";
import { formatMarketCap, getPriceChangeColor } from "@/lib/api/macro";

const PERCENTAGE_MULTIPLIER = 100;

export function GlobalMarketStats() {
  const { data, isLoading, error } = useGlobalMetrics();

  if (isLoading) {
    return (
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Failed to load market data
      </div>
    );
  }

  if (!data) return null;

  const changeColor = getPriceChangeColor(data.marketCapChange24h);
  const ChangeIcon = data.marketCapChange24h >= 0 ? TrendingUp : TrendingDown;

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Market Cap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">
            Total Market Cap
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {formatMarketCap(data.totalMarketCapUsd)}
          </div>
          <p className={`text-xs ${changeColor} mt-1 flex items-center gap-1`}>
            <ChangeIcon className="h-3 w-3" />
            {data.marketCapChange24h >= 0 ? "+" : ""}
            {data.marketCapChange24h.toFixed(2)}% (24h)
          </p>
        </CardContent>
      </Card>

      {/* 24h Volume */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">24h Volume</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {formatMarketCap(data.totalVolume24hUsd)}
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            {(
              (data.totalVolume24hUsd / data.totalMarketCapUsd) *
              PERCENTAGE_MULTIPLIER
            ).toFixed(1)}
            % of market cap
          </p>
        </CardContent>
      </Card>

      {/* BTC Dominance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">BTC Dominance</CardTitle>
          <Coins className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {data.btcDominance.toFixed(2)}%
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            ETH: {data.ethDominance.toFixed(2)}%
          </p>
        </CardContent>
      </Card>

      {/* Active Cryptocurrencies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">Active Coins</CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="font-bold text-2xl">
            {data.activeCryptocurrencies.toLocaleString()}
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            {data.markets.toLocaleString()} markets
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
