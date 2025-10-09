/**
 * Divergence Alerts Component
 * Displays real-time divergence alerts (smart money indicators)
 */

import { Activity, AlertTriangle, Bell, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CombinedSentiment,
  useBatchCombinedSentiment,
} from "@/hooks/use-combined-sentiment";

// Watchlist for divergence detection
const WATCHLIST = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "ADAUSDT",
  "DOGEUSDT",
];

type DivergenceAlert = {
  symbol: string;
  type: "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE";
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  timestamp: string;
};

function getSeverity(strength: string): "HIGH" | "MEDIUM" | "LOW" {
  if (strength === "STRONG") return "HIGH";
  if (strength === "MODERATE") return "MEDIUM";
  return "LOW";
}

function cleanInsightText(insight: string): string {
  return insight.replace(/^[⚠️💬]\s?/, "");
}

function buildDivergenceAlert(
  sentiment: CombinedSentiment,
  insight: string
): DivergenceAlert | null {
  const lower = insight.toLowerCase();
  const severity = getSeverity(sentiment.strength);
  const description = cleanInsightText(insight);

  if (lower.includes("social sentiment")) {
    const social = sentiment.components.social;
    if (social.signal === "NEUTRAL") return null;
    const type =
      social.signal === "BULLISH"
        ? "BULLISH_DIVERGENCE"
        : "BEARISH_DIVERGENCE";
    return {
      symbol: sentiment.symbol,
      type,
      title:
        social.signal === "BULLISH"
          ? "💬 Community Bullish Divergence"
          : "💬 Community Bearish Divergence",
      description,
      severity,
      confidence: Math.round(social.confidence * 100),
      timestamp: sentiment.timestamp,
    };
  }

  if (lower.includes("analytics") && lower.includes("futures")) {
    const futures = sentiment.components.futures;
    const type =
      futures.signal === "BULLISH"
        ? "BULLISH_DIVERGENCE"
        : futures.signal === "BEARISH"
          ? "BEARISH_DIVERGENCE"
          : sentiment.combinedSignal === "BULLISH"
            ? "BULLISH_DIVERGENCE"
            : "BEARISH_DIVERGENCE";

    return {
      symbol: sentiment.symbol,
      type,
      title:
        type === "BULLISH_DIVERGENCE"
          ? "📈 Futures Divergence"
          : "📉 Futures Divergence",
      description,
      severity,
      confidence: Math.round(futures.confidence * 100),
      timestamp: sentiment.timestamp,
    };
  }

  if (lower.includes("order book")) {
    const orderBook = sentiment.components.orderBook;
    if (orderBook.signal === "NEUTRAL") return null;
    return {
      symbol: sentiment.symbol,
      type:
        orderBook.signal === "BULLISH"
          ? "BULLISH_DIVERGENCE"
          : "BEARISH_DIVERGENCE",
      title:
        orderBook.signal === "BULLISH"
          ? "📗 Order Book Buy Pressure"
          : "📕 Order Book Sell Pressure",
      description,
      severity,
      confidence: Math.round(orderBook.confidence * 100),
      timestamp: sentiment.timestamp,
    };
  }

  return null;
}

function extractDivergenceAlerts(
  sentiments: CombinedSentiment[]
): DivergenceAlert[] {
  const alerts: DivergenceAlert[] = [];

  for (const sentiment of sentiments) {
    const divergenceInsights = sentiment.insights.filter((insight) =>
      insight.toLowerCase().includes("divergence") ||
      insight.toLowerCase().includes("diverges")
    );

    for (const insight of divergenceInsights) {
      const alert = buildDivergenceAlert(sentiment, insight);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Fallback: detect social divergence even if insights missing
    const social = sentiment.components.social;
    if (
      divergenceInsights.length === 0 &&
      social.confidence > 0.6 &&
      social.signal !== "NEUTRAL" &&
      social.signal !== sentiment.combinedSignal
    ) {
      alerts.push({
        symbol: sentiment.symbol,
        type:
          social.signal === "BULLISH"
            ? "BULLISH_DIVERGENCE"
            : "BEARISH_DIVERGENCE",
        title:
          social.signal === "BULLISH"
            ? "💬 Community Bullish Divergence"
            : "💬 Community Bearish Divergence",
        description: "Community mood diverges from market consensus",
        severity: getSeverity(sentiment.strength),
        confidence: Math.round(social.confidence * 100),
        timestamp: sentiment.timestamp,
      });
    }
  }

  return alerts;
}

export function DivergenceAlerts() {
  const { data: sentiments, isLoading } =
    useBatchCombinedSentiment(WATCHLIST);

  const alerts = sentiments ? extractDivergenceAlerts(sentiments) : [];

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="size-5" />
            Divergence Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="size-5" />
            Divergence Alerts
          </CardTitle>
          <Badge className="bg-yellow-500/10" variant="outline">
            <Bell className="mr-1 size-3" />
            {alerts.length}
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">Smart money indicators</p>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="mb-4 size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">
              No divergence alerts
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              Market sentiment is aligned
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <DivergenceAlertCard alert={alert} key={index} />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function DivergenceAlertCard({ alert }: { alert: DivergenceAlert }) {
  const severityColor = {
    HIGH: "bg-red-500/10 border-red-500/30 text-red-500",
    MEDIUM: "bg-yellow-500/10 border-yellow-500/30 text-yellow-500",
    LOW: "bg-blue-500/10 border-blue-500/30 text-blue-500",
  };

  const typeIcon = alert.type === "BULLISH_DIVERGENCE" ? "🐋" : "⚠️";

  return (
    <div
      className={`rounded-lg border p-4 ${
        alert.type === "BULLISH_DIVERGENCE"
          ? "border-green-500/20 bg-green-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {alert.symbol.replace("USDT", "")}
                </span>
                <Badge
                  className={severityColor[alert.severity]}
                  variant="outline"
                >
                  {alert.severity}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="font-medium text-sm">{alert.title}</div>

        {/* Description */}
        <p className="text-muted-foreground text-xs leading-relaxed">
          {alert.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-3 text-muted-foreground" />
            <span className="text-muted-foreground text-xs">
              Confidence: {alert.confidence}%
            </span>
          </div>
          {alert.type === "BULLISH_DIVERGENCE" && (
            <Badge className="bg-green-500/10 text-xs" variant="outline">
              BUY OPPORTUNITY
            </Badge>
          )}
          {alert.type === "BEARISH_DIVERGENCE" && (
            <Badge className="bg-red-500/10 text-xs" variant="outline">
              EXIT SIGNAL
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
