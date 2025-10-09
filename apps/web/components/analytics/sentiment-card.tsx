/**
 * Sentiment Analysis Card Component
 * Displays combined sentiment with component breakdown
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Layers,
  MessageSquare,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  getSentimentBgColor,
  getSentimentColor,
  getSentimentIcon,
  type CombinedSentiment,
  type ComponentSentiment,
  useCombinedSentiment,
} from "@/hooks/use-combined-sentiment";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type SentimentCardProps = {
  symbol: string;
  sentiment?: CombinedSentiment;
  isLoading?: boolean;
  errorMessage?: string;
  enableFetch?: boolean;
};

const SCORE_PROGRESS_OFFSET = 100;
const SCORE_PROGRESS_RANGE = 200;

const COMPONENT_KEYS = ["analytics", "futures", "orderBook", "social"] as const;
type ComponentKey = (typeof COMPONENT_KEYS)[number];

const COMPONENT_CONFIG: Record<
  ComponentKey,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  analytics: {
    label: "Аналитика",
    description: "Фундаментальные и технические индикаторы",
    icon: BarChart3,
  },
  futures: {
    label: "Фьючерсы",
    description: "Ставки финансирования и открытый интерес",
    icon: Layers,
  },
  orderBook: {
    label: "Ордербук",
    description: "Дисбаланс заявок и ликвидность",
    icon: BookOpen,
  },
  social: {
    label: "Сообщество",
    description: "Настроения Telegram и Twitter",
    icon: MessageSquare,
  },
};

export function SentimentCard({
  symbol,
  sentiment: providedSentiment,
  isLoading: loadingOverride,
  errorMessage,
  enableFetch = true,
}: SentimentCardProps) {
  const shouldFetch = enableFetch && !providedSentiment;
  const {
    data: querySentiment,
    isLoading: queryLoading,
    error: queryError,
  } = useCombinedSentiment(symbol, shouldFetch);

  const sentiment = providedSentiment ?? querySentiment;
  const isLoading = loadingOverride ?? queryLoading;
  const resolvedError =
    errorMessage ??
    (queryError
      ? queryError instanceof Error
        ? queryError.message
        : String(queryError)
      : undefined);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            {resolvedError ?? "Failed to load sentiment data"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidencePercent = Math.round(sentiment.confidence * 100);
  const combinedProgress =
    ((sentiment.combinedScore + SCORE_PROGRESS_OFFSET) / SCORE_PROGRESS_RANGE) *
    100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
          <Badge
            className={getSentimentBgColor(sentiment.combinedSignal)}
            variant="outline"
          >
            <span>{getSentimentIcon(sentiment.combinedSignal)}</span>
            <span className="ml-1">{sentiment.combinedSignal}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Combined Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Combined Score</span>
            </div>
            <div className="flex items-center gap-2">
              {sentiment.combinedSignal === "BULLISH" && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              {sentiment.combinedSignal === "BEARISH" && (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span
                className={`font-bold text-2xl ${getSentimentColor(sentiment.combinedSignal)}`}
              >
                {sentiment.combinedScore.toFixed(1)}
              </span>
            </div>
          </div>
          <Progress className="h-2" value={combinedProgress} />
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Bearish (-100)</span>
            <span>Neutral (0)</span>
            <span>Bullish (+100)</span>
          </div>
        </div>

        {/* Confidence & Strength */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Confidence</div>
            <div className="font-bold text-2xl">{confidencePercent}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Strength</div>
            <StrengthBadge strength={sentiment.strength} />
          </div>
        </div>

        {/* Component Breakdown */}
        <div className="space-y-3">
          <div className="font-medium text-sm">Компоненты анализа</div>
          <div className="grid gap-3 md:grid-cols-2">
            {COMPONENT_KEYS.map((key) => (
              <ComponentCard
                component={sentiment.components[key]}
                config={COMPONENT_CONFIG[key]}
                key={key}
              />
            ))}
          </div>
        </div>

        {/* Insights */}
        {sentiment.insights.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium text-sm">Insights</div>
            <div className="space-y-2">
              {sentiment.insights.map((insight, index) => (
                <div
                  className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-muted-foreground text-xs"
                  key={index}
                >
                  {insight.includes("⚠️") ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  ) : (
                    <span className="mt-0.5 h-4 w-4 shrink-0">•</span>
                  )}
                  <span>{insight.replace("⚠️ ", "")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StrengthBadge({ strength }: { strength: string }) {
  const baseClass = "font-semibold px-2 py-1 rounded-md text-xs";

  if (strength === "STRONG") {
    return (
      <Badge className={`${baseClass} bg-orange-500/10`} variant="outline">
        STRONG
      </Badge>
    );
  }

  if (strength === "MODERATE") {
    return (
      <Badge className={`${baseClass} bg-yellow-500/10`} variant="outline">
        MODERATE
      </Badge>
    );
  }

  return (
    <Badge className={`${baseClass} bg-gray-500/10`} variant="outline">
      WEAK
    </Badge>
  );
}

function ComponentCard({
  component,
  config,
}: {
  component: ComponentSentiment;
  config: (typeof COMPONENT_CONFIG)[ComponentKey];
}) {
  const Icon = config.icon;
  const progressValue = ((component.score + 100) / 200) * 100;
  const confidencePercent = Math.round(component.confidence * 100);
  const weightPercent = Math.round(component.weight * 100);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">{config.label}</div>
            <p className="text-muted-foreground text-xs">{config.description}</p>
          </div>
        </div>
        <Badge
          className={getSentimentBgColor(component.signal)}
          variant="outline"
        >
          {component.signal}
        </Badge>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Score</span>
          <span
            className={`font-semibold ${getSentimentColor(component.signal)}`}
          >
            {component.score.toFixed(0)}
          </span>
        </div>
        <Progress className="h-1.5" value={progressValue} />
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>Weight: {weightPercent}%</span>
          <span>Confidence: {confidencePercent}%</span>
        </div>
      </div>
    </div>
  );
}
