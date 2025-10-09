/**
 * Smart Signals Card Component
 * Displays high-confidence trading signals based on multi-source analysis
 */

import {
  AlertCircle,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CombinedSentiment } from "@/hooks/use-combined-sentiment";
import { useBatchCombinedSentiment } from "@/hooks/use-combined-sentiment";

// Constants for signal thresholds
const BULLISH_SCORE_THRESHOLD = 30;
const BEARISH_SCORE_THRESHOLD = -30;
const MIN_CONFIDENCE = 0.75;
const ANALYTICS_WEIGHT = 35;
const FUTURES_WEIGHT = 25;
const ORDER_BOOK_WEIGHT = 15;
const SOCIAL_WEIGHT = 25;
const MAX_INSIGHTS = 3;

type SmartSignalsCardProps = {
  portfolioId?: string;
};

// Extended watchlist for signals
const SIGNALS_WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "MATICUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "UNIUSDT",
];

type TradingSignal = {
  symbol: string;
  type: "BUY" | "SELL" | "HOLD";
  confidence: number;
  score: number;
  strength: string;
  entry?: string;
  target?: string;
  stop?: string;
  reasoning: string[];
  hasDivergence: boolean;
  analyticsScore: number;
  futuresScore: number;
  orderBookScore: number;
  socialScore: number;
};

function getSignalType(sentiment: CombinedSentiment): "BUY" | "SELL" | "HOLD" {
  if (
    sentiment.combinedSignal === "BULLISH" &&
    sentiment.combinedScore > BULLISH_SCORE_THRESHOLD &&
    sentiment.confidence >= MIN_CONFIDENCE
  ) {
    return "BUY";
  }

  if (
    sentiment.combinedSignal === "BEARISH" &&
    sentiment.combinedScore < BEARISH_SCORE_THRESHOLD &&
    sentiment.confidence >= MIN_CONFIDENCE
  ) {
    return "SELL";
  }

  return "HOLD";
}

