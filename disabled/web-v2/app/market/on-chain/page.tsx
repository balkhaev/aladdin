"use client"

import * as React from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  useOnChainComparison,
  useWhaleTransactions,
} from "@/hooks/use-market-data"
import { Activity, TrendingUp, TrendingDown, ArrowUpDown, Bitcoin, Coins } from "lucide-react"

function formatNumber(num: number, decimals = 2): string {
  if (num >= 1_000_000_000_000) {
    return `${(num / 1_000_000_000_000).toFixed(decimals)}T`
  }
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(decimals)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(decimals)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(decimals)}K`
  }
  return num.toFixed(decimals)
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="size-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="size-3 text-red-500" />}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function OnChainPage() {
  const { data: comparison, isLoading: comparisonLoading } = useOnChainComparison()

  // Get whale transactions for last 24 hours
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const { data: btcWhales, isLoading: btcWhalesLoading } = useWhaleTransactions(
    'BTC',
    yesterday.toISOString(),
    now.toISOString(),
    10
  )
  const { data: ethWhales, isLoading: ethWhalesLoading } = useWhaleTransactions(
    'ETH',
    yesterday.toISOString(),
    now.toISOString(),
    10
  )

  const btcMetrics = comparison?.btc
  const ethMetrics = comparison?.eth

  return (
    <SidebarInset>
      <DashboardHeader />

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          {/* Hero Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">On-Chain Metrics</h1>
            <p className="text-muted-foreground">
              Real-time blockchain data, whale activity, and network health indicators
            </p>
          </div>

          {/* BTC vs ETH Comparison */}
          <Tabs defaultValue="btc" className="space-y-4">
            <TabsList>
              <TabsTrigger value="btc">
                <Bitcoin className="size-4 mr-2" />
                Bitcoin
              </TabsTrigger>
              <TabsTrigger value="eth">
                <Coins className="size-4 mr-2" />
                Ethereum
              </TabsTrigger>
              <TabsTrigger value="comparison">Comparison</TabsTrigger>
            </TabsList>

            {/* Bitcoin Metrics */}
            <TabsContent value="btc" className="space-y-4">
              {comparisonLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : btcMetrics ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      title="Active Addresses"
                      value={formatNumber(btcMetrics.activeAddresses, 0)}
                      subtitle="Network activity"
                      icon={<Activity className="size-4 text-muted-foreground" />}
                    />
                    <MetricCard
                      title="Transactions"
                      value={formatNumber(btcMetrics.transactions, 0)}
                      subtitle="24h transaction count"
                      icon={<TrendingUp className="size-4 text-muted-foreground" />}
                    />
                    <MetricCard
                      title="Network Value"
                      value={`$${formatNumber(btcMetrics.networkValue)}`}
                      subtitle="Total network value"
                      icon={<ArrowUpDown className="size-4 text-muted-foreground" />}
                    />
                    <MetricCard
                      title="NVT Ratio"
                      value={btcMetrics.nvtRatio.toFixed(2)}
                      subtitle="Network value to transactions"
                      icon={<Activity className="size-4 text-muted-foreground" />}
                    />
                  </div>

                  {/* Additional BTC Metrics */}
                  {btcMetrics.hashRate && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <MetricCard
                        title="Hash Rate"
                        value={formatNumber(btcMetrics.hashRate, 0)}
                        subtitle="Network hash rate"
                      />
                      {btcMetrics.difficulty && (
                        <MetricCard
                          title="Difficulty"
                          value={formatNumber(btcMetrics.difficulty, 0)}
                          subtitle="Mining difficulty"
                        />
                      )}
                    </div>
                  )}

                  {/* Whale Transactions */}
                  <Card className="border-border/50 bg-card/50 backdrop-blur">
                    <CardHeader>
                      <CardTitle>Recent Whale Transactions (24h)</CardTitle>
                      <CardDescription>Large BTC transfers on-chain</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {btcWhalesLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : btcWhales && btcWhales.length > 0 ? (
                        <div className="space-y-2">
                          {btcWhales.map((tx, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="font-mono text-xs text-muted-foreground truncate">
                                  {tx.transactionHash.slice(0, 16)}...{tx.transactionHash.slice(-8)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(tx.timestamp).toLocaleString()}
                                </div>
                              </div>
                              <Badge variant="secondary" className="ml-2">
                                {formatNumber(tx.value)} BTC
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No whale transactions in the last 24 hours
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </TabsContent>

            {/* Ethereum Metrics */}
            <TabsContent value="eth" className="space-y-4">
              {comparisonLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : ethMetrics ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      title="Active Addresses"
                      value={formatNumber(ethMetrics.activeAddresses, 0)}
                      subtitle="Network activity"
                      icon={<Activity className="size-4 text-muted-foreground" />}
                    />
                    <MetricCard
                      title="Transactions"
                      value={formatNumber(ethMetrics.transactions, 0)}
                      subtitle="24h transaction count"
                      icon={<TrendingUp className="size-4 text-muted-foreground" />}
                    />
                    <MetricCard
                      title="Network Value"
                      value={`$${formatNumber(ethMetrics.networkValue)}`}
                      subtitle="Total network value"
                      icon={<ArrowUpDown className="size-4 text-muted-foreground" />}
                    />
                    <MetricCard
                      title="NVT Ratio"
                      value={ethMetrics.nvtRatio.toFixed(2)}
                      subtitle="Network value to transactions"
                      icon={<Activity className="size-4 text-muted-foreground" />}
                    />
                  </div>

                  {/* Whale Transactions */}
                  <Card className="border-border/50 bg-card/50 backdrop-blur">
                    <CardHeader>
                      <CardTitle>Recent Whale Transactions (24h)</CardTitle>
                      <CardDescription>Large ETH transfers on-chain</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {ethWhalesLoading ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : ethWhales && ethWhales.length > 0 ? (
                        <div className="space-y-2">
                          {ethWhales.map((tx, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="font-mono text-xs text-muted-foreground truncate">
                                  {tx.transactionHash.slice(0, 16)}...{tx.transactionHash.slice(-8)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(tx.timestamp).toLocaleString()}
                                </div>
                              </div>
                              <Badge variant="secondary" className="ml-2">
                                {formatNumber(tx.value)} ETH
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No whale transactions in the last 24 hours
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </TabsContent>

            {/* Comparison */}
            <TabsContent value="comparison" className="space-y-4">
              {comparisonLoading ? (
                <Skeleton className="h-96" />
              ) : btcMetrics && ethMetrics ? (
                <Card className="border-border/50 bg-card/50 backdrop-blur">
                  <CardHeader>
                    <CardTitle>BTC vs ETH Comparison</CardTitle>
                    <CardDescription>Side-by-side on-chain metrics comparison</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        {
                          label: 'Active Addresses',
                          btc: formatNumber(btcMetrics.activeAddresses, 0),
                          eth: formatNumber(ethMetrics.activeAddresses, 0),
                        },
                        {
                          label: 'Transactions',
                          btc: formatNumber(btcMetrics.transactions, 0),
                          eth: formatNumber(ethMetrics.transactions, 0),
                        },
                        {
                          label: 'Network Value',
                          btc: `$${formatNumber(btcMetrics.networkValue)}`,
                          eth: `$${formatNumber(ethMetrics.networkValue)}`,
                        },
                        {
                          label: 'NVT Ratio',
                          btc: btcMetrics.nvtRatio.toFixed(2),
                          eth: ethMetrics.nvtRatio.toFixed(2),
                        },
                      ].map((item, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-3 gap-4 p-4 rounded-lg border border-border/50"
                        >
                          <div className="font-semibold">{item.label}</div>
                          <div className="text-right">
                            <Badge variant="outline" className="mr-2">
                              BTC
                            </Badge>
                            {item.btc}
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className="mr-2">
                              ETH
                            </Badge>
                            {item.eth}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SidebarInset>
  )
}
