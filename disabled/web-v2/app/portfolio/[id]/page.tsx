"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  usePortfolio,
  usePositions,
  useTransactions,
  usePerformance,
  useRiskMetrics,
} from "@/hooks/use-portfolio"
import { ArrowLeft, TrendingUp, TrendingDown, Activity, AlertTriangle } from "lucide-react"

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function PortfolioDetailPage() {
  const params = useParams()
  const portfolioId = params.id as string

  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio(portfolioId)
  const { data: positions, isLoading: positionsLoading } = usePositions(portfolioId)
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(portfolioId, 20)
  const { data: performance, isLoading: performanceLoading } = usePerformance(portfolioId)
  const { data: riskMetrics, isLoading: riskLoading } = useRiskMetrics(portfolioId)

  if (portfolioLoading) {
    return (
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </main>
      </SidebarInset>
    )
  }

  if (!portfolio) {
    return (
      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <h3 className="text-lg font-semibold">Portfolio not found</h3>
                <Link href="/portfolio">
                  <Button variant="outline">
                    <ArrowLeft className="size-4 mr-2" />
                    Back to Portfolios
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    )
  }

  const totalValue = portfolio.totalValue || 0
  const totalCost = portfolio.totalCost || 0
  const pnl = portfolio.unrealizedPnl + portfolio.realizedPnl
  const pnlPercent = portfolio.returnPercent
  const isPositive = pnl >= 0

  return (
    <SidebarInset>
      <DashboardHeader />

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <Link href="/portfolio">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4 mr-2" />
                Back to Portfolios
              </Button>
            </Link>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{portfolio.name}</h1>
                <p className="text-muted-foreground">
                  {portfolio.currency || 'USD'} •{' '}
                  Created {new Date(portfolio.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                <Activity className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalValue, portfolio.currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Cost Basis: {formatCurrency(totalCost, portfolio.currency)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Profit/Loss</CardTitle>
                {isPositive ? (
                  <TrendingUp className="size-4 text-green-500" />
                ) : (
                  <TrendingDown className="size-4 text-red-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {isPositive ? '+' : ''}
                  {formatCurrency(pnl, portfolio.currency)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pnlPercent >= 0 ? '+' : ''}
                  {pnlPercent.toFixed(2)}% return
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
                <AlertTriangle className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {riskLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : riskMetrics ? (
                  <>
                    <div className="text-2xl font-bold">
                      {riskMetrics.volatility ? riskMetrics.volatility.toFixed(2) + '%' : 'N/A'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sharpe Ratio: {riskMetrics.sharpeRatio?.toFixed(2) || 'N/A'}
                    </p>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="positions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="positions">Positions</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
            </TabsList>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Current Positions</CardTitle>
                  <CardDescription>Your active holdings in this portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  {positionsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : positions && positions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Avg Price</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((position) => {
                          const currentValue = position.currentPrice * position.quantity
                          const costBasis = position.averagePrice * position.quantity
                          const positionPnl = currentValue - costBasis
                          const positionPnlPercent = costBasis > 0 ? (positionPnl / costBasis) * 100 : 0
                          const isPositionPositive = positionPnl >= 0

                          return (
                            <TableRow key={position.id}>
                              <TableCell className="font-medium">{position.symbol}</TableCell>
                              <TableCell className="text-right">{position.quantity.toFixed(4)}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(position.averagePrice, portfolio.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(position.currentPrice, portfolio.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(currentValue, portfolio.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className={isPositionPositive ? 'text-green-500' : 'text-red-500'}>
                                  {isPositionPositive ? '+' : ''}
                                  {formatCurrency(positionPnl, portfolio.currency)}
                                  <div className="text-xs">
                                    ({positionPnlPercent >= 0 ? '+' : ''}
                                    {positionPnlPercent.toFixed(2)}%)
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No positions yet. Add your first position to get started.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>Recent buy, sell, and transfer activities</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactionsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : transactions && transactions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={tx.type === 'BUY' ? 'default' : 'secondary'}
                              >
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{tx.symbol}</TableCell>
                            <TableCell className="text-right">{tx.quantity.toFixed(4)}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(tx.price, portfolio.currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(tx.quantity * tx.price, portfolio.currency)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No transactions yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Detailed portfolio performance analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  {performanceLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : performance ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Total Return</div>
                        <div className="text-2xl font-bold">
                          {performance.returnPercent?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                        <div className="text-2xl font-bold">
                          {performance.sharpeRatio?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No performance data available
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Risk Tab */}
            <TabsContent value="risk" className="space-y-4">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Risk Analysis</CardTitle>
                  <CardDescription>Portfolio risk metrics and indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  {riskLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : riskMetrics ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Volatility</div>
                        <div className="text-2xl font-bold">
                          {riskMetrics.volatility?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                        <div className="text-2xl font-bold">
                          {riskMetrics.sharpeRatio?.toFixed(2)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Max Drawdown</div>
                        <div className="text-2xl font-bold text-red-500">
                          {riskMetrics.maxDrawdown?.toFixed(2)}%
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">Beta</div>
                        <div className="text-2xl font-bold">
                          {riskMetrics.beta?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No risk data available
                    </p>
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
