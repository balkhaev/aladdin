/**
 * Social Sentiment Card Component
 * Displays sentiment from Telegram and Twitter sources
 */

import {
  Activity,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Twitter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatConfidence,
  formatScore,
  getSentimentBgColorFromScore,
  getSentimentColorFromScore,
  getSentimentSignal,
  getStrengthFromScore,
  useSocialSentiment,
} from "@/hooks/use-social-sentiment";

interface SocialSentimentCardProps {
  symbol: string;
}

export function SocialSentimentCard({ symbol }: SocialSentimentCardProps) {
  const { data: sentiment, isLoading, error } = useSocialSentiment(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Sentiment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load sentiment data
          </div>
        </CardContent>
      </Card>
    );
  }

  const signal = getSentimentSignal(sentiment.overall);
  const strength = getStrengthFromScore(sentiment.overall);

  const getStrengthColor = (s: string) => {
    switch (s) {
      case "STRONG":
        return "bg-orange-500";
      case "MODERATE":
        return "bg-yellow-500";
      case "WEAK":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSignalIcon = (sig: string) => {
    switch (sig) {
      case "BULLISH":
        return <TrendingUp className="h-4 w-4" />;
      case "BEARISH":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Social Sentiment</CardTitle>
          <Badge
            className={getSentimentBgColorFromScore(sentiment.overall)}
            variant="outline"
          >
            <div className="flex items-center gap-1">
              {getSignalIcon(signal)}
              <span>{signal}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Overall Score</span>
            </div>
            <span
              className={`font-bold text-2xl ${getSentimentColorFromScore(sentiment.overall)}`}
            >
              {formatScore(sentiment.overall)}
            </span>
          </div>
          <Progress
            className="h-2"
            value={((sentiment.overall + 1) / 2) * 100}
          />
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Bearish (-1)</span>
            <span>Neutral (0)</span>
            <span>Bullish (+1)</span>
          </div>
        </div>

        {/* Confidence & Strength */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Confidence</div>
            <div className="font-bold text-2xl">
              {formatConfidence(sentiment.confidence)}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Strength</div>
            <Badge className={getStrengthColor(strength)}>{strength}</Badge>
          </div>
        </div>

        {/* Source Breakdown */}
        <div className="space-y-3">
          <div className="font-medium text-sm">Sources</div>

          {/* Telegram */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Telegram</span>
              </div>
              <span
                className={`font-semibold ${getSentimentColorFromScore(sentiment.telegram.score)}`}
              >
                {formatScore(sentiment.telegram.score)}
              </span>
            </div>
            <Progress
              className="h-1.5"
              value={((sentiment.telegram.score + 1) / 2) * 100}
            />
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-muted-foreground">Bullish</div>
                <div className="font-semibold text-green-500">
                  {sentiment.telegram.bullish}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Bearish</div>
                <div className="font-semibold text-red-500">
                  {sentiment.telegram.bearish}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold">
                  {sentiment.telegram.signals}
                </div>
              </div>
            </div>
          </div>

          {/* Twitter */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-sky-500" />
                <span className="font-medium text-sm">Twitter</span>
              </div>
              <span
                className={`font-semibold ${getSentimentColorFromScore(sentiment.twitter.score)}`}
              >
                {formatScore(sentiment.twitter.score)}
              </span>
            </div>
            <Progress
              className="h-1.5"
              value={((sentiment.twitter.score + 1) / 2) * 100}
            />
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="text-muted-foreground">Positive</div>
                <div className="font-semibold text-green-500">
                  {sentiment.twitter.positive}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Negative</div>
                <div className="font-semibold text-red-500">
                  {sentiment.twitter.negative}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Neutral</div>
                <div className="font-semibold text-gray-500">
                  {sentiment.twitter.neutral}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold">{sentiment.twitter.tweets}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-right text-muted-foreground text-xs">
          Updated: {new Date(sentiment.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
