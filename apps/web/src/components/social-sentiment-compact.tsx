/**
 * Compact Combined Sentiment Component
 * Displays combined sentiment in a compact format for dashboard/market overview
 */

import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Info,
  Layers,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type CombinedSentiment,
  useBatchCombinedSentiment,
} from "@/hooks/use-combined-sentiment";
import { getSentimentColor } from "@/hooks/use-sentiment-color";
import { formatScore } from "@/lib/format";

type SocialSentimentCompactProps = {
  symbols?: string[];
};

const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
const SENTIMENT_THRESHOLD = 0.3;
const SCORE_DECIMALS = 2;

export const SocialSentimentCompact = memo(
  function SocialSentimentCompactComponent({
    symbols = DEFAULT_SYMBOLS,
  }: SocialSentimentCompactProps) {
    const {
      data: sentiments,
      isLoading,
      error,
    } = useBatchCombinedSentiment(symbols);

    // Memoize sentiments array check
    const sentimentsArray = useMemo(
      () => (Array.isArray(sentiments) ? sentiments : []),
      [sentiments]
    );

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
          <CardTitle className="flex items-center gap-2 text-sm">
            Combined Sentiment
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Multi-source sentiment analysis from Technical, Futures, and
                    Order Book data
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sentimentsArray.map((sentiment) => (
              <SentimentRowComponent
                key={sentiment.symbol}
                sentiment={sentiment}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

const SentimentRowComponent = memo(function SentimentRowMemo({
  sentiment,
}: {
  sentiment: CombinedSentiment;
}) {
  const signal = sentiment.combinedSignal;

  // Memoize signal icon
  const signalIcon = useMemo(() => {
    if (signal === "BULLISH") {
      return <TrendingUp className="h-3 w-3" />;
    }
    if (signal === "BEARISH") {
      return <TrendingDown className="h-3 w-3" />;
    }
    return null;
  }, [signal]);

  // Memoize symbol name
  const symbolName = useMemo(
    () => sentiment.symbol.replace("USDT", ""),
    [sentiment.symbol]
  );

  // Memoize sentiment colors
  const analyticsColor = useMemo(
    () =>
      getSentimentColor(
        sentiment.components.analytics.score,
        SENTIMENT_THRESHOLD
      ),
    [sentiment.components.analytics.score]
  );

  const futuresColor = useMemo(
    () =>
      getSentimentColor(
        sentiment.components.futures.score,
        SENTIMENT_THRESHOLD
      ),
    [sentiment.components.futures.score]
  );

  const orderBookColor = useMemo(
    () =>
      getSentimentColor(
        sentiment.components.orderBook.score,
        SENTIMENT_THRESHOLD
      ),
    [sentiment.components.orderBook.score]
  );

  const combinedColor = useMemo(
    () => getSentimentColor(sentiment.combinedScore, SENTIMENT_THRESHOLD),
    [sentiment.combinedScore]
  );

  // Memoize strength badge variant
  const strengthVariant = useMemo(() => {
    if (sentiment.strength === "STRONG") return "default";
    if (sentiment.strength === "MODERATE") return "secondary";
    return "outline";
  }, [sentiment.strength]);

  // Memoize recommendation badge variant and color
  const recommendationBadge = useMemo(() => {
    const action = sentiment.recommendation.action;
    if (action === "STRONG_BUY")
      return { variant: "default" as const, color: "text-green-600" };
    if (action === "BUY")
      return { variant: "secondary" as const, color: "text-green-500" };
    if (action === "HOLD")
      return { variant: "outline" as const, color: "text-yellow-600" };
    if (action === "SELL")
      return { variant: "secondary" as const, color: "text-red-500" };
    return { variant: "destructive" as const, color: "text-red-600" };
  }, [sentiment.recommendation.action]);

  // Memoize risk level color
  const riskColor = useMemo(() => {
    if (sentiment.recommendation.riskLevel === "HIGH") return "text-red-500";
    if (sentiment.recommendation.riskLevel === "MEDIUM")
      return "text-yellow-500";
    return "text-green-500";
  }, [sentiment.recommendation.riskLevel]);

  return (
    <div className="rounded-lg border bg-card transition-colors hover:bg-accent/30">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b p-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-base">{symbolName}</span>
          <Badge className="text-xs" variant="outline">
            {signalIcon}
            <span className="ml-1">{signal}</span>
          </Badge>
          <Badge className="text-xs" variant={strengthVariant}>
            {sentiment.strength}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* Recommendation */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  className={`text-xs ${recommendationBadge.color}`}
                  variant={recommendationBadge.variant}
                >
                  {sentiment.recommendation.action.replace("_", " ")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="mb-1 font-medium text-xs">Reasoning:</p>
                <p className="text-xs">{sentiment.recommendation.reasoning}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Risk Level */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Shield className={`h-3 w-3 ${riskColor}`} />
                  <span className={`font-medium text-xs ${riskColor}`}>
                    {sentiment.recommendation.riskLevel}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Risk Level</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Combined Score */}
          <span className={`font-bold text-lg ${combinedColor}`}>
            {formatScore(sentiment.combinedScore, SCORE_DECIMALS)}
          </span>
        </div>
      </div>

      {/* Components Row */}
      <div className="flex items-center justify-between p-3 pt-2">
        <div className="flex items-center gap-4">
          {/* Analytics */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                  <div className="flex flex-col">
                    <span className={`font-semibold text-xs ${analyticsColor}`}>
                      {formatScore(
                        sentiment.components.analytics.score,
                        SCORE_DECIMALS
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(
                        sentiment.components.analytics.confidence * 100
                      )}
                      %
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Technical • Weight:{" "}
                  {formatScore(sentiment.components.analytics.weight, 2)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Futures */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-purple-500" />
                  <div className="flex flex-col">
                    <span className={`font-semibold text-xs ${futuresColor}`}>
                      {formatScore(
                        sentiment.components.futures.score,
                        SCORE_DECIMALS
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(
                        sentiment.components.futures.confidence * 100
                      )}
                      %
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Futures • Weight:{" "}
                  {formatScore(sentiment.components.futures.weight, 2)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Order Book */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-green-500" />
                  <div className="flex flex-col">
                    <span className={`font-semibold text-xs ${orderBookColor}`}>
                      {formatScore(
                        sentiment.components.orderBook.score,
                        SCORE_DECIMALS
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(
                        sentiment.components.orderBook.confidence * 100
                      )}
                      %
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Order Book • Weight:{" "}
                  {formatScore(sentiment.components.orderBook.weight, 2)}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Overall Confidence */}
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Confidence:</span>
          <span className="font-semibold text-xs">
            {Math.round(sentiment.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Insights Row (if available) */}
      {sentiment.insights && sentiment.insights.length > 0 && (
        <div className="border-t p-3 pt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-pointer items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <p className="line-clamp-1 text-muted-foreground text-xs">
                    {sentiment.insights[0]}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <div className="space-y-1">
                  <p className="font-medium text-xs">Insights:</p>
                  {sentiment.insights.map((insight, idx) => (
                    <p className="text-xs" key={idx}>
                      • {insight}
                    </p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
});
