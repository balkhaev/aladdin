import type { OnChainMetrics, WhaleTransaction } from "@aladdin/shared/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Layers,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMetricDescription, getMetricStatus } from "@/lib/api/on-chain";

const REFETCH_INTERVAL_MINUTE = 60_000;
const REFETCH_INTERVAL_HALF_MINUTE = 30_000;
const MILLISECONDS_IN_DAY = 86_400_000;
const BILLION = 1_000_000_000;
const MILLISECONDS_IN_MINUTE = 60_000;
const MILLISECONDS_IN_HOUR = 3_600_000;
const MAX_WHALE_TX_LIMIT = 50;
const MAX_EXCHANGE_RESERVES_LIMIT = 20;
const SKELETON_CARDS_COUNT = 6;
const TX_HASH_START_LENGTH = 10;
const TX_HASH_END_LENGTH = 8;
const ADDRESS_START_LENGTH = 6;
const ADDRESS_END_LENGTH = 4;
const DECIMAL_PRECISION = 4;

export const Route = createFileRoute("/_auth/on-chain")({
  component: OnChainPage,
});

type Blockchain = "BTC" | "ETH";

function OnChainPage() {
  const [selectedBlockchain, setSelectedBlockchain] =
    useState<Blockchain>("BTC");

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">On-Chain Analytics</h1>
          <p className="text-muted-foreground">
            Real-time blockchain metrics and whale tracking
          </p>
        </div>
        <Select
          onValueChange={(value) => setSelectedBlockchain(value as Blockchain)}
          value={selectedBlockchain}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BTC">Bitcoin</SelectItem>
            <SelectItem value="ETH">Ethereum</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs className="space-y-4" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="whales">Whale Transactions</TabsTrigger>
          <TabsTrigger value="exchanges">Exchange Flows</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="overview">
          <OnChainOverview blockchain={selectedBlockchain} />
        </TabsContent>

        <TabsContent className="space-y-4" value="whales">
          <WhaleTransactionsTable blockchain={selectedBlockchain} />
        </TabsContent>

        <TabsContent className="space-y-4" value="exchanges">
          <ExchangeFlowsTable blockchain={selectedBlockchain} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OnChainOverview({ blockchain }: { blockchain: Blockchain }) {
  // Fetch latest metrics
  const { data: metrics, isLoading } = useQuery<OnChainMetrics>({
    queryKey: ["on-chain", "latest", blockchain],
    queryFn: async () => {
      const response = await fetch(
        `/api/on-chain/metrics/${blockchain}/latest`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const result = await response.json();
      return result.data;
    },
    refetchInterval: REFETCH_INTERVAL_MINUTE,
  });

  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: SKELETON_CARDS_COUNT }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: "Whale Transactions",
      value: metrics.whaleTransactions.count,
      subtitle: `${metrics.whaleTransactions.totalVolume.toFixed(2)} ${blockchain} volume`,
      icon: Activity,
      color: "text-blue-500",
      description: getMetricDescription("whaleTransactions"),
    },
    {
      title: "Exchange Inflow",
      value: `${metrics.exchangeFlow.inflow.toFixed(2)} ${blockchain}`,
      subtitle: "To exchanges",
      icon: ArrowDownToLine,
      color: "text-green-500",
      description: "Coins flowing into exchanges (potential selling pressure)",
    },
    {
      title: "Exchange Outflow",
      value: `${metrics.exchangeFlow.outflow.toFixed(2)} ${blockchain}`,
      subtitle: "From exchanges",
      icon: ArrowUpFromLine,
      color: "text-red-500",
      description: "Coins flowing out of exchanges (potential holding)",
    },
    {
      title: "Net Flow",
      value: `${metrics.exchangeFlow.netFlow.toFixed(2)} ${blockchain}`,
      subtitle: metrics.exchangeFlow.netFlow > 0 ? "Inflow" : "Outflow",
      icon: TrendingUp,
      color:
        metrics.exchangeFlow.netFlow > 0 ? "text-green-500" : "text-red-500",
      description: "Net flow to/from exchanges",
    },
    {
      title: "Active Addresses",
      value: metrics.activeAddresses.toLocaleString(),
      subtitle: "Last 24 hours",
      icon: Users,
      color: "text-purple-500",
      description: getMetricDescription("activeAddresses"),
    },
    {
      title: "NVT Ratio",
      value: metrics.nvtRatio.toFixed(2),
      subtitle: "Network value to transactions",
      icon: Wallet,
      color: "text-orange-500",
      description: getMetricDescription("nvtRatio"),
      status: getMetricStatus("nvtRatio", metrics.nvtRatio),
    },
  ];

  // Advanced metrics (only if available)
  const advancedStats = [
    metrics.sopr !== undefined && {
      title: "SOPR",
      value: metrics.sopr.toFixed(3),
      subtitle: metrics.sopr > 1 ? "Profit-taking" : "Selling at loss",
      icon: BarChart3,
      color: metrics.sopr > 1 ? "text-green-500" : "text-red-500",
      description: getMetricDescription("sopr"),
      status: getMetricStatus("sopr", metrics.sopr),
    },
    metrics.exchangeReserve !== undefined && {
      title: "Exchange Reserve",
      value: `${(metrics.exchangeReserve / 1000).toFixed(1)}K ${blockchain}`,
      subtitle: "On exchanges",
      icon: Layers,
      color: "text-cyan-500",
      description: getMetricDescription("exchangeReserve"),
      status: getMetricStatus("exchangeReserve", metrics.exchangeReserve),
    },
    metrics.stockToFlow !== undefined && {
      title: "Stock-to-Flow",
      value: metrics.stockToFlow.toFixed(1),
      subtitle: "Scarcity model",
      icon: TrendingDown,
      color: "text-amber-500",
      description: getMetricDescription("stockToFlow"),
      status: getMetricStatus("stockToFlow", metrics.stockToFlow),
    },
  ].filter(Boolean);

  return (
    <TooltipProvider>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Tooltip key={stat.title}>
            <TooltipTrigger asChild>
              <Card className="cursor-help transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="font-medium text-sm">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="font-bold text-2xl">{stat.value}</div>
                  <p className="text-muted-foreground text-xs">
                    {stat.subtitle}
                  </p>
                  {stat.status &&
                    (() => {
                      let variant: "default" | "destructive" | "secondary" =
                        "secondary";
                      let label = "Neutral";

                      if (stat.status === "positive") {
                        variant = "default";
                        label = "Bullish";
                      } else if (stat.status === "negative") {
                        variant = "destructive";
                        label = "Bearish";
                      }

                      return (
                        <Badge className="mt-2" variant={variant}>
                          {label}
                        </Badge>
                      );
                    })()}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{stat.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {advancedStats.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-lg">Advanced Metrics</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {advancedStats.map((stat) => (
              <Tooltip key={stat.title}>
                <TooltipTrigger asChild>
                  <Card className="cursor-help transition-shadow hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="font-medium text-sm">
                        {stat.title}
                      </CardTitle>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="font-bold text-2xl">{stat.value}</div>
                      <p className="text-muted-foreground text-xs">
                        {stat.subtitle}
                      </p>
                      {stat.status &&
                        (() => {
                          let variant: "default" | "destructive" | "secondary" =
                            "secondary";
                          let label = "Neutral";

                          if (stat.status === "positive") {
                            variant = "default";
                            label = "Bullish";
                          } else if (stat.status === "negative") {
                            variant = "destructive";
                            label = "Bearish";
                          }

                          return (
                            <Badge className="mt-2" variant={variant}>
                              {label}
                            </Badge>
                          );
                        })()}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{stat.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {metrics.marketCap && (
        <Card>
          <CardHeader>
            <CardTitle>Market Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Market Cap:</span>
              <span className="font-semibold">
                ${(metrics.marketCap / BILLION).toFixed(2)}B
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Transaction Volume:</span>
              <span className="font-semibold">
                {metrics.transactionVolume.toFixed(2)} {blockchain}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="text-muted-foreground text-sm">
                {new Date(metrics.timestamp).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </TooltipProvider>
  );
}

function WhaleTransactionsTable({ blockchain }: { blockchain: Blockchain }) {
  const { data, isLoading } = useQuery<WhaleTransaction[]>({
    queryKey: ["on-chain", "whale-transactions", blockchain],
    queryFn: async () => {
      const to = Date.now();
      const from = to - MILLISECONDS_IN_DAY;

      const response = await fetch(
        `/api/on-chain/whale-transactions/${blockchain}?from=${from}&to=${to}&limit=${MAX_WHALE_TX_LIMIT}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch whale transactions");
      }
      const result = await response.json();
      return result.data;
    },
    refetchInterval: REFETCH_INTERVAL_HALF_MINUTE,
  });

  if (isLoading) {
    return <div className="text-center">Loading whale transactions...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Activity className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No whale transactions found</p>
          <p className="text-muted-foreground text-sm">
            Transactions will appear here when detected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Whale Transactions - Last 24 Hours ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((tx) => (
              <TableRow key={tx.transactionHash}>
                <TableCell className="text-muted-foreground text-sm">
                  {formatTime(tx.timestamp)}
                </TableCell>
                <TableCell>
                  <a
                    className="font-mono text-blue-500 text-sm hover:underline"
                    href={getExplorerUrl(blockchain, tx.transactionHash)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {tx.transactionHash.slice(0, TX_HASH_START_LENGTH)}...
                    {tx.transactionHash.slice(-TX_HASH_END_LENGTH)}
                  </a>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatAddress(tx.from)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatAddress(tx.to)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">
                    {tx.value.toFixed(DECIMAL_PRECISION)} {blockchain}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExchangeFlowsTable({ blockchain }: { blockchain: Blockchain }) {
  const { data, isLoading } = useQuery({
    queryKey: ["on-chain", "exchange-reserves", blockchain],
    queryFn: async () => {
      const to = Date.now();
      const from = to - MILLISECONDS_IN_DAY;

      const response = await fetch(
        `/api/on-chain/exchange-reserves/${blockchain}?from=${from}&to=${to}&limit=${MAX_EXCHANGE_RESERVES_LIMIT}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch exchange reserves");
      }
      const result = await response.json();
      return result.data;
    },
    refetchInterval: REFETCH_INTERVAL_MINUTE,
  });

  if (isLoading) {
    return <div className="text-center">Loading exchange flows...</div>;
  }

  const hasReserves = data?.reserves && data.reserves.length > 0;

  if (!hasReserves) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Wallet className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            No exchange flow data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exchange Reserves - Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exchange</TableHead>
              <TableHead className="text-right">Inflow</TableHead>
              <TableHead className="text-right">Outflow</TableHead>
              <TableHead className="text-right">Net Flow</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.reserves.map((reserve, idx) => (
              <TableRow key={`${reserve.exchange}-${idx}`}>
                <TableCell className="font-medium capitalize">
                  {reserve.exchange}
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-green-600">
                    +{reserve.inflow.toFixed(DECIMAL_PRECISION)} {blockchain}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-red-600">
                    -{reserve.outflow.toFixed(DECIMAL_PRECISION)} {blockchain}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant={reserve.netFlow > 0 ? "default" : "secondary"}
                  >
                    {reserve.netFlow > 0 ? "+" : ""}
                    {reserve.netFlow.toFixed(DECIMAL_PRECISION)} {blockchain}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatTime(reserve.timestamp)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// Helper functions
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / MILLISECONDS_IN_MINUTE);
  const hours = Math.floor(diff / MILLISECONDS_IN_HOUR);

  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "just now";
}

function formatAddress(address: string): string {
  if (
    address === "unknown" ||
    address === "multiple" ||
    address === "contract"
  ) {
    return address;
  }
  return `${address.slice(0, ADDRESS_START_LENGTH)}...${address.slice(-ADDRESS_END_LENGTH)}`;
}

function getExplorerUrl(blockchain: string, txHash: string): string {
  switch (blockchain.toUpperCase()) {
    case "BTC":
      return `https://mempool.space/tx/${txHash}`;
    case "ETH":
      return `https://etherscan.io/tx/${txHash}`;
    default:
      return "#";
  }
}
