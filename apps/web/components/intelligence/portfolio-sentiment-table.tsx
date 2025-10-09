/**
 * Portfolio Sentiment Table Component
 * Displays sentiment analysis for all portfolio assets
 */

import { AlertTriangle, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortfolioPositions } from "@/hooks/use-portfolio";
import {
  getSentimentColor,
  type SentimentSignal,
  type CombinedSentiment,
  useBatchCombinedSentiment,
} from "@/hooks/use-combined-sentiment";

// Constants for thresholds
const SENTIMENT_NEUTRAL_THRESHOLD = 20;
const PERCENTAGE_MULTIPLIER = 100;
const DECIMAL_PRECISION_1 = 1;
const DECIMAL_PRECISION_2 = 2;
const PROGRESS_BAR_RANGE = 200;
const PROGRESS_BAR_OFFSET = 100;

type PortfolioSentimentTableProps = {
  portfolioId: string;
};

function getPortfolioScoreColor(score: number): string {
  if (score > SENTIMENT_NEUTRAL_THRESHOLD) {
    return "text-3xl font-bold text-green-500";
  }
  if (score < -SENTIMENT_NEUTRAL_THRESHOLD) {
    return "text-3xl font-bold text-red-500";
  }
  return "text-3xl font-bold text-gray-500";
}

function getStrengthBadgeClass(strength: string): string {
  if (strength === "STRONG") {
    return "bg-orange-500/10";
  }
  if (strength === "MODERATE") {
    return "bg-yellow-500/10";
  }
  return "bg-gray-500/10";
}

