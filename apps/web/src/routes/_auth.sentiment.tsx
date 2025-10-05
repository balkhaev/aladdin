/**
 * Combined Sentiment Analysis Page
 * Displays combined sentiment from Technical Analytics, Futures, and Order Book data
 */

import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, BookOpen, Layers } from "lucide-react";
import { useState } from "react";
import { SocialSentimentCard } from "@/components/social-sentiment-card";
import { SocialSentimentCompact } from "@/components/social-sentiment-compact";
import { SymbolCombobox } from "@/components/symbol-combobox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_auth/sentiment")({
  component: SentimentPage,
});

const POPULAR_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
];

const SYMBOL_OPTIONS = POPULAR_SYMBOLS.map((symbol) => ({
  value: symbol,
  label: symbol,
}));

function SentimentPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">
          Combined Sentiment Analysis
        </h1>
        <p className="text-muted-foreground">
          Multi-source sentiment combining Technical Analytics, Futures Market,
          and Order Book data
        </p>
      </div>

      {/* Data Sources Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Technical Analytics</span>
              <Badge className="text-xs" variant="outline">
                Active
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Futures Market</span>
              <Badge className="text-xs" variant="outline">
                Active
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              <span className="text-sm">Order Book</span>
              <Badge className="text-xs" variant="outline">
                Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs className="space-y-6" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detail">Detailed Analysis</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="overview">
          {/* Popular Pairs Sentiment */}
          <SocialSentimentCompact symbols={POPULAR_SYMBOLS} />

          {/* Info Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-sm">Technical Analytics</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  RSI, MACD, EMA, and other technical indicators:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                  <li>Multiple timeframe analysis</li>
                  <li>Trend detection algorithms</li>
                  <li>Support/resistance levels</li>
                  <li>Volume-weighted signals</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-sm">Futures Market</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Funding rates and open interest analysis:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                  <li>Multi-exchange funding rates</li>
                  <li>Open interest trends</li>
                  <li>Long/short ratio analysis</li>
                  <li>Liquidation pressure detection</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-sm">Order Book</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Real-time order book depth analysis:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                  <li>Bid/ask spread monitoring</li>
                  <li>Large order detection</li>
                  <li>Supply/demand imbalance</li>
                  <li>Market maker activity</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent className="space-y-6" value="detail">
          {/* Symbol Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Symbol</CardTitle>
            </CardHeader>
            <CardContent>
              <SymbolCombobox
                onValueChange={setSelectedSymbol}
                symbols={SYMBOL_OPTIONS}
                value={selectedSymbol}
              />
            </CardContent>
          </Card>

          {/* Detailed Sentiment Card */}
          <SocialSentimentCard symbol={selectedSymbol} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
