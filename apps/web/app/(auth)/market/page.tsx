"use client";

/**
 * Market Overview Page
 * Compact widgets with general information from all sections
 */

import { CategoryPerformance } from "@/components/macro/category-performance";
import { DominanceChart } from "@/components/macro/dominance-chart";
import { FearGreedGauge } from "@/components/macro/fear-greed-gauge";
import { GlobalMarketStats } from "@/components/macro/global-market-stats";
import { TrendingCoins } from "@/components/macro/trending-coins";
import { MarketOverview } from "@/components/market-overview";
import { MarketTickerWS } from "@/components/market-ticker-ws";
import { SocialSentimentCompact } from "@/components/social-sentiment-compact";
import { WidgetGrid } from "@/components/ui/widget-grid";

export default function MarketOverviewPage() {
  return (
    <div className="flex-1 space-y-2 p-3">
      {/* Real-time Tickers */}
      <WidgetGrid columns={4}>
        <MarketTickerWS symbol="BTCUSDT" />
        <MarketTickerWS symbol="ETHUSDT" />
        <MarketTickerWS symbol="BNBUSDT" />
        <MarketTickerWS symbol="SOLUSDT" />
      </WidgetGrid>

      {/* Global Market Stats */}
      <GlobalMarketStats />

      {/* Combined Sentiment - Compact */}
      <SocialSentimentCompact />

      {/* Market Overview - Top Movers */}
      <MarketOverview />

      {/* Fear & Greed + Dominance */}
      <WidgetGrid columns={2}>
        <FearGreedGauge />
        <DominanceChart />
      </WidgetGrid>

      {/* Trending Coins + Category Performance */}
      <WidgetGrid columns={2}>
        <TrendingCoins />
        <CategoryPerformance />
      </WidgetGrid>
    </div>
  );
}
