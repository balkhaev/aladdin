"use client"

import * as React from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useOrders, useCreateOrder, useCancelOrder, useCancelAllOrders } from "@/hooks/use-trading"
import { Plus, X, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { toast } from "sonner"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'filled':
      return 'default'
    case 'pending':
    case 'open':
      return 'secondary'
    case 'cancelled':
      return 'outline'
    case 'rejected':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export default function OrdersPage() {
  const { data: orders, isLoading } = useOrders()
  const createOrder = useCreateOrder()
  const cancelOrder = useCancelOrder()
  const cancelAllOrders = useCancelAllOrders()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [newOrder, setNewOrder] = React.useState<{
    symbol: string
    type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT_LIMIT'
    side: 'BUY' | 'SELL'
    quantity: number
    price?: number
    stopPrice?: number
  }>({
    symbol: 'BTCUSDT',
    type: 'LIMIT',
    side: 'BUY',
    quantity: 0.001,
    price: 50000,
  })

  const openOrders = orders?.filter((o) =>
    o.status.toLowerCase() === 'open' || o.status.toLowerCase() === 'pending'
  ) || []
  const filledOrders = orders?.filter((o) => o.status.toLowerCase() === 'filled') || []
  const cancelledOrders = orders?.filter((o) => o.status.toLowerCase() === 'cancelled') || []

  const handleCreateOrder = async () => {
    if (!newOrder.symbol || newOrder.quantity <= 0) {
      toast.error('Please enter valid order details')
      return
    }

    try {
      await createOrder.mutateAsync(newOrder)
      toast.success('Order created successfully')
      setIsCreateDialogOpen(false)
      setNewOrder({
        symbol: 'BTCUSDT',
        type: 'LIMIT',
        side: 'BUY',
        quantity: 0.001,
        price: 50000,
      })
    } catch (error) {
      toast.error('Failed to create order')
      console.error('Create order error:', error)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    try {
      await cancelOrder.mutateAsync(orderId)
      toast.success('Order cancelled successfully')
    } catch (error) {
      toast.error('Failed to cancel order')
      console.error('Cancel order error:', error)
    }
  }

  const handleCancelAllOrders = async () => {
    if (!confirm('Are you sure you want to cancel all open orders?')) {
      return
    }

    try {
      await cancelAllOrders.mutateAsync(undefined)
      toast.success('All orders cancelled successfully')
    } catch (error) {
      toast.error('Failed to cancel orders')
      console.error('Cancel all orders error:', error)
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
              <h1 className="text-3xl font-bold tracking-tight">Trading Orders</h1>
              <p className="text-muted-foreground">
                Manage your trading orders and monitor execution
              </p>
            </div>
            <div className="flex gap-2">
              {openOrders.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleCancelAllOrders}
                  disabled={cancelAllOrders.isPending}
                >
                  <X className="size-4 mr-2" />
                  Cancel All
                </Button>
              )}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4 mr-2" />
                    New Order
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Order</DialogTitle>
                    <DialogDescription>
                      Place a new trading order
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="symbol">Symbol</Label>
                      <Input
                        id="symbol"
                        placeholder="BTCUSDT"
                        value={newOrder.symbol}
                        onChange={(e) =>
                          setNewOrder({ ...newOrder, symbol: e.target.value.toUpperCase() })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="side">Side</Label>
                        <Select
                          value={newOrder.side}
                          onValueChange={(value) =>
                            setNewOrder({ ...newOrder, side: value as 'BUY' | 'SELL' })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BUY">Buy</SelectItem>
                            <SelectItem value="SELL">Sell</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={newOrder.type}
                          onValueChange={(value) =>
                            setNewOrder({
                              ...newOrder,
                              type: value as 'MARKET' | 'LIMIT' | 'STOP_LOSS_LIMIT',
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MARKET">Market</SelectItem>
                            <SelectItem value="LIMIT">Limit</SelectItem>
                            <SelectItem value="STOP_LOSS_LIMIT">Stop Loss Limit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.001"
                        placeholder="0.001"
                        value={newOrder.quantity}
                        onChange={(e) =>
                          setNewOrder({ ...newOrder, quantity: Number(e.target.value) })
                        }
                      />
                    </div>
                    {newOrder.type !== 'MARKET' && (
                      <div className="space-y-2">
                        <Label htmlFor="price">Price</Label>
                        <Input
                          id="price"
                          type="number"
                          placeholder="50000"
                          value={newOrder.price}
                          onChange={(e) =>
                            setNewOrder({ ...newOrder, price: Number(e.target.value) })
                          }
                        />
                      </div>
                    )}
                    {newOrder.type === 'STOP_LOSS_LIMIT' && (
                      <div className="space-y-2">
                        <Label htmlFor="stopPrice">Stop Price</Label>
                        <Input
                          id="stopPrice"
                          type="number"
                          placeholder="49000"
                          value={newOrder.stopPrice || ''}
                          onChange={(e) =>
                            setNewOrder({ ...newOrder, stopPrice: Number(e.target.value) })
                          }
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateOrder}
                      disabled={createOrder.isPending}
                    >
                      {createOrder.isPending ? 'Creating...' : 'Create Order'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Orders</CardTitle>
                <Activity className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{openOrders.length}</div>
                <p className="text-xs text-muted-foreground">Active trading orders</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Filled Orders</CardTitle>
                <TrendingUp className="size-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filledOrders.length}</div>
                <p className="text-xs text-muted-foreground">Successfully executed</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
                <X className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cancelledOrders.length}</div>
                <p className="text-xs text-muted-foreground">Cancelled orders</p>
              </CardContent>
            </Card>
          </div>

          {/* Orders Tabs */}
          <Tabs defaultValue="open" className="space-y-4">
            <TabsList>
              <TabsTrigger value="open">Open Orders ({openOrders.length})</TabsTrigger>
              <TabsTrigger value="filled">Filled ({filledOrders.length})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled ({cancelledOrders.length})</TabsTrigger>
              <TabsTrigger value="all">All Orders</TabsTrigger>
            </TabsList>

            {/* Open Orders */}
            <TabsContent value="open">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Open Orders</CardTitle>
                  <CardDescription>Your active trading orders</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : openOrders.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.side === 'BUY' ? 'default' : 'secondary'}>
                                {order.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{order.quantity.toFixed(4)}</TableCell>
                            <TableCell className="text-right">
                              {order.price ? formatCurrency(order.price) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {order.price
                                ? formatCurrency(order.quantity * order.price)
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelOrder(order.id)}
                                disabled={cancelOrder.isPending}
                              >
                                <X className="size-4 mr-1" />
                                Cancel
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No open orders
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Filled Orders */}
            <TabsContent value="filled">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Filled Orders</CardTitle>
                  <CardDescription>Successfully executed orders</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64" />
                  ) : filledOrders.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filledOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              {new Date(order.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">{order.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={order.side === 'BUY' ? 'default' : 'secondary'}>
                                {order.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{order.quantity.toFixed(4)}</TableCell>
                            <TableCell className="text-right">
                              {order.price ? formatCurrency(order.price) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {order.price
                                ? formatCurrency(order.quantity * order.price)
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No filled orders
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cancelled Orders */}
            <TabsContent value="cancelled">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>Cancelled Orders</CardTitle>
                  <CardDescription>Orders that were cancelled</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-64" />
                  ) : cancelledOrders.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cancelledOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              {new Date(order.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">{order.symbol}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{order.side}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{order.quantity.toFixed(4)}</TableCell>
                            <TableCell className="text-right">
                              {order.price ? formatCurrency(order.price) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No cancelled orders
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* All Orders */}
            <TabsContent value="all">
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardHeader>
                  <CardTitle>All Orders</CardTitle>
                  <CardDescription>Complete order history</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-96" />
                  ) : orders && orders.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>
                              {new Date(order.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">{order.symbol}</TableCell>
                            <TableCell>
                              <Badge variant={order.side === 'BUY' ? 'default' : 'secondary'}>
                                {order.side}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{order.quantity.toFixed(4)}</TableCell>
                            <TableCell className="text-right">
                              {order.price ? formatCurrency(order.price) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No orders yet
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