export function SmartSignalsCard(_props: SmartSignalsCardProps) {
  const { data: sentiments, isLoading } =
    useBatchCombinedSentiment(SIGNALS_WATCHLIST);

  // Generate trading signals from sentiment data
  const signals: TradingSignal[] = useMemo(() => {
    if (!sentiments) return [];

    return sentiments
      .map((sentiment) => {
        // Determine signal type based on composite score and strength
        const type = getSignalType(sentiment);

        // Only return high-confidence signals
        if (type === "HOLD") return null;

        const hasDivergence = sentiment.insights.some((i) => i.includes("⚠️"));
        const confidencePercent = Math.round(
          sentiment.confidence * 100
        );

        return {
          symbol: sentiment.symbol,
          type,
          confidence: confidencePercent,
          score: sentiment.combinedScore,
          strength: sentiment.strength,
          reasoning: sentiment.insights,
          hasDivergence,
          analyticsScore: sentiment.components.analytics.score,
          futuresScore: sentiment.components.futures.score,
          orderBookScore: sentiment.components.orderBook.score,
          socialScore: sentiment.components.social.score,
        };
      })
      .filter(Boolean) as TradingSignal[];
  }, [sentiments]);

  // Separate buy and sell signals
  const buySignals = signals
    .filter((s) => s.type === "BUY")
    .sort((a, b) => b.confidence - a.confidence);

  const sellSignals = signals
    .filter((s) => s.type === "SELL")
    .sort((a, b) => b.confidence - a.confidence);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Smart Trading Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Smart Trading Signals
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-sm">
              High-confidence opportunities (confidence ≥ 75%)
            </p>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-green-500/10" variant="outline">
              {buySignals.length} BUY
            </Badge>
            <Badge className="bg-red-500/10" variant="outline">
              {sellSignals.length} SELL
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs className="space-y-4" defaultValue="buy">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="buy">
              Buy Signals ({buySignals.length})
            </TabsTrigger>
            <TabsTrigger value="sell">
              Sell Signals ({sellSignals.length})
            </TabsTrigger>
          </TabsList>

          {/* Buy Signals */}
          <TabsContent className="space-y-4" value="buy">
            {buySignals.length === 0 ? (
              <div className="py-12 text-center">
                <Target className="mx-auto mb-4 size-12 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  No high-confidence buy signals
                </p>
              </div>
            ) : (
              buySignals.map((signal) => (
                <SignalCard key={signal.symbol} signal={signal} />
              ))
            )}
          </TabsContent>

          {/* Sell Signals */}
          <TabsContent className="space-y-4" value="sell">
            {sellSignals.length === 0 ? (
              <div className="py-12 text-center">
                <Shield className="mx-auto mb-4 size-12 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">
                  No high-confidence sell signals
                </p>
              </div>
            ) : (
              sellSignals.map((signal) => (
                <SignalCard key={signal.symbol} signal={signal} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SignalCard({ signal }: { signal: TradingSignal }) {
  const isBuy = signal.type === "BUY";
  const Icon = isBuy ? TrendingUp : TrendingDown;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isBuy
          ? "border-green-500/20 bg-green-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-12 items-center justify-center rounded-lg ${
              isBuy ? "bg-green-500/10" : "bg-red-500/10"
            }`}
          >
            <Icon
              className={`size-6 ${isBuy ? "text-green-500" : "text-red-500"}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">
                {signal.symbol.replace("USDT", "")}
              </span>
              {signal.hasDivergence && (
                <AlertCircle className="size-4 text-yellow-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={isBuy ? "bg-green-500/10" : "bg-red-500/10"}
                variant="outline"
              >
                {signal.type} SIGNAL
              </Badge>
              <Badge
                className={
                  signal.strength === "STRONG"
                    ? "bg-orange-500/10"
                    : "bg-yellow-500/10"
                }
                variant="outline"
              >
                {signal.strength}
              </Badge>
            </div>
          </div>
        </div>

        {/* Confidence */}
        <div className="text-right">
          <div className="text-muted-foreground text-xs">Confidence</div>
          <div className="font-bold text-2xl">{signal.confidence}%</div>
        </div>
      </div>

      {/* Component Scores */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <ScoreCard
          label="Analytics"
          score={signal.analyticsScore}
          weight={ANALYTICS_WEIGHT}
        />
        <ScoreCard
          label="Futures"
          score={signal.futuresScore}
          weight={FUTURES_WEIGHT}
        />
        <ScoreCard
          label="Order Book"
          score={signal.orderBookScore}
          weight={ORDER_BOOK_WEIGHT}
        />
        <ScoreCard
          label="Social"
          score={signal.socialScore}
          weight={SOCIAL_WEIGHT}
        />
      </div>

      {/* Reasoning */}
      <div className="mt-4 space-y-2">
        <div className="font-medium text-sm">Analysis:</div>
        <div className="space-y-1">
          {signal.reasoning.slice(0, MAX_INSIGHTS).map((reason, index) => (
            <div
              className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-muted-foreground text-xs"
              key={index}
            >
              <span className="shrink-0">•</span>
              <span>{reason.replace("⚠️ ", "")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-4 flex gap-2">
        <Button
          className="flex-1"
          size="sm"
          variant={isBuy ? "default" : "destructive"}
        >
          {isBuy ? "🚀 Execute Buy" : "⚠️ Execute Sell"}
        </Button>
        <Button size="sm" variant="outline">
          Details
        </Button>
      </div>
    </div>
  );
}

const SENTIMENT_NEUTRAL_THRESHOLD = 20;

function getScoreColor(score: number): string {
  if (score > SENTIMENT_NEUTRAL_THRESHOLD) {
    return "text-green-500";
  }
  if (score < -SENTIMENT_NEUTRAL_THRESHOLD) {
    return "text-red-500";
  }
  return "text-gray-500";
}

function ScoreCard({
  label,
  score,
  weight,
}: {
  label: string;
  score: number;
  weight: number;
}) {
  const color = getScoreColor(score);

  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={`font-bold text-lg ${color}`}>{score.toFixed(0)}</div>
      <div className="text-muted-foreground text-xs">{weight}% weight</div>
    </div>
  );
}
