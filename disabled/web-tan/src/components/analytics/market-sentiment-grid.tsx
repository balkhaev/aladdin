/**
 * Market Sentiment Grid
 * Displays sentiment for multiple symbols in a grid layout
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSentimentColor,
  getSentimentIcon,
  type SentimentSignal,
  useBatchSentiment,
} from "@/hooks/use-sentiment";

interface MarketSentimentGridProps {
  symbols: string[];
}

export function MarketSentimentGrid({ symbols }: MarketSentimentGridProps) {
  const { data: sentiments, isLoading, error } = useBatchSentiment(symbols);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {symbols.map((symbol) => (
              <Skeleton className="h-16" key={symbol} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (
    error ||
    !sentiments ||
    !Array.isArray(sentiments) ||
    sentiments.length === 0
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load market sentiment
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate market breadth
  const bullishCount = sentiments.filter(
    (s) => s.compositeSignal === "BULLISH"
  ).length;
  const marketBreadth = ((bullishCount / sentiments.length) * 100).toFixed(0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Market Sentiment</CardTitle>
          <Badge
            variant={
              Number(marketBreadth) > 60
                ? "default"
                : Number(marketBreadth) < 40
                  ? "destructive"
                  : "secondary"
            }
          >
            {marketBreadth}% Bullish
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {sentiments
            .sort((a, b) => b.compositeScore - a.compositeScore)
            .map((sentiment) => (
              <SentimentMiniCard key={sentiment.symbol} sentiment={sentiment} />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentMiniCard({
  sentiment,
}: {
  sentiment: {
    symbol: string;
    compositeScore: number;
    compositeSignal: SentimentSignal;
    strength: string;
  };
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <div className="font-medium">{sentiment.symbol}</div>
        <div className="flex items-center gap-2">
          <Badge
            className={`text-xs ${getSentimentColor(sentiment.compositeSignal)}`}
            variant="outline"
          >
            {getSentimentIcon(sentiment.compositeSignal)}{" "}
            {sentiment.compositeSignal}
          </Badge>
        </div>
      </div>
      <div className="text-right">
        <div
          className={`font-bold text-2xl ${getSentimentColor(sentiment.compositeSignal)}`}
        >
          {sentiment.compositeScore.toFixed(0)}
        </div>
        <div className="text-muted-foreground text-xs">
          {sentiment.strength}
        </div>
      </div>
    </div>
  );
}
