/**
 * Combined Sentiment Card Component
 * Displays aggregated sentiment from Analytics, Futures, and Order Book
 */

import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useCombinedSentiment } from "../hooks/use-combined-sentiment";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";

type CombinedSentimentCardProps = {
  symbol: string;
};

const PERCENTAGE_MULTIPLIER = 100;
const PROGRESS_SCALE = 100;

export function CombinedSentimentCard({ symbol }: CombinedSentimentCardProps) {
  const { data: sentiment, isLoading, error } = useCombinedSentiment(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Combined Sentiment Analysis</CardTitle>
          <CardDescription>Aggregated market intelligence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Combined Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Unable to load sentiment data
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get sentiment color
  const getSentimentColor = (signal: string) => {
    if (signal === "BULLISH") return "text-green-500";
    if (signal === "BEARISH") return "text-red-500";
    return "text-gray-300";
  };

  const getSentimentIcon = (signal: string) => {
    if (signal === "BULLISH") return <TrendingUp className="h-5 w-5" />;
    if (signal === "BEARISH") return <TrendingDown className="h-5 w-5" />;
    return null;
  };

  const getRecommendationColor = (action: string) => {
    if (action === "STRONG_BUY" || action === "BUY")
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    if (action === "STRONG_SELL" || action === "SELL")
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  const getRecommendationIcon = (action: string) => {
    if (action === "STRONG_BUY" || action === "BUY")
      return <CheckCircle2 className="h-4 w-4" />;
    if (action === "STRONG_SELL" || action === "SELL")
      return <XCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getRiskColor = (risk: string) => {
    if (risk === "LOW") return "text-green-500";
    if (risk === "MEDIUM") return "text-yellow-500";
    return "text-red-500";
  };

  // Normalize score to 0-100 for progress bar
  const progressValue = (sentiment.combinedScore + PROGRESS_SCALE) / 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Combined Sentiment
          <Badge className={getSentimentColor(sentiment.combinedSignal)}>
            {sentiment.combinedSignal}
          </Badge>
        </CardTitle>
        <CardDescription>
          Агрегированный анализ рыночных данных для {symbol}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-sm">Общий Score</span>
              <p className="text-muted-foreground text-xs">
                От -100 (продавать) до +100 (покупать)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getSentimentIcon(sentiment.combinedSignal)}
              <span
                className={`font-bold text-lg ${getSentimentColor(sentiment.combinedSignal)}`}
              >
                {sentiment.combinedScore.toFixed(1)}
              </span>
            </div>
          </div>
          <Progress className="h-2" value={progressValue} />
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Медвежий (-100)</span>
            <span>Нейтральный (0)</span>
            <span>Бычий (+100)</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg border p-4">
          <div className="mb-2">
            <p className="font-medium text-sm">Рекомендация</p>
            <p className="text-muted-foreground text-xs">
              На основе всех компонентов анализа
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                {getRecommendationIcon(sentiment.recommendation.action)}
                <Badge
                  className={getRecommendationColor(
                    sentiment.recommendation.action
                  )}
                >
                  {sentiment.recommendation.action.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {sentiment.recommendation.reasoning}
              </p>
            </div>
            <div className="ml-4 text-right">
              <p className="text-muted-foreground text-xs">Риск</p>
              <p
                className={`font-semibold text-sm ${getRiskColor(sentiment.recommendation.riskLevel)}`}
              >
                {sentiment.recommendation.riskLevel}
              </p>
            </div>
          </div>
        </div>

        {/* Component Breakdown */}
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm">Анализ компонентов</h4>
            <p className="text-muted-foreground text-xs">
              Каждый источник данных анализируется отдельно
            </p>
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between rounded border p-3">
            <div className="flex-1">
              <p className="font-medium text-sm">Аналитика</p>
              <p className="text-muted-foreground text-xs">
                Индекс страха/жадности, ончейн-метрики, техническая аналитика
              </p>
            </div>
            <div className="ml-2 text-right">
              <Badge
                className={getSentimentColor(
                  sentiment.components.analytics.signal
                )}
              >
                {sentiment.components.analytics.signal}
              </Badge>
              <p className="mt-1 text-muted-foreground text-xs">
                {Math.round(
                  sentiment.components.analytics.confidence *
                    PERCENTAGE_MULTIPLIER
                )}
                % уверенности
              </p>
            </div>
          </div>

          {/* Futures */}
          <div className="flex items-center justify-between rounded border p-3">
            <div className="flex-1">
              <p className="font-medium text-sm">Фьючерсы</p>
              <p className="text-muted-foreground text-xs">
                Ставки финансирования и открытый интерес
              </p>
            </div>
            <div className="ml-2 text-right">
              <Badge
                className={getSentimentColor(
                  sentiment.components.futures.signal
                )}
              >
                {sentiment.components.futures.signal}
              </Badge>
              <p className="mt-1 text-muted-foreground text-xs">
                {Math.round(
                  sentiment.components.futures.confidence *
                    PERCENTAGE_MULTIPLIER
                )}
                % уверенности
              </p>
            </div>
          </div>

          {/* Order Book */}
          <div className="flex items-center justify-between rounded border p-3">
            <div className="flex-1">
              <p className="font-medium text-sm">Книга заявок</p>
              <p className="text-muted-foreground text-xs">
                Дисбаланс покупок/продаж и ликвидность
              </p>
            </div>
            <div className="ml-2 text-right">
              <Badge
                className={getSentimentColor(
                  sentiment.components.orderBook.signal
                )}
              >
                {sentiment.components.orderBook.signal}
              </Badge>
              <p className="mt-1 text-muted-foreground text-xs">
                {Math.round(
                  sentiment.components.orderBook.confidence *
                    PERCENTAGE_MULTIPLIER
                )}
                % уверенности
              </p>
            </div>
          </div>

          {/* Social Sentiment */}
          <div className="flex items-center justify-between rounded border p-3">
            <div className="flex-1">
              <p className="font-medium text-sm">Соцсети</p>
              <p className="text-muted-foreground text-xs">
                Настроение в Telegram и Twitter
              </p>
            </div>
            <div className="ml-2 text-right">
              <Badge
                className={getSentimentColor(
                  sentiment.components.social.signal
                )}
              >
                {sentiment.components.social.signal}
              </Badge>
              <p className="mt-1 text-muted-foreground text-xs">
                {Math.round(
                  sentiment.components.social.confidence * PERCENTAGE_MULTIPLIER
                )}
                % уверенности
              </p>
            </div>
          </div>
        </div>

        {/* Confidence & Strength */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded border p-3 text-center">
            <p className="text-muted-foreground text-xs">Уверенность</p>
            <p className="mt-1 font-bold text-2xl">
              {Math.round(sentiment.confidence * PERCENTAGE_MULTIPLIER)}%
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Надежность сигнала
            </p>
          </div>
          <div className="rounded border p-3 text-center">
            <p className="text-muted-foreground text-xs">Сила</p>
            <p className="mt-1 font-bold text-2xl">{sentiment.strength}</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Интенсивность тренда
            </p>
          </div>
        </div>

        {/* Insights */}
        {sentiment.insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Ключевые инсайты</h4>
            <ul className="space-y-1">
              {sentiment.insights.map((insight, index) => (
                <li className="text-muted-foreground text-xs" key={index}>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
