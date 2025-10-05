/**
 * Compact Combined Sentiment Component
 * Displays combined sentiment in a compact format for dashboard/market overview
 */

import {
  BarChart3,
  BookOpen,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CombinedSentiment,
  useBatchCombinedSentiment,
} from "@/hooks/use-combined-sentiment";

type SocialSentimentCompactProps = {
  symbols?: string[];
};

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

// Constants
const SENTIMENT_THRESHOLD = 0.3;
const SCORE_DECIMAL_PLACES = 2;

// Helper functions
const formatScore = (score: number): string =>
  score.toFixed(SCORE_DECIMAL_PLACES);

const getSentimentColorFromScore = (score: number): string => {
  if (score > SENTIMENT_THRESHOLD) return "text-green-500";
  if (score < -SENTIMENT_THRESHOLD) return "text-red-500";
  return "text-gray-500";
};

export function SocialSentimentCompact({
  symbols = DEFAULT_SYMBOLS,
}: SocialSentimentCompactProps) {
  const {
    data: sentiments,
    isLoading,
    error,
  } = useBatchCombinedSentiment(symbols);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Combined Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {symbols.map((symbol) => (
              <Skeleton className="h-12 w-full" key={symbol} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !sentiments) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Combined Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-xs">
            Failed to load sentiment data
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ensure sentiments is an array
  const sentimentsArray = Array.isArray(sentiments) ? sentiments : [];

  if (sentimentsArray.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Combined Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-xs">
            No sentiment data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Combined Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sentimentsArray.map((sentiment) => (
            <SentimentRow key={sentiment.symbol} sentiment={sentiment} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentRow({ sentiment }: { sentiment: CombinedSentiment }) {
  const signal = sentiment.combinedSignal;

  const getSignalIcon = (sig: string) => {
    switch (sig) {
      case "BULLISH":
        return <TrendingUp className="h-3 w-3" />;
      case "BEARISH":
        return <TrendingDown className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-2 transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">
          {sentiment.symbol.replace("USDT", "")}
        </span>
        <Badge className="text-xs" variant="outline">
          {getSignalIcon(signal)}
          <span className="ml-1">{signal}</span>
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {/* Analytics */}
        <div className="flex items-center gap-1 text-xs">
          <BarChart3 className="h-3 w-3 text-blue-500" />
          <span
            className={`font-semibold ${getSentimentColorFromScore(sentiment.components.analytics.score)}`}
          >
            {formatScore(sentiment.components.analytics.score)}
          </span>
        </div>

        {/* Futures */}
        <div className="flex items-center gap-1 text-xs">
          <Layers className="h-3 w-3 text-purple-500" />
          <span
            className={`font-semibold ${getSentimentColorFromScore(sentiment.components.futures.score)}`}
          >
            {formatScore(sentiment.components.futures.score)}
          </span>
        </div>

        {/* Order Book */}
        <div className="flex items-center gap-1 text-xs">
          <BookOpen className="h-3 w-3 text-green-500" />
          <span
            className={`font-semibold ${getSentimentColorFromScore(sentiment.components.orderBook.score)}`}
          >
            {formatScore(sentiment.components.orderBook.score)}
          </span>
        </div>

        {/* Combined Score */}
        <div className="flex items-center gap-1">
          <span
            className={`font-bold text-sm ${getSentimentColorFromScore(sentiment.combinedScore)}`}
          >
            {formatScore(sentiment.combinedScore)}
          </span>
        </div>
      </div>
    </div>
  );
}
