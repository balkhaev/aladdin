/**
 * Social Sentiment Analysis Page
 * Displays detailed sentiment from Telegram and Twitter
 */

import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CheckCircle, MessageSquare, Twitter } from "lucide-react";
import { useState } from "react";
import { SocialSentimentCard } from "@/components/social-sentiment-card";
import { SocialSentimentCompact } from "@/components/social-sentiment-compact";
import { SymbolCombobox } from "@/components/symbol-combobox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSentimentServicesHealth } from "@/hooks/use-social-sentiment";

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
  const { data: servicesHealth } = useSentimentServicesHealth();

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">
          Social Sentiment Analysis
        </h1>
        <p className="text-muted-foreground">
          Real-time sentiment tracking from Telegram channels and Twitter
          influencers
        </p>
      </div>

      {/* Services Status */}
      {servicesHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Sources Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Telegram</span>
                {servicesHealth.telegram ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                <span className="text-sm">Twitter</span>
                {servicesHealth.twitter ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <Badge
                className="ml-auto"
                variant={servicesHealth.allHealthy ? "default" : "destructive"}
              >
                {servicesHealth.allHealthy
                  ? "All Systems Operational"
                  : "Degraded"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

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
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  <CardTitle className="text-sm">Telegram Sources</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Monitoring trading signals from Telegram channels:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                  <li>@markettwits - Trading signals</li>
                  <li>Real-time parsing of LONG/SHORT signals</li>
                  <li>Entry, targets, and stop loss extraction</li>
                  <li>10+ supported cryptocurrencies</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Twitter className="h-5 w-5 text-sky-500" />
                  <CardTitle className="text-sm">Twitter Sources</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Tracking 15 crypto influencers:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                  <li>VitalikButerin - Ethereum founder</li>
                  <li>APompliano - Crypto analyst</li>
                  <li>saylor - MicroStrategy CEO</li>
                  <li>CryptoCobain, WClementeThird, and more</li>
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
