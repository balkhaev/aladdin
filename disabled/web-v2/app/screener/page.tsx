"use client"

import * as React from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useScreenerResults, useScreenerSignals, useScreenerStats, useRunScreening } from "@/hooks/use-screener"
import type { Recommendation } from "@/lib/types"
import { toast } from "sonner"

function getRecommendationColor(rec: Recommendation) {
  switch (rec) {
    case 'STRONG_BUY':
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    case 'BUY':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    case 'NEUTRAL':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    case 'SELL':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    case 'STRONG_SELL':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
  }
}

function getRecommendationIcon(rec: Recommendation) {
  switch (rec) {
    case 'STRONG_BUY':
    case 'BUY':
      return <TrendingUp className="size-3" />
    case 'NEUTRAL':
      return <Minus className="size-3" />
    case 'SELL':
    case 'STRONG_SELL':
      return <TrendingDown className="size-3" />
  }
}

export default function ScreenerPage() {
  const { data: results, isLoading: resultsLoading } = useScreenerResults(50)
  const { data: strongBuySignals } = useScreenerSignals('STRONG_BUY', 10)
  const { data: buySignals } = useScreenerSignals('BUY', 10)
  const { data: sellSignals } = useScreenerSignals('SELL', 10)
  const { data: strongSellSignals } = useScreenerSignals('STRONG_SELL', 10)
  const { data: stats } = useScreenerStats()
  const runScreening = useRunScreening()

  const handleRunScreening = async () => {
    try {
      await runScreening.mutateAsync('1d')
      toast.success('Screening started successfully')
    } catch (error) {
      toast.error('Failed to start screening')
    }
  }

  return (
    <SidebarInset>
      <DashboardHeader />

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">Market Screener</h1>
              <p className="text-muted-foreground">
                Find trading opportunities with technical analysis
              </p>
            </div>
            <Button
              onClick={handleRunScreening}
              disabled={runScreening.isPending}
            >
              {runScreening.isPending ? (
                <>
                  <RefreshCw className="mr-2 size-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Run Screening
                </>
              )}
            </Button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Symbols</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalSymbols}</div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Processing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.processing}</div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.queueSize}</div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Failed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results Tabs */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Results</TabsTrigger>
              <TabsTrigger value="strong-buy">Strong Buy</TabsTrigger>
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
              <TabsTrigger value="strong-sell">Strong Sell</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>All Screening Results</CardTitle>
                  <CardDescription>
                    {results?.count || 0} symbols analyzed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {resultsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>24h Change</TableHead>
                          <TableHead>Volume</TableHead>
                          <TableHead>RSI</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Recommendation</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results?.results.map((result) => (
                          <TableRow key={result.symbol}>
                            <TableCell className="font-medium">{result.symbol}</TableCell>
                            <TableCell>${result.price.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={result.change24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                                {result.change24h >= 0 ? '+' : ''}{result.change24h.toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell>${(result.volume24h / 1_000_000).toFixed(2)}M</TableCell>
                            <TableCell>{result.rsi.toFixed(1)}</TableCell>
                            <TableCell>{result.technicalScore.toFixed(1)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getRecommendationColor(result.recommendation)}>
                                {getRecommendationIcon(result.recommendation)}
                                <span className="ml-1">{result.recommendation.replace('_', ' ')}</span>
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Strong Buy Signals */}
            <TabsContent value="strong-buy" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Strong Buy Signals</CardTitle>
                  <CardDescription>
                    {strongBuySignals?.count || 0} strong buy opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>24h Change</TableHead>
                        <TableHead>RSI</TableHead>
                        <TableHead>Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {strongBuySignals?.results.map((result) => (
                        <TableRow key={result.symbol}>
                          <TableCell className="font-medium">{result.symbol}</TableCell>
                          <TableCell>${result.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className="text-green-500">
                              +{result.change24h.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell>{result.rsi.toFixed(1)}</TableCell>
                          <TableCell className="text-green-500 font-medium">
                            {result.technicalScore.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other tabs would follow similar pattern */}
            <TabsContent value="buy" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Buy Signals</CardTitle>
                  <CardDescription>
                    {buySignals?.count || 0} buy opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Similar table structure...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sell" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Sell Signals</CardTitle>
                  <CardDescription>
                    {sellSignals?.count || 0} sell signals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Similar table structure...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="strong-sell" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Strong Sell Signals</CardTitle>
                  <CardDescription>
                    {strongSellSignals?.count || 0} strong sell signals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Similar table structure...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SidebarInset>
  )
}
