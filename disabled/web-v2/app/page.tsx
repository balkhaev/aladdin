"use client";

import { Activity, Bitcoin, DollarSign, TrendingUp, Users } from "lucide-react";
import * as React from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { MarketOverviewCard } from "@/components/dashboard/market-overview-card";
import { TickerCard } from "@/components/dashboard/ticker-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMacroData, useQuotes } from "@/hooks/use-market-data";

// Top symbols to track
const TOP_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "DOTUSDT",
];

function formatNumber(num: number | undefined, decimals = 2): string {
  if (num === undefined || num === null || isNaN(num)) {
    return "$0";
  }
  if (num >= 1_000_000_000_000) {
    return `$${(num / 1_000_000_000_000).toFixed(decimals)}T`;
  }
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(decimals)}M`;
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(decimals)}K`;
  }
  return `$${num.toFixed(decimals)}`;
}

export default function DashboardPage() {
  const { data: macroData, isLoading: macroLoading } = useMacroData();
  const { data: quotes, isLoading: quotesLoading } = useQuotes(TOP_SYMBOLS);

  // Calculate market stats from macro data
  const marketStats = React.useMemo(
    () => [
      {
        title: "Total Market Cap",
        value: macroData ? formatNumber(macroData.totalMarketCapUsd || macroData.marketCap) : "$0",
        change: macroData?.marketCapChange24h || 0,
        description: "Global crypto market capitalization",
        icon: <DollarSign className="size-4" />,
        trend: (macroData?.marketCapChange24h || 0) >= 0 ? "up" as const : "down" as const,
      },
      {
        title: "24h Volume",
        value: macroData ? formatNumber(macroData.totalVolume24hUsd || macroData.volume24h) : "$0",
        change: -2.1, // TODO: Get from historical data
        description: "Trading volume across all markets",
        icon: <Activity className="size-4" />,
        trend: "down" as const,
      },
      {
        title: "BTC Dominance",
        value: macroData?.btcDominance ? `${macroData.btcDominance.toFixed(1)}%` : "0%",
        change: 1.3, // TODO: Get from historical data
        description: "Bitcoin market share",
        icon: <Bitcoin className="size-4" />,
        trend: "up" as const,
      },
      {
        title: "Fear & Greed Index",
        value: macroData ? macroData.fearGreedIndex?.toString() : "0",
        change: 12.5, // TODO: Get from historical data
        description: macroData?.fearGreedLabel || "Market sentiment",
        icon: <Users className="size-4" />,
        trend: "up" as const,
      },
    ],
    [macroData]
  );

  // Sort quotes into gainers and losers
  const { gainers, losers } = React.useMemo(() => {
    if (!quotes) return { gainers: [], losers: [] };

    const sorted = [...quotes].sort((a, b) => b.change24h - a.change24h);
    return {
      gainers: sorted.filter((q) => q.change24h > 0).slice(0, 3),
      losers: sorted.filter((q) => q.change24h < 0).slice(0, 3),
    };
  }, [quotes]);

  const highVolume = React.useMemo(() => {
    if (!quotes) return [];
    return [...quotes].sort((a, b) => b.volume24h - a.volume24h).slice(0, 3);
  }, [quotes]);

  return (
    <SidebarInset>
      <DashboardHeader />

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto space-y-6 p-6">
          {/* Hero Section */}
          <div className="space-y-2">
            <h1 className="font-bold text-3xl tracking-tight">
              Market Dashboard
            </h1>
            <p className="text-muted-foreground">
              Real-time cryptocurrency market overview and analytics
            </p>
          </div>

          {/* Market Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {marketStats.map((stat) => (
              <MarketOverviewCard
                key={stat.title}
                {...stat}
                isLoading={macroLoading}
              />
            ))}
          </div>

          {/* Market Movers */}
          <Tabs className="space-y-4" defaultValue="gainers">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="gainers">Top Gainers</TabsTrigger>
                <TabsTrigger value="losers">Top Losers</TabsTrigger>
                <TabsTrigger value="volume">Highest Volume</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent className="space-y-4" value="gainers">
              {quotesLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card
                      className="border-border/50 bg-card/50 backdrop-blur"
                      key={i}
                    >
                      <CardContent className="p-4">
                        <Skeleton className="mb-2 h-6 w-32" />
                        <Skeleton className="mb-2 h-8 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {gainers.map((ticker) => (
                    <TickerCard
                      change24h={ticker.change24h}
                      key={ticker.symbol}
                      name={ticker.symbol}
                      price={`$${ticker.price.toFixed(2)}`}
                      symbol={ticker.symbol.replace("USDT", "")}
                      volume24h={formatNumber(ticker.volume24h)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="losers">
              {quotesLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card
                      className="border-border/50 bg-card/50 backdrop-blur"
                      key={i}
                    >
                      <CardContent className="p-4">
                        <Skeleton className="mb-2 h-6 w-32" />
                        <Skeleton className="mb-2 h-8 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {losers.map((ticker) => (
                    <TickerCard
                      change24h={ticker.change24h}
                      key={ticker.symbol}
                      name={ticker.symbol}
                      price={`$${ticker.price.toFixed(2)}`}
                      symbol={ticker.symbol.replace("USDT", "")}
                      volume24h={formatNumber(ticker.volume24h)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="volume">
              {quotesLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card
                      className="border-border/50 bg-card/50 backdrop-blur"
                      key={i}
                    >
                      <CardContent className="p-4">
                        <Skeleton className="mb-2 h-6 w-32" />
                        <Skeleton className="mb-2 h-8 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {highVolume.map((ticker) => (
                    <TickerCard
                      change24h={ticker.change24h}
                      key={ticker.symbol}
                      name={ticker.symbol}
                      price={`$${ticker.price.toFixed(2)}`}
                      symbol={ticker.symbol.replace("USDT", "")}
                      volume24h={formatNumber(ticker.volume24h)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Additional Sections */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Market Sentiment</CardTitle>
                <CardDescription>
                  Aggregate sentiment analysis across social media and news
                </CardDescription>
              </CardHeader>
              <CardContent className="flex h-[300px] items-center justify-center">
                {macroLoading ? (
                  <Skeleton className="h-16 w-48" />
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-8 text-green-500" />
                      <span className="font-bold text-4xl">
                        {macroData?.fearGreedLabel || "Neutral"}
                      </span>
                    </div>
                    <p className="text-center text-muted-foreground">
                      Fear & Greed Index: {macroData?.fearGreedIndex || 50}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3 border-border/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest market movements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quotesLoading
                    ? [1, 2, 3, 4, 5].map((i) => (
                        <div
                          className="flex items-center justify-between border-border/50 border-b pb-2"
                          key={i}
                        >
                          <Skeleton className="h-10 w-32" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))
                    : quotes?.slice(0, 5).map((quote, i) => (
                        <div
                          className="flex items-center justify-between border-border/50 border-b pb-2 text-sm last:border-0"
                          key={quote.symbol}
                        >
                          <div className="space-y-1">
                            <p className="font-medium">{quote.symbol}</p>
                            <p className="text-muted-foreground text-xs">
                              ${quote.price.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-medium ${quote.change24h >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {quote.change24h >= 0 ? "+" : ""}
                              {quote.change24h.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
