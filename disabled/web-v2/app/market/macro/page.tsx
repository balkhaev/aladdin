"use client"

import * as React from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useMacroData,
  useFearGreedHistory,
  useTrendingCoins,
  useCategories,
  useTopCoins,
} from "@/hooks/use-market-data"
import { TrendingUp, TrendingDown, Activity, Bitcoin, DollarSign } from "lucide-react"

function formatNumber(num: number, decimals = 2): string {
  if (num >= 1_000_000_000_000) {
    return `$${(num / 1_000_000_000_000).toFixed(decimals)}T`
  }
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(decimals)}B`
  }
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(decimals)}M`
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(decimals)}K`
  }
  return `$${num.toFixed(decimals)}`
}

function FearGreedGauge({ value, label }: { value: number; label: string }) {
  const getColor = (val: number) => {
    if (val < 25) return "text-red-500"
    if (val < 45) return "text-orange-500"
    if (val < 55) return "text-yellow-500"
    if (val < 75) return "text-green-500"
    return "text-emerald-500"
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className={`text-6xl font-bold ${getColor(value)}`}>{value}</div>
      <div className="text-2xl font-semibold">{label}</div>
      <div className="text-sm text-muted-foreground">Fear & Greed Index</div>
    </div>
  )
}

export default function MacroPage() {
  const { data: macroData, isLoading: macroLoading } = useMacroData()
  const { data: trendingCoins, isLoading: trendingLoading } = useTrendingCoins()
  const { data: categories, isLoading: categoriesLoading } = useCategories()
  const { data: topCoins, isLoading: topCoinsLoading } = useTopCoins()

  return (
    <SidebarInset>
      <DashboardHeader />

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          {/* Hero Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Macro Market Overview</h1>
            <p className="text-muted-foreground">
              Global cryptocurrency market statistics and sentiment analysis
            </p>
          </div>

          {/* Global Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Market Cap</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {macroLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {macroData ? formatNumber(macroData.totalMarketCapUsd || macroData.marketCap) : "$0"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {macroData?.marketCapChange24h ? `${macroData.marketCapChange24h > 0 ? '+' : ''}${macroData.marketCapChange24h.toFixed(2)}% 24h` : 'Global market cap'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">24h Volume</CardTitle>
                <Activity className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {macroLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {macroData ? formatNumber(macroData.totalVolume24hUsd || macroData.volume24h) : "$0"}
                    </div>
                    <p className="text-xs text-muted-foreground">Across all markets</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">BTC Dominance</CardTitle>
                <Bitcoin className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {macroLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {macroData?.btcDominance ? `${macroData.btcDominance.toFixed(2)}%` : "0%"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ETH: {macroData?.ethDominance ? `${macroData.ethDominance.toFixed(2)}%` : "0%"}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Cryptos</CardTitle>
                <Activity className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {macroLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {macroData?.activeCryptocurrencies ? macroData.activeCryptocurrencies.toLocaleString() : "0"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {macroData?.markets ? `${macroData.markets.toLocaleString()} markets` : "0 markets"}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Fear & Greed Index */}
          <Card className="border-border/50 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle>Market Sentiment</CardTitle>
              <CardDescription>Fear & Greed Index - Real-time market emotion</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center min-h-[200px]">
              {macroLoading ? (
                <Skeleton className="h-32 w-48" />
              ) : macroData ? (
                <FearGreedGauge
                  value={macroData.fearGreedIndex}
                  label={macroData.fearGreedLabel}
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Trending & Categories */}
          <Tabs defaultValue="trending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="trending">Trending Coins</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="top">Top 50</TabsTrigger>
            </TabsList>

            <TabsContent value="trending" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Trending Coins</CardTitle>
                  <CardDescription>Most searched and trending cryptocurrencies</CardDescription>
                </CardHeader>
                <CardContent>
                  {trendingLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trendingCoins?.map((coin) => (
                        <div
                          key={coin.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                              {coin.rank}
                            </div>
                            <div>
                              <div className="font-semibold">{coin.name}</div>
                              <div className="text-xs text-muted-foreground">{coin.symbol}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${coin.priceUsd.toFixed(2)}</div>
                            <div
                              className={`text-sm ${coin.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}
                            >
                              {coin.priceChange24h >= 0 ? (
                                <TrendingUp className="inline size-3" />
                              ) : (
                                <TrendingDown className="inline size-3" />
                              )}
                              {coin.priceChange24h.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Market Categories</CardTitle>
                  <CardDescription>Performance by cryptocurrency category</CardDescription>
                </CardHeader>
                <CardContent>
                  {categoriesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categories?.map((category) => (
                        <div
                          key={category.category}
                          className="p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold">{category.category}</div>
                            <div className="text-sm text-muted-foreground">
                              {category.coinsCount} coins
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Market Cap</div>
                              <div className="font-semibold">
                                {formatNumber(category.totalMarketCap)}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">24h Change</div>
                              <div
                                className={`font-semibold ${category.avgPriceChange24h >= 0 ? "text-green-500" : "text-red-500"}`}
                              >
                                {category.avgPriceChange24h.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">7d Change</div>
                              <div
                                className={`font-semibold ${category.avgPriceChange7d >= 0 ? "text-green-500" : "text-red-500"}`}
                              >
                                {category.avgPriceChange7d.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="top" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Top 50 Cryptocurrencies</CardTitle>
                  <CardDescription>Ranked by market capitalization</CardDescription>
                </CardHeader>
                <CardContent>
                  {topCoinsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topCoins?.slice(0, 10).map((coin) => (
                        <div
                          key={coin.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                              {coin.marketCapRank}
                            </div>
                            <div>
                              <div className="font-semibold">{coin.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {coin.symbol}
                                {coin.category && ` • ${coin.category}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">${coin.priceUsd.toFixed(2)}</div>
                            <div className="text-xs text-muted-foreground">
                              MCap: {formatNumber(coin.marketCap)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SidebarInset>
  )
}
