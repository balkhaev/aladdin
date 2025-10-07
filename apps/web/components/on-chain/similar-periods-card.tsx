import { Clock, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SimilarPeriod = {
  startDate: number;
  endDate: number;
  similarity: number; // 0-1
  outcome: "bullish" | "bearish" | "neutral";
  priceChange: number; // % change in next 30 days
  phase: string;
  metrics: {
    mvrv: number;
    nupl: number;
    reserveRisk?: number;
  };
};

type Props = {
  periods: SimilarPeriod[];
  blockchain: string;
};

function getOutcomeIcon(outcome: SimilarPeriod["outcome"]) {
  switch (outcome) {
    case "bullish":
      return TrendingUp;
    case "bearish":
      return TrendingDown;
    default:
      return Minus;
  }
}

function getOutcomeColor(outcome: SimilarPeriod["outcome"]): string {
  switch (outcome) {
    case "bullish":
      return "text-emerald-600 bg-emerald-500/10";
    case "bearish":
      return "text-red-600 bg-red-500/10";
    default:
      return "text-slate-600 bg-slate-500/10";
  }
}

/**
 * Similar Historical Periods Card Component
 */
export function SimilarPeriodsCard({ periods, blockchain }: Props) {
  if (periods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Similar Historical Periods - {blockchain}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">No similar periods found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate outcome statistics
  const bullishCount = periods.filter((p) => p.outcome === "bullish").length;
  const bearishCount = periods.filter((p) => p.outcome === "bearish").length;
  const neutralCount = periods.filter((p) => p.outcome === "neutral").length;
  const avgPriceChange =
    periods.reduce((sum, p) => sum + p.priceChange, 0) / periods.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Similar Historical Periods - {blockchain}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="flex flex-col items-center rounded-lg bg-muted p-3">
            <span className="font-bold text-2xl">{periods.length}</span>
            <span className="text-muted-foreground text-xs">
              Similar Periods
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-emerald-500/10 p-3">
            <span className="font-bold text-2xl text-emerald-600">
              {bullishCount}
            </span>
            <span className="text-muted-foreground text-xs">Bullish</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-red-500/10 p-3">
            <span className="font-bold text-2xl text-red-600">
              {bearishCount}
            </span>
            <span className="text-muted-foreground text-xs">Bearish</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-slate-500/10 p-3">
            <span className="font-bold text-2xl text-slate-600">
              {neutralCount}
            </span>
            <span className="text-muted-foreground text-xs">Neutral</span>
          </div>
        </div>

        {/* Average Outcome */}
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">
              Average 30-Day Price Change:
            </span>
            <span
              className={`font-bold text-lg ${avgPriceChange > 0 ? "text-emerald-600" : avgPriceChange < 0 ? "text-red-600" : "text-slate-600"}`}
            >
              {avgPriceChange > 0 ? "+" : ""}
              {avgPriceChange.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Period Cards */}
        <div className="space-y-3">
          {periods.map((period, index) => {
            const OutcomeIcon = getOutcomeIcon(period.outcome);

            return (
              <div
                className="rounded-lg border p-4 transition-shadow hover:shadow-md"
                key={index}
              >
                {/* Period Header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${getOutcomeColor(period.outcome)}`}
                    >
                      <OutcomeIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(period.startDate).toLocaleDateString()} -{" "}
                        {new Date(period.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {period.phase}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {(period.similarity * 100).toFixed(0)}% similar
                    </Badge>
                    <span
                      className={`font-bold text-sm ${period.priceChange > 0 ? "text-emerald-600" : period.priceChange < 0 ? "text-red-600" : "text-slate-600"}`}
                    >
                      {period.priceChange > 0 ? "+" : ""}
                      {period.priceChange.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Metrics Comparison */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col rounded bg-muted p-2">
                    <span className="mb-1 text-muted-foreground">MVRV</span>
                    <span className="font-medium">
                      {period.metrics.mvrv.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col rounded bg-muted p-2">
                    <span className="mb-1 text-muted-foreground">NUPL</span>
                    <span className="font-medium">
                      {period.metrics.nupl.toFixed(2)}
                    </span>
                  </div>
                  {period.metrics.reserveRisk && (
                    <div className="flex flex-col rounded bg-muted p-2">
                      <span className="mb-1 text-muted-foreground">
                        Reserve Risk
                      </span>
                      <span className="font-medium">
                        {period.metrics.reserveRisk.toFixed(4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Interpretation */}
        <div className="rounded-lg bg-muted p-4">
          <h4 className="mb-2 font-semibold text-sm">Interpretation:</h4>
          <p className="text-muted-foreground text-xs">
            These periods showed similar on-chain metrics to the current
            situation. Historical outcomes can help inform decisions, but past
            performance doesn't guarantee future results. Consider multiple
            factors before making trading decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
