/**
 * Combined Sentiment Card Component
 * Displays combined sentiment from Analytics, Futures, and Order Book data
 */

import {
  Activity,
  BarChart3,
  BookOpen,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCombinedSentiment } from "@/hooks/use-combined-sentiment";

type SocialSentimentCardProps = {
  symbol: string;
};

// Constants
const SENTIMENT_THRESHOLD = 0.3;
const SCORE_DECIMAL_PLACES = 2;
const PERCENTAGE_MULTIPLIER = 100;
const PROGRESS_NORMALIZER = 2; // Normalize -1 to 1 range to 0 to 100

// Helper functions
const formatScore = (score: number): string =>
  score.toFixed(SCORE_DECIMAL_PLACES);

const getSentimentColorFromScore = (score: number): string => {
  if (score > SENTIMENT_THRESHOLD) return "text-green-500";
  if (score < -SENTIMENT_THRESHOLD) return "text-red-500";
  return "text-gray-500";
};

const getSentimentBgColorFromScore = (score: number): string => {
  if (score > SENTIMENT_THRESHOLD) return "bg-green-500/10 border-green-500/20";
  if (score < -SENTIMENT_THRESHOLD) return "bg-red-500/10 border-red-500/20";
  return "bg-gray-500/10 border-gray-500/20";
};

const getStrengthColor = (strength: string) => {
  switch (strength) {
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

export function SocialSentimentCard({ symbol }: SocialSentimentCardProps) {
  const { data: sentiment, isLoading, error } = useCombinedSentiment(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Социальный Сентимент</CardTitle>
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
          <CardTitle>Социальный Сентимент</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Не удалось загрузить данные о настроениях
          </div>
        </CardContent>
      </Card>
    );
  }

  const signal = sentiment.combinedSignal;
  const strength = sentiment.strength;

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

  const getRecommendationColor = (action: string) => {
    if (action.includes("BUY"))
      return "bg-green-500/20 text-green-600 border-green-500/30";
    if (action.includes("SELL"))
      return "bg-red-500/20 text-red-600 border-red-500/30";
    return "bg-gray-500/20 text-gray-600 border-gray-500/30";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Социальный Сентимент</CardTitle>
            <p className="mt-1 text-muted-foreground text-xs">
              Настроения в соцсетях и чатах
            </p>
          </div>
          <Badge
            className={getSentimentBgColorFromScore(sentiment.combinedScore)}
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
              <span className="font-medium text-sm">Общий Score</span>
            </div>
            <span
              className={`font-bold text-2xl ${getSentimentColorFromScore(sentiment.combinedScore)}`}
            >
              {formatScore(sentiment.combinedScore)}
            </span>
          </div>
          <Progress
            className="h-2"
            value={
              ((sentiment.combinedScore + 1) / PROGRESS_NORMALIZER) *
              PERCENTAGE_MULTIPLIER
            }
          />
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Медвежий (-1)</span>
            <span>Нейтральный (0)</span>
            <span>Бычий (+1)</span>
          </div>
        </div>

        {/* Recommendation & Strength */}
        <div className="space-y-3">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-sm">Рекомендация</span>
              <Badge
                className={getRecommendationColor(
                  sentiment.recommendation.action
                )}
                variant="outline"
              >
                {sentiment.recommendation.action.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              {sentiment.recommendation.reasoning}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs">Риск: </span>
              <Badge className="text-xs" variant="outline">
                {sentiment.recommendation.riskLevel}
              </Badge>
              <span className="ml-auto text-xs">Сила: </span>
              <Badge className={getStrengthColor(strength)} variant="outline">
                {strength}
              </Badge>
            </div>
          </div>
        </div>

        {/* Component Breakdown */}
        <div className="space-y-3">
          <div className="font-medium text-sm">Компоненты</div>

          {/* Analytics */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">
                  Техническая Аналитика
                </span>
              </div>
              <span
                className={`font-semibold ${getSentimentColorFromScore(sentiment.components.analytics.score)}`}
              >
                {formatScore(sentiment.components.analytics.score)}
              </span>
            </div>
            <Progress
              className="h-1.5"
              value={
                ((sentiment.components.analytics.score + 1) /
                  PROGRESS_NORMALIZER) *
                PERCENTAGE_MULTIPLIER
              }
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Сигнал: {sentiment.components.analytics.signal}
              </span>
              <span className="text-muted-foreground">
                Вес:{" "}
                {(
                  sentiment.components.analytics.weight * PERCENTAGE_MULTIPLIER
                ).toFixed(0)}
                %
              </span>
              <span className="text-muted-foreground">
                Уверенность:{" "}
                {(
                  sentiment.components.analytics.confidence *
                  PERCENTAGE_MULTIPLIER
                ).toFixed(0)}
                %
              </span>
            </div>
          </div>

          {/* Futures */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-sm">Фьючерсный Рынок</span>
              </div>
              <span
                className={`font-semibold ${getSentimentColorFromScore(sentiment.components.futures.score)}`}
              >
                {formatScore(sentiment.components.futures.score)}
              </span>
            </div>
            <Progress
              className="h-1.5"
              value={
                ((sentiment.components.futures.score + 1) /
                  PROGRESS_NORMALIZER) *
                PERCENTAGE_MULTIPLIER
              }
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Сигнал: {sentiment.components.futures.signal}
              </span>
              <span className="text-muted-foreground">
                Вес:{" "}
                {(
                  sentiment.components.futures.weight * PERCENTAGE_MULTIPLIER
                ).toFixed(0)}
                %
              </span>
              <span className="text-muted-foreground">
                Уверенность:{" "}
                {(
                  sentiment.components.futures.confidence *
                  PERCENTAGE_MULTIPLIER
                ).toFixed(0)}
                %
              </span>
            </div>
          </div>

          {/* Order Book */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Книга Заявок</span>
              </div>
              <span
                className={`font-semibold ${getSentimentColorFromScore(sentiment.components.orderBook.score)}`}
              >
                {formatScore(sentiment.components.orderBook.score)}
              </span>
            </div>
            <Progress
              className="h-1.5"
              value={
                ((sentiment.components.orderBook.score + 1) /
                  PROGRESS_NORMALIZER) *
                PERCENTAGE_MULTIPLIER
              }
            />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Сигнал: {sentiment.components.orderBook.signal}
              </span>
              <span className="text-muted-foreground">
                Вес:{" "}
                {(
                  sentiment.components.orderBook.weight * PERCENTAGE_MULTIPLIER
                ).toFixed(0)}
                %
              </span>
              <span className="text-muted-foreground">
                Уверенность:{" "}
                {(
                  sentiment.components.orderBook.confidence *
                  PERCENTAGE_MULTIPLIER
                ).toFixed(0)}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Insights */}
        {sentiment.insights.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium text-sm">Ключевые Инсайты</div>
            <ul className="space-y-1">
              {sentiment.insights.map((insight, idx) => (
                <li
                  className="flex items-start gap-2 text-muted-foreground text-xs"
                  key={idx}
                >
                  <span className="mt-0.5 text-primary">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-right text-muted-foreground text-xs">
          Обновлено: {new Date(sentiment.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}
