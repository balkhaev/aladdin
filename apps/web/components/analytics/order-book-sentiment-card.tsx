/**
 * Order Book Sentiment Card Component
 * Displays order book sentiment analysis
 */

import { BookOpen, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCombinedSentiment } from "@/hooks/use-combined-sentiment";

type OrderBookSentimentCardProps = {
  symbol: string;
};

const PERCENTAGE_MULTIPLIER = 100;

export function OrderBookSentimentCard({
  symbol,
}: OrderBookSentimentCardProps) {
  const { data: sentiment, isLoading, error } = useCombinedSentiment(symbol);

  if (isLoading) {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            Order Book Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full animate-pulse" />
          <Skeleton className="h-12 w-full animate-pulse" />
          <Skeleton className="h-12 w-full animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (error || !sentiment) {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-amber-500" />
            Order Book Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Unable to load order book data
          </p>
        </CardContent>
      </Card>
    );
  }

  const orderBookData = sentiment.components.orderBook;
  const signal = orderBookData.signal;

  const getSentimentColor = (sig: string) => {
    if (sig === "BULLISH") return "text-green-500";
    if (sig === "BEARISH") return "text-red-500";
    return "text-gray-500";
  };

  const getSentimentIcon = (sig: string) => {
    if (sig === "BULLISH") return <TrendingUp className="h-4 w-4" />;
    if (sig === "BEARISH") return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getSentimentBgColor = (sig: string) => {
    if (sig === "BULLISH") return "bg-green-500/10 border-green-500/20";
    if (sig === "BEARISH") return "bg-red-500/10 border-red-500/20";
    return "bg-gray-500/10 border-gray-500/20";
  };

  // Normalize score from -100..100 to 0..100 for progress bar
  const progressValue = (orderBookData.score + 100) / 2;

  // Calculate bid/ask pressure (score is from -100 to 100)
  // If score is positive, more buy pressure; if negative, more sell pressure
  const normalizedScore = (orderBookData.score + 100) / 2; // Convert -100..100 to 0..100
  const bidPressure = normalizedScore;
  const askPressure = 100 - normalizedScore;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-amber-500" />
              Анализ Книги Заявок
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-xs">
              Дисбаланс покупок и продаж на рынке
            </p>
          </div>
          <Badge className={getSentimentBgColor(signal)} variant="outline">
            <div className="flex items-center gap-1">
              {getSentimentIcon(signal)}
              <span>{signal}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Сентимент Книги Заявок</span>
            <span className={`font-bold text-2xl ${getSentimentColor(signal)}`}>
              {orderBookData.score.toFixed(2)}
            </span>
          </div>
          <Progress className="h-2" value={progressValue} />
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Медвежий (-100)</span>
            <span>Нейтральный (0)</span>
            <span>Бычий (+100)</span>
          </div>
        </div>

        {/* Bid/Ask Pressure */}
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Давление Покупок</span>
              <span className="font-semibold text-green-500 text-sm">
                {bidPressure.toFixed(0)}%
              </span>
            </div>
            <Progress className="h-1.5" value={bidPressure} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Давление Продаж</span>
              <span className="font-semibold text-red-500 text-sm">
                {askPressure.toFixed(0)}%
              </span>
            </div>
            <Progress className="h-1.5" value={askPressure} />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Confidence */}
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground text-xs">Уверенность</p>
            <p className="mt-1 font-bold text-lg">
              {Math.round(orderBookData.confidence * PERCENTAGE_MULTIPLIER)}%
            </p>
          </div>

          {/* Weight */}
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground text-xs">Вес</p>
            <p className="mt-1 font-bold text-lg">
              {Math.round(orderBookData.weight * PERCENTAGE_MULTIPLIER)}%
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Дисбаланс книги заявок показывает относительное давление покупок
            против продаж, основываясь на размерах биды и аска на разных ценовых
            уровнях.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
