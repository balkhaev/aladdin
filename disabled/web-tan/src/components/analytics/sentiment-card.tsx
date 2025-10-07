/**
 * Sentiment Analysis Card Component
 * Displays composite sentiment with component breakdown
 */

import {
  Activity,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ComponentSentiment,
  getSentimentBgColor,
  getSentimentColor,
  getSentimentIcon,
  type SentimentSignal,
  useSentiment,
} from "@/hooks/use-sentiment";

interface SentimentCardProps {
  symbol: string;
}

export function SentimentCard({ symbol }: SentimentCardProps) {
  const { data: sentiment, isLoading, error } = useSentiment(symbol);

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

  if (error || !sentiment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load sentiment data
          </div>
        </CardContent>
      </Card>
    );
  }

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Sentiment Analysis</CardTitle>
          <Badge
            className={getSentimentBgColor(sentiment.compositeSignal)}
            variant="outline"
          >
            {getSentimentIcon(sentiment.compositeSignal)}{" "}
            {sentiment.compositeSignal}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Composite Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Composite Score</span>
            </div>
            <span
              className={`font-bold text-2xl ${getSentimentColor(sentiment.compositeSignal)}`}
            >
              {sentiment.compositeScore.toFixed(1)}
            </span>
          </div>
          <Progress
            className="h-2"
            value={((sentiment.compositeScore + 100) / 200) * 100}
          />
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
            <div className="font-bold text-2xl">{sentiment.confidence}%</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Strength</div>
            <Badge className={getStrengthColor(sentiment.strength)}>
              {sentiment.strength}
            </Badge>
          </div>
        </div>

        {/* Component Breakdown */}
        <div className="space-y-3">
          <div className="font-medium text-sm">Components</div>
          <ComponentBar
            component={sentiment.components.fearGreed}
            label="Fear & Greed"
            weight={sentiment.components.fearGreed.weight}
          />
          <ComponentBar
            component={sentiment.components.onChain}
            label="On-Chain"
            weight={sentiment.components.onChain.weight}
          />
          <ComponentBar
            component={sentiment.components.technical}
            label="Technical"
            weight={sentiment.components.technical.weight}
          />
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
                  {insight.includes("⚠️") && (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                  )}
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComponentBar({
  label,
  weight,
  component,
}: {
  label: string;
  weight: number;
  component: ComponentSentiment;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">
            ({(weight * 100).toFixed(0)}%)
          </span>
        </div>
        <span className={getSentimentColor(component.signal)}>
          {component.score.toFixed(0)}
        </span>
      </div>
      <Progress
        className="h-1.5"
        value={((component.score + 100) / 200) * 100}
      />
    </div>
  );
}