export function PortfolioSentimentTable({
  portfolioId,
}: PortfolioSentimentTableProps) {
  const { data: positions, isLoading: isLoadingPositions } =
    usePortfolioPositions(portfolioId);

  // Extract symbols from positions (already have USDT suffix)
  const symbols = useMemo(() => {
    if (!positions) return [];
    // Symbols already have USDT suffix from the API
    return positions.map((p) => p.symbol).filter((s) => s !== "USDTUSDT"); // Filter out stablecoins
  }, [positions]);

  const { data: sentiments, isLoading: isLoadingSentiments } =
    useBatchCombinedSentiment(symbols, symbols.length > 0);

  const isLoading = isLoadingPositions || isLoadingSentiments;

  // Calculate portfolio-wide sentiment
  const portfolioSentiment = useMemo(() => {
    const hasData = sentiments && positions && sentiments.length > 0;
    if (!hasData) {
      return null;
    }

    // Weight sentiment by position size
    let weightedScore = 0;
    let totalWeight = 0;

    for (const sentiment of sentiments) {
      const position = positions.find((p) => p.symbol === sentiment.symbol);
      const positionValue = position?.value ?? 0;
      if (positionValue > 0) {
        weightedScore += sentiment.combinedScore * positionValue;
        totalWeight += positionValue;
      }
    }

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const bullishCount = sentiments.filter(
      (s) => s.combinedSignal === "BULLISH"
    ).length;
    const bearishCount = sentiments.filter(
      (s) => s.combinedSignal === "BEARISH"
    ).length;

    return {
      avgScore,
      bullishCount,
      bearishCount,
      neutralCount: sentiments.length - bullishCount - bearishCount,
    };
  }, [sentiments, positions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground text-sm">
            No positions in portfolio
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sentiments || sentiments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Sentiment Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground text-sm">
            No sentiment data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Portfolio Sentiment Analysis</CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">
              Risk-adjusted sentiment for your holdings
            </p>
          </div>
          {portfolioSentiment && (
            <div className="text-right">
              <div className="font-semibold text-sm">Portfolio Score</div>
              <div
                className={getPortfolioScoreColor(portfolioSentiment.avgScore)}
              >
                {portfolioSentiment.avgScore.toFixed(1)}
              </div>
              <div className="mt-1 flex gap-1">
                <Badge className="bg-green-500/10 text-xs" variant="outline">
                  {portfolioSentiment.bullishCount} 📈
                </Badge>
                <Badge className="bg-red-500/10 text-xs" variant="outline">
                  {portfolioSentiment.bearishCount} 📉
                </Badge>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Position Size</TableHead>
                <TableHead className="text-center">Signal</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Strength</TableHead>
                <TableHead className="text-center">Confidence</TableHead>
                <TableHead>Recommendation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sentiments.map((sentiment) => {
                const position = positions.find(
                  (p) => p.symbol === sentiment.symbol
                );
                if (!position) return null;

                const hasDivergence = sentiment.insights.some((i) =>
                  i.includes("⚠️")
                );
                const totalPortfolioValue = positions.reduce(
                  (sum, p) => sum + p.value,
                  0
                );
                const exposurePercent =
                  totalPortfolioValue > 0
                    ? (position.value / totalPortfolioValue) *
                      PERCENTAGE_MULTIPLIER
                    : 0;

                return (
                  <TableRow key={sentiment.symbol}>
                    {/* Asset */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{position.symbol}</span>
                        {hasDivergence && (
                          <AlertTriangle className="size-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>

                    {/* Position Size */}
                    <TableCell className="text-right">
                      <div>
                        <div className="font-medium">
                          ${position.value.toFixed(DECIMAL_PRECISION_2)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {exposurePercent.toFixed(DECIMAL_PRECISION_1)}%
                        </div>
                      </div>
                    </TableCell>

                    {/* Signal */}
                    <TableCell className="text-center">
                      <SignalBadge signal={sentiment.combinedSignal} />
                    </TableCell>

                    {/* Score */}
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <div
                          className={`font-bold text-xl ${getSentimentColor(sentiment.combinedSignal)}`}
                        >
                          {sentiment.combinedScore.toFixed(0)}
                        </div>
                        <Progress
                          className="h-1 w-16"
                          value={
                            ((sentiment.combinedScore + PROGRESS_BAR_OFFSET) /
                              PROGRESS_BAR_RANGE) *
                            PERCENTAGE_MULTIPLIER
                          }
                        />
                      </div>
                    </TableCell>

                    {/* Strength */}
                    <TableCell className="text-center">
                      <Badge
                        className={getStrengthBadgeClass(sentiment.strength)}
                        variant="outline"
                      >
                        {sentiment.strength}
                      </Badge>
                    </TableCell>

                    {/* Confidence */}
                    <TableCell className="text-center">
                      <div className="font-semibold">
                        {Math.round(sentiment.confidence * PERCENTAGE_MULTIPLIER)}%
                      </div>
                    </TableCell>

                    {/* Recommendation */}
                    <TableCell>
                      <RecommendationBadge
                        exposurePercent={exposurePercent}
                        recommendation={sentiment.recommendation}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const SIGNAL_CONFIG = {
  BULLISH: {
    icon: TrendingUp,
    color: "text-green-500",
    bg: "border-green-500/20 bg-green-500/10",
  },
  BEARISH: {
    icon: TrendingDown,
    color: "text-red-500",
    bg: "border-red-500/20 bg-red-500/10",
  },
  NEUTRAL: {
    icon: Minus,
    color: "text-gray-500",
    bg: "border-gray-500/20 bg-gray-500/10",
  },
} as const;

function SignalBadge({ signal }: { signal: SentimentSignal }) {
  const { icon: Icon, color, bg } = SIGNAL_CONFIG[signal];

  return (
    <Badge className={bg} variant="outline">
      <Icon className={`mr-1 size-3 ${color}`} />
      {signal}
    </Badge>
  );
}

const RECOMMENDATION_VARIANT: Record<
  CombinedSentiment["recommendation"]["action"],
  "default" | "secondary" | "destructive"
> = {
  STRONG_BUY: "default",
  BUY: "default",
  HOLD: "secondary",
  SELL: "destructive",
  STRONG_SELL: "destructive",
};

const RISK_COLOR: Record<
  CombinedSentiment["recommendation"]["riskLevel"],
  string
> = {
  LOW: "text-green-500",
  MEDIUM: "text-yellow-500",
  HIGH: "text-red-500",
};

function RecommendationBadge({
  recommendation,
  exposurePercent,
}: {
  recommendation: CombinedSentiment["recommendation"];
  exposurePercent: number;
}) {
  const variant = RECOMMENDATION_VARIANT[recommendation.action] ?? "secondary";
  const riskClass = RISK_COLOR[recommendation.riskLevel] ?? "text-muted-foreground";
  const label = recommendation.action.replace("_", " ");

  return (
    <div className="space-y-1">
      <Badge className="text-xs" variant={variant}>
        {label}
      </Badge>
      <div className="flex items-center justify-between text-muted-foreground text-xs">
        <span className={riskClass}>Risk: {recommendation.riskLevel}</span>
        <span>Exposure: {exposurePercent.toFixed(DECIMAL_PRECISION_1)}%</span>
      </div>
      <div className="line-clamp-2 text-muted-foreground text-xs">
        {recommendation.reasoning}
      </div>
    </div>
  );
}
