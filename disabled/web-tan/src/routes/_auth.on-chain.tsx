/**
 * On-Chain Data Page
 * Blockchain metrics and whale tracking
 */

import type { OnChainMetrics } from "@aladdin/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { useState } from "react";
import { OnChainAlertsPanel } from "@/components/alerts/onchain-alerts-panel";
import { AdvancedMetricsCard } from "@/components/on-chain/advanced-metrics-card";
import { CorrelationHeatmap } from "@/components/on-chain/correlation-heatmap";
import { MarketCycleIndicator } from "@/components/on-chain/market-cycle-indicator";
import { PatternDetectionPanel } from "@/components/on-chain/pattern-detection-panel";
import { SimilarPeriodsCard } from "@/components/on-chain/similar-periods-card";
import { OnChainSentiment } from "@/components/on-chain-sentiment";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOnChainMetricsWS } from "@/hooks/use-onchain-metrics-ws";

export const Route = createFileRoute("/_auth/on-chain")({
  component: OnChainPage,
});

async function fetchOnChainMetrics(
  blockchain: string
): Promise<OnChainMetrics> {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/on-chain/metrics/${blockchain}/latest`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch on-chain metrics");
  }
  const data = await response.json();
  return data.data;
}

function OnChainPage() {
  // WebSocket real-time updates for BTC
  const { metrics: btcMetricsWS, isConnected: btcWsConnected } =
    useOnChainMetricsWS({
      blockchain: "BTC",
      enabled: true,
    });

  // WebSocket real-time updates for ETH
  const { metrics: ethMetricsWS, isConnected: ethWsConnected } =
    useOnChainMetricsWS({
      blockchain: "ETH",
      enabled: true,
    });

  // Fallback REST API data (initial load only)
  const { data: btcMetricsRest } = useQuery({
    queryKey: ["onchain-metrics", "BTC"],
    queryFn: () => fetchOnChainMetrics("BTC"),
    // Only fetch once on mount if WebSocket not connected
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !btcWsConnected,
  });

  const { data: ethMetricsRest } = useQuery({
    queryKey: ["onchain-metrics", "ETH"],
    queryFn: () => fetchOnChainMetrics("ETH"),
    // Only fetch once on mount if WebSocket not connected
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !ethWsConnected,
  });

  // Use WebSocket data if available, otherwise fallback to REST
  const btcMetrics = btcMetricsWS || btcMetricsRest;
  const ethMetrics = ethMetricsWS || ethMetricsRest;

  // Period for correlations (last 30 days)
  const [period] = useState({
    from: Date.now() - 30 * 24 * 60 * 60 * 1000,
    to: Date.now(),
  });

  // Mock data for pattern detection and historical context
  // In production, these would come from the sentiment analysis API
  const mockPatterns = [
    {
      type: "smart_money_accumulation" as const,
      confidence: 85,
      signal: "bullish" as const,
      description:
        "Smart money accumulation detected - whales buying, exchange reserves declining",
      indicators: [
        "Exchange reserves declining by 15%",
        "Whale activity increasing (20+ transactions)",
        "MVRV at 1.2 (undervalued)",
        "Accumulation score: 45",
      ],
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
    },
  ];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <Activity className="size-6 text-purple-500" />
          </div>
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              On-Chain данные
            </h1>
            <p className="text-muted-foreground">
              Блокчейн метрики, активность сети и отслеживание китов
            </p>
          </div>
        </div>
      </div>

      {/* Alerts Panel */}
      <OnChainAlertsPanel blockchain="all" maxVisible={5} />

      {/* Main Content */}
      <Tabs className="w-full" defaultValue="btc">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="btc">Bitcoin (BTC)</TabsTrigger>
          <TabsTrigger value="eth">Ethereum (ETH)</TabsTrigger>
        </TabsList>

        {/* BTC Tab */}
        <TabsContent className="space-y-4" value="btc">
          {/* Nested tabs for different sections */}
          <Tabs className="w-full" defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
              <TabsTrigger value="correlations">Correlations</TabsTrigger>
              <TabsTrigger value="cycle">Market Cycle</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent className="space-y-4" value="overview">
              <OnChainSentiment />
              {btcMetrics && <AdvancedMetricsCard metrics={btcMetrics} />}
            </TabsContent>

            {/* Patterns Tab */}
            <TabsContent className="space-y-4" value="patterns">
              <PatternDetectionPanel blockchain="BTC" patterns={mockPatterns} />
            </TabsContent>

            {/* Correlations Tab */}
            <TabsContent className="space-y-4" value="correlations">
              <CorrelationHeatmap blockchain="BTC" period={period} />
            </TabsContent>

            {/* Market Cycle Tab */}
            <TabsContent className="space-y-4" value="cycle">
              <div className="grid gap-4 lg:grid-cols-2">
                <MarketCycleIndicator
                  blockchain="BTC"
                  confidence={78}
                  phase="early_bull"
                  recommendation="Early bull market - momentum building. Consider accumulating positions with proper risk management."
                />
                <SimilarPeriodsCard blockchain="BTC" periods={[]} />
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ETH Tab */}
        <TabsContent className="space-y-4" value="eth">
          <Tabs className="w-full" defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
              <TabsTrigger value="correlations">Correlations</TabsTrigger>
              <TabsTrigger value="cycle">Market Cycle</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent className="space-y-4" value="overview">
              <OnChainSentiment />
              {ethMetrics && ethMetrics.reserveRisk !== undefined && (
                <AdvancedMetricsCard metrics={ethMetrics} />
              )}
            </TabsContent>

            {/* Patterns Tab */}
            <TabsContent className="space-y-4" value="patterns">
              <PatternDetectionPanel blockchain="ETH" patterns={[]} />
            </TabsContent>

            {/* Correlations Tab */}
            <TabsContent className="space-y-4" value="correlations">
              <CorrelationHeatmap blockchain="ETH" period={period} />
            </TabsContent>

            {/* Market Cycle Tab */}
            <TabsContent className="space-y-4" value="cycle">
              <div className="grid gap-4 lg:grid-cols-2">
                <MarketCycleIndicator
                  blockchain="ETH"
                  confidence={65}
                  phase="accumulation"
                  recommendation="Accumulation phase - historically favorable for entry. Monitor for continuation signals."
                />
                <SimilarPeriodsCard blockchain="ETH" periods={[]} />
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
