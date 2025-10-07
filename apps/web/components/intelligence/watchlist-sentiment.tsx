/**
 * Watchlist Sentiment Component
 * Displays sentiment analysis for watchlist symbols
 */

import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

const INSIGHT_PREVIEW_LENGTH = 50;

import { SentimentCard } from "@/components/analytics/sentiment-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type CompositeSentiment,
  getSentimentBgColor,
  getSentimentColor,
  getSentimentIcon,
  useBatchSentiment,
} from "@/hooks/use-sentiment";

// Default watchlist symbols
const DEFAULT_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "MATICUSDT",
  "AVAXUSDT",
];

export function WatchlistSentiment() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    DEFAULT_WATCHLIST[0]
  );
  const {
    data: sentiments,
    isLoading,
    error,
  } = useBatchSentiment(DEFAULT_WATCHLIST);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Sentiment Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !sentiments) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Sentiment Watchlist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="size-4" />
            Failed to load sentiment data
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate market breadth
  const bullishCount = sentiments.filter(
    (s) => s.compositeSignal === "BULLISH"
  ).length;
  const bearishCount = sentiments.filter(
    (s) => s.compositeSignal === "BEARISH"
  ).length;
  const neutralCount = sentiments.filter(
    (s) => s.compositeSignal === "NEUTRAL"
  ).length;

  // Sort by composite score
  const sortedBullish = [...sentiments]
    .filter((s) => s.compositeSignal === "BULLISH")
    .sort((a, b) => b.compositeScore - a.compositeScore);

  const sortedBearish = [...sentiments]
    .filter((s) => s.compositeSignal === "BEARISH")
    .sort((a, b) => a.compositeScore - b.compositeScore);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Market Sentiment Watchlist</CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">
              Real-time sentiment for major assets
            </p>
          </div>
          {/* Market Breadth Indicator */}
          <div className="flex gap-2">
            <Badge className="bg-green-500/10" variant="outline">
              🟢 {bullishCount}
            </Badge>
            <Badge className="bg-gray-500/10" variant="outline">
              ⚪ {neutralCount}
            </Badge>
            <Badge className="bg-red-500/10" variant="outline">
              🔴 {bearishCount}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs className="space-y-4" defaultValue="overview">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="bullish">Bullish ({bullishCount})</TabsTrigger>
            <TabsTrigger value="bearish">Bearish ({bearishCount})</TabsTrigger>
            <TabsTrigger value="detail">Detail</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent className="space-y-3" value="overview">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {sentiments.map((sentiment) => (
                <MiniSentimentCard
                  key={sentiment.symbol}
                  onClick={() => setSelectedSymbol(sentiment.symbol)}
                  sentiment={sentiment}
                />
              ))}
            </div>
          </TabsContent>

          {/* Bullish Tab */}
          <TabsContent className="space-y-3" value="bullish">
            {sortedBullish.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No bullish signals found
              </div>
            ) : (
              <div className="space-y-3">
                {sortedBullish.map((sentiment) => (
                  <SignalRow
                    key={sentiment.symbol}
                    onClick={() => setSelectedSymbol(sentiment.symbol)}
                    sentiment={sentiment}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bearish Tab */}
          <TabsContent className="space-y-3" value="bearish">
            {sortedBearish.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No bearish signals found
              </div>
            ) : (
              <div className="space-y-3">
                {sortedBearish.map((sentiment) => (
                  <SignalRow
                    key={sentiment.symbol}
                    onClick={() => setSelectedSymbol(sentiment.symbol)}
                    sentiment={sentiment}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Detail Tab */}
          <TabsContent className="space-y-4" value="detail">
            <div className="flex items-center gap-2">
              {DEFAULT_WATCHLIST.map((symbol) => (
                <Button
                  key={symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  size="sm"
                  variant={selectedSymbol === symbol ? "default" : "outline"}
                >
                  {symbol.replace("USDT", "")}
                </Button>
              ))}
            </div>
            <SentimentCard symbol={selectedSymbol} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MiniSentimentCard({
  sentiment,
  onClick,
}: {
  sentiment: CompositeSentiment;
  onClick: () => void;
}) {
  const hasDivergence = sentiment.insights.some((i) => i.includes("⚠️"));

  return (
    <button
      className={`${getSentimentBgColor(sentiment.compositeSignal)} relative rounded-lg border p-4 text-left transition-all hover:scale-105 hover:shadow-lg`}
      onClick={onClick}
      type="button"
    >
      {hasDivergence && (
        <div className="absolute top-2 right-2">
          <AlertCircle className="size-4 text-yellow-500" />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold">
            {sentiment.symbol.replace("USDT", "")}
          </span>
          <span className="text-xs">
            {getSentimentIcon(sentiment.compositeSignal)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`font-bold text-2xl ${getSentimentColor(sentiment.compositeSignal)}`}
          >
            {sentiment.compositeScore.toFixed(0)}
          </span>
          <div className="text-right text-xs">
            <div className="text-muted-foreground">{sentiment.strength}</div>
            <div className="font-medium">{sentiment.confidence}%</div>
          </div>
        </div>
      </div>
    </button>
  );
}

function SignalRow({
  sentiment,
  onClick,
}: {
  sentiment: CompositeSentiment;
  onClick: () => void;
}) {
  const Icon =
    sentiment.compositeSignal === "BULLISH" ? TrendingUp : TrendingDown;
  const hasDivergence = sentiment.insights.some((i) => i.includes("⚠️"));

  return (
    <button
      className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex size-10 items-center justify-center rounded-lg ${getSentimentBgColor(sentiment.compositeSignal)}`}
        >
          <Icon
            className={`size-5 ${getSentimentColor(sentiment.compositeSignal)}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {sentiment.symbol.replace("USDT", "")}
            </span>
            {hasDivergence && (
              <AlertCircle className="size-4 text-yellow-500" />
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {sentiment.insights[0]?.substring(0, INSIGHT_PREVIEW_LENGTH) ?? ""}
            ...
          </p>
        </div>
      </div>

      <div className="text-right">
        <div
          className={`font-bold text-2xl ${getSentimentColor(sentiment.compositeSignal)}`}
        >
          {sentiment.compositeScore.toFixed(0)}
        </div>
        <div className="text-muted-foreground text-xs">
          {sentiment.strength} • {sentiment.confidence}%
        </div>
      </div>
    </button>
  );
}
