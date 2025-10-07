"use client";

/**
 * Sentiment Analysis Page
 * Social sentiment and market mood analysis
 */

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { AIAnalyzedFeed } from "@/components/ai-analyzed-feed";
import { FundingRatesCard } from "@/components/analytics/funding-rates-card";
import { MarketSentimentGrid } from "@/components/analytics/market-sentiment-grid";
import { OrderBookSentimentCard } from "@/components/analytics/order-book-sentiment-card";
import { SentimentHistoryChart } from "@/components/analytics/sentiment-history-chart";
import { CombinedSentimentCard } from "@/components/combined-sentiment-card";
import { SocialSentimentCard } from "@/components/social-sentiment-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const AVAILABLE_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
];

export default function SentimentPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header with Symbol Selector */}
      <div className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10">
              <MessageSquare className="size-6 text-green-500" />
            </div>
            <div>
              <h1 className="font-bold text-3xl tracking-tight">
                Анализ Настроений
              </h1>
              <p className="text-muted-foreground">
                Комплексный анализ рыночных настроений из разных источников
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Symbol:</span>
            <Select onValueChange={setSelectedSymbol} value={selectedSymbol}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_SYMBOLS.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol.replace("USDT", "")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Top Row - Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CombinedSentimentCard symbol={selectedSymbol} />
        <SocialSentimentCard symbol={selectedSymbol} />
        <FundingRatesCard symbol={selectedSymbol} />
      </div>

      {/* Middle Row - History & Analysis */}
      <div className="grid gap-4 md:grid-cols-2">
        <SentimentHistoryChart symbol={selectedSymbol} />
        <OrderBookSentimentCard symbol={selectedSymbol} />
      </div>

      {/* Market Overview Grid */}
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold text-xl">Обзор Рынка</h2>
          <p className="text-muted-foreground text-sm">
            Настроения по остальным топовым криптовалютам для сравнения
          </p>
        </div>
        <MarketSentimentGrid
          symbols={AVAILABLE_SYMBOLS.filter(
            (symbol) => symbol !== selectedSymbol
          )}
        />
      </div>

      {/* AI Analyzed Feed - Full Width */}
      <AIAnalyzedFeed />
    </div>
  );
}
