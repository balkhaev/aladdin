import type { OnChainMetrics } from "@aladdin/core";
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WhaleTransactionsList } from "./whale-transactions-list";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const REFRESH_INTERVAL = 30_000; // 30 seconds
const MILLION = 1_000_000;
const THOUSAND = 1000;
const NVT_OVERVALUED_THRESHOLD = 100;
const NVT_UNDERVALUED_THRESHOLD = 50;

type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  loading?: boolean;
};

const MetricCard = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading,
}: MetricCardProps) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          {subtitle && <Skeleton className="mt-2 h-4 w-32" />}
        </CardContent>
      </Card>
    );
  }

  const getTrendColor = () => {
    if (trend === "up") return "text-green-600";
    if (trend === "down") return "text-red-600";
    return "text-gray-600";
  };

  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-4 w-4" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="font-bold text-2xl">{value}</div>
        {subtitle && (
          <div
            className={`mt-1 flex items-center gap-1 text-xs ${getTrendColor()}`}
          >
            {getTrendIcon()}
            <span>{subtitle}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

type BlockchainSentimentProps = {
  blockchain: "BTC" | "ETH";
};

const BlockchainSentiment = ({ blockchain }: BlockchainSentimentProps) => {
  const [metrics, setMetrics] = useState<OnChainMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/on-chain/metrics/${blockchain}/latest`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch metrics: ${response.status}`);
        }

        const result = (await response.json()) as {
          success: boolean;
          data: OnChainMetrics;
        };

        if (result.success) {
          setMetrics(result.data);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    const interval = setInterval(() => {
      fetchMetrics();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [blockchain]);

  const formatNumber = (num: number): string => {
    if (num >= MILLION) {
      return `${(num / MILLION).toFixed(2)}M`;
    }
    if (num >= THOUSAND) {
      return `${(num / THOUSAND).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  const getNetFlowTrend = (): "up" | "down" | "neutral" => {
    if (!metrics) return "neutral";
    if (metrics.exchangeFlow.netFlow > 0) return "down"; // Inflow to exchanges = bearish
    if (metrics.exchangeFlow.netFlow < 0) return "up"; // Outflow from exchanges = bullish
    return "neutral";
  };

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {blockchain}
            <Badge variant="destructive">Error</Badge>
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{blockchain}</h3>
        {metrics && (
          <Badge variant="outline">
            Updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <MetricCard
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          subtitle={
            metrics
              ? `${formatNumber(metrics.whaleTransactions.totalVolume)} ${blockchain}`
              : undefined
          }
          title="Whale Activity"
          value={metrics ? `${metrics.whaleTransactions.count} txs` : "0 txs"}
        />

        <MetricCard
          icon={
            metrics && metrics.exchangeFlow.netFlow > 0 ? (
              <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
            )
          }
          loading={loading}
          subtitle={(() => {
            if (!metrics) return;
            if (metrics.exchangeFlow.netFlow > 0) return "Inflow (Bearish)";
            if (metrics.exchangeFlow.netFlow < 0) return "Outflow (Bullish)";
            return "Neutral";
          })()}
          title="Exchange Net Flow"
          trend={getNetFlowTrend()}
          value={
            metrics
              ? `${formatNumber(Math.abs(metrics.exchangeFlow.netFlow))} ${blockchain}`
              : "0"
          }
        />

        <MetricCard
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          subtitle="Last 24h"
          title="Active Addresses"
          value={metrics ? formatNumber(metrics.activeAddresses) : "0"}
        />

        <MetricCard
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          subtitle={(() => {
            if (!metrics) return;
            if (metrics.nvtRatio > NVT_OVERVALUED_THRESHOLD)
              return "Overvalued";
            if (metrics.nvtRatio < NVT_UNDERVALUED_THRESHOLD)
              return "Undervalued";
            return "Fair";
          })()}
          title="NVT Ratio"
          trend={(() => {
            if (!metrics) return "neutral";
            if (metrics.nvtRatio > NVT_OVERVALUED_THRESHOLD) return "down";
            if (metrics.nvtRatio < NVT_UNDERVALUED_THRESHOLD) return "up";
            return "neutral";
          })()}
          value={metrics ? metrics.nvtRatio.toFixed(2) : "0"}
        />
      </div>

      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Additional Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">
                  Transaction Volume (24h)
                </p>
                <p className="font-semibold">
                  {formatNumber(metrics.transactionVolume)} {blockchain}
                </p>
              </div>
              {metrics.marketCap && (
                <div>
                  <p className="text-muted-foreground">Market Cap</p>
                  <p className="font-semibold">
                    ${formatNumber(metrics.marketCap)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Exchange Inflow (24h)</p>
                <p className="font-semibold">
                  {formatNumber(metrics.exchangeFlow.inflow)} {blockchain}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Exchange Outflow (24h)</p>
                <p className="font-semibold">
                  {formatNumber(metrics.exchangeFlow.outflow)} {blockchain}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Whale Transactions List */}
      {metrics && metrics.whaleTransactions.count > 0 && (
        <WhaleTransactionsList blockchain={blockchain} limit={10} />
      )}
    </div>
  );
};

export const OnChainSentiment = () => (
  <div className="space-y-8">
    <div>
      <h2 className="font-bold text-3xl tracking-tight">On-Chain Sentiment</h2>
      <p className="text-muted-foreground">
        Real-time blockchain metrics and sentiment indicators
      </p>
    </div>

    <BlockchainSentiment blockchain="BTC" />
    <BlockchainSentiment blockchain="ETH" />
  </div>
);
