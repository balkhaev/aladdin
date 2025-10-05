/**
 * Market Overview Component
 * Displays top gainers, losers, and volume leaders with market statistics
 */

import {
  Activity,
  ArrowDown,
  ArrowUp,
  Minus,
  TrendingDown,
  TrendingUp,
  Volume2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketOverview } from "@/hooks/use-market-overview";

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;
const PRICE_THRESHOLD = 1;
const PRICE_DECIMALS_LARGE = 2;
const PRICE_DECIMALS_SMALL = 6;
const PERCENT_DECIMALS = 2;

export function MarketOverview() {
  const { data: overview, isLoading, error } = useMarketOverview();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !overview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load market overview
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatVolume = (volume: number): string => {
    if (volume >= BILLION) {
      return `$${(volume / BILLION).toFixed(PRICE_DECIMALS_LARGE)}B`;
    }
    if (volume >= MILLION) {
      return `$${(volume / MILLION).toFixed(PRICE_DECIMALS_LARGE)}M`;
    }
    return `$${volume.toFixed(PRICE_DECIMALS_LARGE)}`;
  };

  const formatPrice = (price: number): string => {
    if (price >= PRICE_THRESHOLD) {
      return `$${price.toFixed(PRICE_DECIMALS_LARGE)}`;
    }
    return `$${price.toFixed(PRICE_DECIMALS_SMALL)}`;
  };

  const formatPercent = (percent: number): string => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent.toFixed(PERCENT_DECIMALS)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Market Overview</span>
          <span className="font-normal text-muted-foreground text-xs">
            24h Performance
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Market Stats Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-muted-foreground text-xs">Total Volume</div>
            <div className="font-bold text-lg">
              {formatVolume(overview.marketStats.totalVolume24h)}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-muted-foreground text-xs">Active Symbols</div>
            <div className="font-bold text-lg">
              {overview.marketStats.totalSymbols}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-muted-foreground text-xs">Avg Volatility</div>
            <div className="font-bold text-lg">
              {overview.marketStats.avgVolatility.toFixed(2)}%
            </div>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="text-muted-foreground text-xs">Market Breadth</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-500">
                {overview.marketStats.gainersCount}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-500">
                {overview.marketStats.losersCount}
              </span>
            </div>
          </div>
        </div>

        {/* Market Breadth Visualization */}
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Market Sentiment</span>
            </div>
            <span className="text-muted-foreground">
              {(
                (overview.marketStats.gainersCount /
                  overview.marketStats.totalSymbols) *
                100
              ).toFixed(1)}
              % Positive
            </span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-600 transition-all"
              style={{
                width: `${(overview.marketStats.gainersCount / overview.marketStats.totalSymbols) * 100}%`,
              }}
            />
            <div
              className="absolute top-0 right-0 h-full bg-gradient-to-l from-red-500 to-red-600 transition-all"
              style={{
                width: `${(overview.marketStats.losersCount / overview.marketStats.totalSymbols) * 100}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-muted-foreground">
                {overview.marketStats.gainersCount} gainers
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Minus className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {overview.marketStats.unchangedCount} unchanged
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-muted-foreground">
                {overview.marketStats.losersCount} losers
              </span>
            </div>
          </div>
        </div>

        {/* Top Gainers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <h3 className="font-semibold text-sm">Top Gainers</h3>
            </div>
            <span className="text-muted-foreground text-xs">24h Range</span>
          </div>
          <div className="space-y-1">
            {overview.topGainers.map((gainer) => (
              <div
                className="rounded-md border bg-card p-3 transition-colors hover:bg-accent/50"
                key={gainer.symbol}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {gainer.symbol.replace("USDT", "")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatPrice(gainer.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Volume2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {formatVolume(gainer.volume24h)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3 text-green-500" />
                      <span className="font-semibold text-green-500 text-sm">
                        {formatPercent(gainer.changePercent24h)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">L:</span>
                  <span className="text-red-400">
                    {formatPrice(gainer.low24h)}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">H:</span>
                  <span className="text-green-400">
                    {formatPrice(gainer.high24h)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <h3 className="font-semibold text-sm">Top Losers</h3>
            </div>
            <span className="text-muted-foreground text-xs">24h Range</span>
          </div>
          <div className="space-y-1">
            {overview.topLosers.map((loser) => (
              <div
                className="rounded-md border bg-card p-3 transition-colors hover:bg-accent/50"
                key={loser.symbol}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {loser.symbol.replace("USDT", "")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatPrice(loser.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Volume2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {formatVolume(loser.volume24h)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowDown className="h-3 w-3 text-red-500" />
                      <span className="font-semibold text-red-500 text-sm">
                        {formatPercent(loser.changePercent24h)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">L:</span>
                  <span className="text-red-400">
                    {formatPrice(loser.low24h)}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">H:</span>
                  <span className="text-green-400">
                    {formatPrice(loser.high24h)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volume Leaders */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-blue-500" />
            <h3 className="font-semibold text-sm">Volume Leaders</h3>
          </div>
          <div className="space-y-1">
            {overview.volumeLeaders.map((leader) => (
              <div
                className="flex items-center justify-between rounded-md border bg-card p-2 transition-colors hover:bg-accent/50"
                key={leader.symbol}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {leader.symbol.replace("USDT", "")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatPrice(leader.price)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">
                      {leader.trades24h.toLocaleString()} trades
                    </span>
                  </div>
                  <div className="font-semibold text-blue-500 text-sm">
                    {formatVolume(leader.volumeUsd)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-right text-muted-foreground text-xs">
          Updated:{" "}
          {new Date(overview.marketStats.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
