/**
 * Compact Social Sentiment Component
 * Displays sentiment in a compact format for dashboard/market overview
 */

import { MessageSquare, TrendingDown, TrendingUp, Twitter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatScore,
  getSentimentColorFromScore,
  getSentimentSignal,
  type SocialSentimentAnalysis,
  useBatchSocialSentiment,
} from "@/hooks/use-social-sentiment";

interface SocialSentimentCompactProps {
  symbols?: string[];
}

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

export function SocialSentimentCompact({
  symbols = DEFAULT_SYMBOLS,
}: SocialSentimentCompactProps) {
  const {
    data: sentiments,
    isLoading,
    error,
  } = useBatchSocialSentiment(symbols);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Social Sentiment</CardTitle>
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
          <CardTitle className="text-sm">Social Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-xs">
            Failed to load sentiment data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Social Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sentiments.map((sentiment) => (
            <SentimentRow key={sentiment.symbol} sentiment={sentiment} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SentimentRow({ sentiment }: { sentiment: SocialSentimentAnalysis }) {
  const signal = getSentimentSignal(sentiment.overall);

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
        {/* Telegram */}
        <div className="flex items-center gap-1 text-xs">
          <MessageSquare className="h-3 w-3 text-blue-500" />
          <span
            className={`font-semibold ${getSentimentColorFromScore(sentiment.telegram.score)}`}
          >
            {formatScore(sentiment.telegram.score)}
          </span>
          <span className="text-muted-foreground">
            ({sentiment.telegram.signals})
          </span>
        </div>

        {/* Twitter */}
        <div className="flex items-center gap-1 text-xs">
          <Twitter className="h-3 w-3 text-sky-500" />
          <span
            className={`font-semibold ${getSentimentColorFromScore(sentiment.twitter.score)}`}
          >
            {formatScore(sentiment.twitter.score)}
          </span>
          <span className="text-muted-foreground">
            ({sentiment.twitter.tweets})
          </span>
        </div>

        {/* Overall */}
        <div className="flex items-center gap-1">
          <span
            className={`font-bold text-sm ${getSentimentColorFromScore(sentiment.overall)}`}
          >
            {formatScore(sentiment.overall)}
          </span>
        </div>
      </div>
    </div>
  );
}
