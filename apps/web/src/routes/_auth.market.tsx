/**
 * Market Overview Page
 * Unified market dashboard with real-time data, analytics, and on-chain metrics
 */

import { createFileRoute } from "@tanstack/react-router";
import { Activity, BarChart3, Link2, TrendingUp } from "lucide-react";
import { MarketSentimentGrid } from "@/components/analytics/market-sentiment-grid";
import { CategoryPerformance } from "@/components/macro/category-performance";
import { CorrelationMatrix } from "@/components/macro/correlation-matrix";
import { DominanceChart } from "@/components/macro/dominance-chart";
import { FearGreedGauge } from "@/components/macro/fear-greed-gauge";
import { FearGreedHistory } from "@/components/macro/fear-greed-history";
import { GlobalMarketStats } from "@/components/macro/global-market-stats";
import { MarketHeatmap } from "@/components/macro/market-heatmap";
import { TrendingCoins } from "@/components/macro/trending-coins";
import { MarketOverview } from "@/components/market-overview";
import { MarketTickerWS } from "@/components/market-ticker-ws";
import { OnChainSentiment } from "@/components/on-chain-sentiment";
import { SocialSentimentCompact } from "@/components/social-sentiment-compact";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_auth/market")({
  component: MarketOverviewPage,
});

function MarketOverviewPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <TrendingUp className="size-6 text-blue-500" />
          </div>
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Обзор рынка</h1>
            <p className="text-muted-foreground">
              Real-time рыночные данные, метрики и аналитика
            </p>
          </div>
        </div>
      </div>

      {/* Real-time Tickers */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MarketTickerWS symbol="BTCUSDT" />
        <MarketTickerWS symbol="ETHUSDT" />
        <MarketTickerWS symbol="BNBUSDT" />
      </div>

      {/* Global Market Stats */}
      <GlobalMarketStats />

      {/* Main Content Tabs */}
      <Tabs className="space-y-6" defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 lg:w-[550px]">
          <TabsTrigger className="gap-2" value="overview">
            <Activity className="size-4" />
            <span className="hidden sm:inline">Обзор</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="analytics">
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">Аналитика</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="onchain">
            <Link2 className="size-4" />
            <span className="hidden sm:inline">On-Chain</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent className="space-y-6" value="overview">
          {/* Market Overview - Top Movers */}
          <MarketOverview />

          {/* Market Sentiment */}
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">Sentiment Analysis</h2>
            <MarketSentimentGrid
              symbols={[
                "BTCUSDT",
                "ETHUSDT",
                "BNBUSDT",
                "SOLUSDT",
                "ADAUSDT",
                "DOGEUSDT",
              ]}
            />
          </div>

          {/* Combined Sentiment */}
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">Combined Sentiment</h2>
            <p className="text-muted-foreground text-sm">
              Multi-source sentiment analysis from Technical, Futures, and Order
              Book data
            </p>
            <SocialSentimentCompact />
          </div>

          {/* Fear & Greed + Dominance */}
          <div className="grid gap-4 md:grid-cols-2">
            <FearGreedGauge />
            <DominanceChart />
          </div>

          {/* Trending Coins + Category Performance */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendingCoins />
            <CategoryPerformance />
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent className="space-y-6" value="analytics">
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">Fear & Greed History</h2>
            <FearGreedHistory />
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-xl">Market Heatmap</h2>
            <p className="text-muted-foreground text-sm">
              Визуализация рыночной капитализации и изменений цен
            </p>
            <MarketHeatmap />
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-xl">Correlation Matrix</h2>
            <CorrelationMatrix />
          </div>
        </TabsContent>

        {/* On-Chain Tab */}
        <TabsContent className="space-y-6" value="onchain">
          <OnChainSentiment />
        </TabsContent>
      </Tabs>
    </div>
  );
}
