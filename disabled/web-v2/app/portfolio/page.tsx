"use client"

import * as React from "react"
import Link from "next/link"
import { SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePortfolios, useCreatePortfolio, useDeletePortfolio } from "@/hooks/use-portfolio"
import { Plus, TrendingUp, TrendingDown, Trash2, ArrowRight } from "lucide-react"
import { toast } from "sonner"

function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function PortfolioPage() {
  const { data: portfolios, isLoading } = usePortfolios()
  const createPortfolio = useCreatePortfolio()
  const deletePortfolio = useDeletePortfolio()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [newPortfolio, setNewPortfolio] = React.useState({
    name: '',
    currency: 'USD',
    initialBalance: 10000,
  })

  const handleCreatePortfolio = async () => {
    if (!newPortfolio.name.trim()) {
      toast.error('Please enter a portfolio name')
      return
    }

    try {
      await createPortfolio.mutateAsync(newPortfolio)
      toast.success('Portfolio created successfully')
      setIsCreateDialogOpen(false)
      setNewPortfolio({ name: '', currency: 'USD', initialBalance: 10000 })
    } catch (error) {
      toast.error('Failed to create portfolio')
      console.error('Create portfolio error:', error)
    }
  }

  const handleDeletePortfolio = async (portfolioId: string, portfolioName: string) => {
    if (!confirm(`Are you sure you want to delete "${portfolioName}"?`)) {
      return
    }

    try {
      await deletePortfolio.mutateAsync(portfolioId)
      toast.success('Portfolio deleted successfully')
    } catch (error) {
      toast.error('Failed to delete portfolio')
      console.error('Delete portfolio error:', error)
    }
  }

  return (
    <SidebarInset>
      <DashboardHeader />

      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 space-y-6">
          {/* Hero Section */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Portfolios</h1>
              <p className="text-muted-foreground">
                Manage your investment portfolios and track performance
              </p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Create Portfolio
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Portfolio</DialogTitle>
                  <DialogDescription>
                    Set up a new portfolio to track your investments
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Portfolio Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Main Portfolio"
                      value={newPortfolio.name}
                      onChange={(e) =>
                        setNewPortfolio({ ...newPortfolio, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      placeholder="USD"
                      value={newPortfolio.currency}
                      onChange={(e) =>
                        setNewPortfolio({ ...newPortfolio, currency: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="initialBalance">Initial Balance</Label>
                    <Input
                      id="initialBalance"
                      type="number"
                      placeholder="10000"
                      value={newPortfolio.initialBalance}
                      onChange={(e) =>
                        setNewPortfolio({
                          ...newPortfolio,
                          initialBalance: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePortfolio}
                    disabled={createPortfolio.isPending}
                  >
                    {createPortfolio.isPending ? 'Creating...' : 'Create Portfolio'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Portfolios Grid */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : portfolios && portfolios.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {portfolios.map((portfolio) => {
                const totalValue = portfolio.totalValue || 0
                const totalCost = portfolio.totalCost || 0
                const pnl = portfolio.unrealizedPnl + portfolio.realizedPnl
                const pnlPercent = portfolio.returnPercent
                const isPositive = pnl >= 0

                return (
                  <Card
                    key={portfolio.id}
                    className="border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-colors"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{portfolio.name}</CardTitle>
                          <CardDescription>
                            {portfolio.currency || 'USD'} •{' '}
                            {new Date(portfolio.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePortfolio(portfolio.id, portfolio.name)}
                          disabled={deletePortfolio.isPending}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(totalValue, portfolio.currency)}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {isPositive ? (
                            <TrendingUp className="size-4 text-green-500" />
                          ) : (
                            <TrendingDown className="size-4 text-red-500" />
                          )}
                          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                            {isPositive ? '+' : ''}
                            {formatCurrency(pnl, portfolio.currency)} ({pnlPercent.toFixed(2)}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <Badge variant="secondary">
                          {portfolio.currency || 'USD'}
                        </Badge>
                        <Link href={`/portfolio/${portfolio.id}`}>
                          <Button variant="ghost" size="sm">
                            View Details
                            <ArrowRight className="size-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">No portfolios yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Create your first portfolio to start tracking your cryptocurrency investments
                  </p>
                </div>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="size-4 mr-2" />
                  Create Your First Portfolio
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          {portfolios && portfolios.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      portfolios.reduce((sum, p) => sum + (p.totalValue || 0), 0)
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Across all portfolios</p>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const totalPnl = portfolios.reduce(
                      (sum, p) =>
                        sum + (p.unrealizedPnl + p.realizedPnl),
                      0
                    )
                    const isPositive = totalPnl >= 0
                    return (
                      <>
                        <div
                          className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}
                        >
                          {isPositive ? '+' : ''}
                          {formatCurrency(totalPnl)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Combined profit/loss
                        </p>
                      </>
                    )
                  })()}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {portfolios.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Active portfolio{portfolios.length !== 1 ? 's' : ''}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </SidebarInset>
  )
}
