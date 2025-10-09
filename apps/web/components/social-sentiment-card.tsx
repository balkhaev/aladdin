/**
 * Social Sentiment Card Component
 * Highlights social mood contribution inside combined sentiment
 */

import {
  Activity,
  MessageSquare,
  Newspaper,
  TrendingDown,
  TrendingUp,
  Twitter,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CombinedSentiment,
  useCombinedSentiment,
} from "@/hooks/use-combined-sentiment";

type SocialSentimentCardProps = {
  symbol: string;
  sentiment?: CombinedSentiment;
  isLoading?: boolean;
  errorMessage?: string;
  enableFetch?: boolean;
};

const SCORE_DECIMAL_PLACES = 1;
const SENTIMENT_THRESHOLD = 30;
const PERCENTAGE_MULTIPLIER = 100;

const formatScore = (score: number): string =>
  score.toFixed(SCORE_DECIMAL_PLACES);

const formatPercentage = (value: number): string =>
  `${Math.round(value * PERCENTAGE_MULTIPLIER)}%`;

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

const getSignalIcon = (signal: string) => {
  if (signal === "BULLISH") return <TrendingUp className="h-4 w-4" />;
  if (signal === "BEARISH") return <TrendingDown className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const getStrengthColor = (strength: "WEAK" | "MODERATE" | "STRONG") => {
  if (strength === "STRONG") return "bg-orange-500/90 text-white";
  if (strength === "MODERATE") return "bg-yellow-500/80 text-black";
  return "bg-gray-500/50 text-white";
};

const getComponentStrength = (
  score: number
): "WEAK" | "MODERATE" | "STRONG" => {
  const absScore = Math.abs(score);
  if (absScore >= 70) return "STRONG";
  if (absScore >= 40) return "MODERATE";
  return "WEAK";
};

export function SocialSentimentCard({
  symbol,
  sentiment: providedSentiment,
  isLoading: loadingOverride,
  errorMessage,
  enableFetch = true,
}: SocialSentimentCardProps) {
  const shouldFetch = enableFetch && !providedSentiment;
  const {
    data: querySentiment,
    isLoading: queryLoading,
    error: queryError,
  } = useCombinedSentiment(symbol, shouldFetch);

  const sentiment = providedSentiment ?? querySentiment;
  const isLoading = loadingOverride ?? queryLoading;

  let resolvedError = errorMessage;
  if (!resolvedError && queryError) {
    resolvedError =
      queryError instanceof Error ? queryError.message : String(queryError);
  }

  const socialComponent = sentiment?.components.social;
  const socialContext = sentiment?.context.social;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Социальный Сентимент</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasSentimentData = sentiment && socialComponent;

  if (!hasSentimentData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Социальный Сентимент</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            {resolvedError ?? "Не удалось загрузить данные о настроениях"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressValue = (socialComponent.score + 100) / 2;
  const socialStrength = getComponentStrength(socialComponent.score);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Социальный Сентимент</CardTitle>
            <p className="mt-1 text-muted-foreground text-xs">
              Настроения из всех социальных источников для {symbol}
            </p>
          </div>
          <Badge
            className={getSentimentBgColorFromScore(socialComponent.score)}
            variant="outline"
          >
            <div className="flex items-center gap-1">
              {getSignalIcon(socialComponent.signal)}
              <span>{socialComponent.signal}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Social Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Общий социальный Score
              </span>
            </div>
            <span
              className={`font-bold text-2xl ${getSentimentColorFromScore(socialComponent.score)}`}
            >
              {formatScore(socialComponent.score)}
            </span>
          </div>
          <Progress className="h-2" value={progressValue} />
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Медвежий (-100)</span>
            <span>Нейтральный (0)</span>
            <span>Бычий (+100)</span>
          </div>
        </div>

        {/* Confidence & Weight */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground text-xs">Уверенность модели</p>
            <p className="mt-1 font-semibold">
              {formatPercentage(socialComponent.confidence)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-muted-foreground text-xs">Вес в общем сигнале</p>
            <p className="mt-1 font-semibold">
              {formatPercentage(socialComponent.weight)}
            </p>
          </div>
        </div>

        {/* Sources Breakdown */}
        {socialContext ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Источники</span>
              <Badge
                className={getStrengthColor(socialStrength)}
                variant="outline"
              >
                {socialStrength}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Telegram */}
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-sky-500" />
                    <span className="font-medium text-sm">Telegram</span>
                  </div>
                  <Badge variant="outline">
                    {socialContext.telegram.score.toFixed(2)}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Бычьих</span>
                    <span>{socialContext.telegram.bullish}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Медвежьих</span>
                    <span>{socialContext.telegram.bearish}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Сигналы</span>
                    <span>{socialContext.telegram.signals}</span>
                  </div>
                </div>
              </div>

              {/* Twitter */}
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Twitter className="h-4 w-4 text-blue-500" />
                    <span className="font-medium text-sm">Twitter</span>
                  </div>
                  <Badge variant="outline">
                    {socialContext.twitter.score.toFixed(2)}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Позитивных</span>
                    <span>{socialContext.twitter.positive}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Нейтральных</span>
                    <span>{socialContext.twitter.neutral}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Негативных</span>
                    <span>{socialContext.twitter.negative}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Всего твитов</span>
                    <span>{socialContext.twitter.tweets}</span>
                  </div>
                </div>
              </div>

              {/* Reddit */}
              {socialContext.reddit && (
                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm">Reddit</span>
                    </div>
                    <Badge variant="outline">
                      {socialContext.reddit.score.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Позитивных</span>
                      <span>{socialContext.reddit.positive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Нейтральных</span>
                      <span>{socialContext.reddit.neutral}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Негативных</span>
                      <span>{socialContext.reddit.negative}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Всего постов
                      </span>
                      <span>{socialContext.reddit.posts}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* News */}
              {socialContext.news && (
                <div className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-purple-500" />
                      <span className="font-medium text-sm">Новости</span>
                    </div>
                    <Badge variant="outline">
                      {socialContext.news.score.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Позитивных</span>
                      <span>{socialContext.news.positive}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Нейтральных</span>
                      <span>{socialContext.news.neutral}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Негативных</span>
                      <span>{socialContext.news.negative}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Всего статей
                      </span>
                      <span>{socialContext.news.articles}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-3 text-muted-foreground text-xs">
            Детализация по соцсетям временно недоступна, используется только
            агрегированный сигнал.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
