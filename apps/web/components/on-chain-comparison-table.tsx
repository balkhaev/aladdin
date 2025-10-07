/**
 * BTC vs ETH Comparison Table Component
 * Side-by-side comparison of on-chain metrics
 */

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatMetricValue,
  getMetricDescription,
  getMetricsComparison,
} from "@/lib/api/on-chain";

const REFETCH_INTERVAL = 60_000; // 1 minute

type MetricRow = {
  name: string;
  label: string;
  btcValue: string | number;
  ethValue: string | number;
  description: string;
  better: "btc" | "eth" | "neutral";
};

export function OnChainComparisonTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["on-chain-comparison"],
    queryFn: getMetricsComparison,
    refetchInterval: REFETCH_INTERVAL,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BTC vs ETH Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading comparison...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.btc || !data?.eth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BTC vs ETH Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">
              Unable to load comparison data
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { btc, eth } = data;

  const compareMetrics = (
    btcVal: number | undefined,
    ethVal: number | undefined,
    higherIsBetter: boolean
  ): "btc" | "eth" | "neutral" => {
    if (btcVal === undefined || ethVal === undefined) return "neutral";
    if (btcVal === ethVal) return "neutral";

    const btcBetter = btcVal > ethVal;
    if (higherIsBetter) {
      return btcBetter ? "btc" : "eth";
    }
    return btcBetter ? "eth" : "btc";
  };

  const metrics: MetricRow[] = [
    {
      name: "whaleTransactions",
      label: "Whale Transactions",
      btcValue: btc.whaleTransactions.count,
      ethValue: eth.whaleTransactions.count,
      description: getMetricDescription("whaleTransactions"),
      better: compareMetrics(
        btc.whaleTransactions.count,
        eth.whaleTransactions.count,
        false
      ),
    },
    {
      name: "activeAddresses",
      label: "Active Addresses",
      btcValue: btc.activeAddresses.toLocaleString(),
      ethValue: eth.activeAddresses.toLocaleString(),
      description: getMetricDescription("activeAddresses"),
      better: compareMetrics(btc.activeAddresses, eth.activeAddresses, true),
    },
    {
      name: "nvtRatio",
      label: "NVT Ratio",
      btcValue: btc.nvtRatio.toFixed(2),
      ethValue: eth.nvtRatio.toFixed(2),
      description: getMetricDescription("nvtRatio"),
      better: compareMetrics(btc.nvtRatio, eth.nvtRatio, false),
    },
    {
      name: "exchangeNetFlow",
      label: "Exchange Net Flow",
      btcValue: `${btc.exchangeFlow.netFlow.toFixed(2)} BTC`,
      ethValue: `${eth.exchangeFlow.netFlow.toFixed(2)} ETH`,
      description: "Net flow to/from exchanges",
      better: compareMetrics(
        btc.exchangeFlow.netFlow,
        eth.exchangeFlow.netFlow,
        false
      ),
    },
    {
      name: "transactionVolume",
      label: "Transaction Volume",
      btcValue: `${formatMetricValue(btc.transactionVolume)} BTC`,
      ethValue: `${formatMetricValue(eth.transactionVolume)} ETH`,
      description: getMetricDescription("transactionVolume"),
      better: compareMetrics(
        btc.transactionVolume,
        eth.transactionVolume,
        true
      ),
    },
  ];

  // Add advanced metrics if available
  if (btc.sopr !== undefined && eth.sopr !== undefined) {
    metrics.push({
      name: "sopr",
      label: "SOPR",
      btcValue: btc.sopr.toFixed(3),
      ethValue: eth.sopr.toFixed(3),
      description: getMetricDescription("sopr"),
      better: "neutral", // SOPR interpretation depends on context
    });
  }

  if (btc.exchangeReserve !== undefined && eth.exchangeReserve !== undefined) {
    metrics.push({
      name: "exchangeReserve",
      label: "Exchange Reserve",
      btcValue: `${formatMetricValue(btc.exchangeReserve)} BTC`,
      ethValue: `${formatMetricValue(eth.exchangeReserve)} ETH`,
      description: getMetricDescription("exchangeReserve"),
      better: compareMetrics(btc.exchangeReserve, eth.exchangeReserve, false),
    });
  }

  if (btc.stockToFlow !== undefined) {
    metrics.push({
      name: "stockToFlow",
      label: "Stock-to-Flow",
      btcValue: btc.stockToFlow.toFixed(1),
      ethValue: "N/A",
      description: getMetricDescription("stockToFlow"),
      better: "neutral",
    });
  }

  const getBetterIcon = (better: "btc" | "eth" | "neutral") => {
    if (better === "neutral") {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
    return better === "btc" ? (
      <ArrowUp className="h-4 w-4 text-green-500" />
    ) : (
      <ArrowDown className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>BTC vs ETH Comparison</CardTitle>
        <p className="text-muted-foreground text-sm">
          Side-by-side comparison of on-chain metrics
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Metric</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>Bitcoin</span>
                    <Badge variant="outline">BTC</Badge>
                  </div>
                </TableHead>
                <TableHead className="w-[60px] text-center">Better</TableHead>
                <TableHead className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span>Ethereum</span>
                    <Badge variant="outline">ETH</Badge>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((metric) => (
                <TableRow className="hover:bg-muted/50" key={metric.name}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{metric.label}</span>
                      <span className="text-muted-foreground text-xs">
                        {metric.description.slice(0, 50)}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono">{metric.btcValue}</span>
                      {metric.better === "btc" && (
                        <Badge className="mt-1" variant="default">
                          Better
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {getBetterIcon(metric.better)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                      <span className="font-mono">{metric.ethValue}</span>
                      {metric.better === "eth" && (
                        <Badge className="mt-1" variant="default">
                          Better
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-muted-foreground text-xs">
          <p>
            * "Better" indicates which blockchain has more favorable metrics
            based on typical market analysis.
          </p>
          <p className="mt-1">
            Last updated: {new Date(btc.timestamp).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
