"use client";

/**
 * Arbitrage Page
 * Cross-exchange arbitrage opportunities
 */

import { Brain } from "lucide-react";
import { AggregatedPriceCard } from "@/components/aggregated-price-card";
import { ArbitrageOpportunitiesCard } from "@/components/arbitrage-opportunities-card";


export default function ArbitragePage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
            <Brain className="size-6 text-cyan-500" />
          </div>
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Арбитраж</h1>
            <p className="text-muted-foreground">
              Арбитражные возможности между биржами
            </p>
          </div>
        </div>
      </div>

      {/* Aggregated Prices */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-xl">Aggregated Prices (VWAP)</h2>
          <p className="text-muted-foreground text-sm">
            Volume-weighted average price across multiple exchanges
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AggregatedPriceCard symbol="BTCUSDT" />
          <AggregatedPriceCard symbol="ETHUSDT" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <AggregatedPriceCard symbol="BNBUSDT" />
          <AggregatedPriceCard symbol="SOLUSDT" />
        </div>
      </div>

      {/* Arbitrage Opportunities */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-xl">Arbitrage Opportunities</h2>
          <p className="text-muted-foreground text-sm">
            Real-time price spreads across exchanges with profit potential
          </p>
        </div>
        <ArbitrageOpportunitiesCard />
      </div>
    </div>
  );
}
