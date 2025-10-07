/**
 * Model Comparison Card
 * Compare LSTM vs Hybrid model performance
 */

import { ArrowRight, CheckCircle2, MinusCircle } from "lucide-react";
import type { ComparisonResult } from "../../lib/api/ml";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type ModelComparisonCardProps = {
  comparison: ComparisonResult;
};

export function ModelComparisonCard({ comparison }: ModelComparisonCardProps) {
  const { lstm, hybrid, comparison: comparisonData } = comparison;

  // Guard against undefined data
  const hasLstmMetrics = Boolean(lstm?.metrics);
  const hasHybridMetrics = Boolean(hybrid?.metrics);
  const hasComparisonData = Boolean(comparisonData);

  if (!hasLstmMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400 text-sm">
            No LSTM data available. Please run a comparison first.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasHybridMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400 text-sm">
            No Hybrid data available. Please run a comparison first.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasComparisonData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-slate-400 text-sm">
            No comparison data available. Please run a comparison first.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Model Comparison</span>
          <WinnerBadge winner={comparisonData.winner} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Winner Summary */}
          <div className="rounded-lg bg-slate-800/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h4 className="mb-1 font-semibold">
                  {comparisonData.winner === "TIE"
                    ? "Models are evenly matched"
                    : `${comparisonData.winner} is the winner`}
                </h4>
                <p className="text-slate-400 text-sm">
                  {comparisonData.winner === "LSTM" &&
                    `LSTM outperforms Hybrid in ${comparisonData.lstmBetter?.length ?? 0} out of ${(comparisonData.lstmBetter?.length ?? 0) + (comparisonData.hybridBetter?.length ?? 0)} metrics`}
                  {comparisonData.winner === "HYBRID" &&
                    `Hybrid outperforms LSTM in ${comparisonData.hybridBetter?.length ?? 0} out of ${(comparisonData.lstmBetter?.length ?? 0) + (comparisonData.hybridBetter?.length ?? 0)} metrics`}
                  {comparisonData.winner === "TIE" &&
                    "Both models perform equally well across all metrics"}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Comparison */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Metric Comparison</h4>

            <MetricComparison
              format={(v) => `$${v.toFixed(2)}`}
              hybridValue={hybrid.metrics.mae}
              label="MAE"
              lowerIsBetter
              lstmValue={lstm.metrics.mae}
            />

            <MetricComparison
              format={(v) => `$${v.toFixed(2)}`}
              hybridValue={hybrid.metrics.rmse}
              label="RMSE"
              lowerIsBetter
              lstmValue={lstm.metrics.rmse}
            />

            <MetricComparison
              format={(v) => `${v.toFixed(2)}%`}
              hybridValue={hybrid.metrics.mape}
              label="MAPE"
              lowerIsBetter
              lstmValue={lstm.metrics.mape}
            />

            <MetricComparison
              format={(v) => v.toFixed(3)}
              hybridValue={hybrid.metrics.r2Score}
              label="R² Score"
              lowerIsBetter={false}
              lstmValue={lstm.metrics.r2Score}
            />

            <MetricComparison
              format={(v) => `${v.toFixed(1)}%`}
              hybridValue={hybrid.metrics.directionalAccuracy}
              label="Directional Accuracy"
              lowerIsBetter={false}
              lstmValue={lstm.metrics.directionalAccuracy}
            />
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="mb-2 font-semibold text-blue-400 text-sm">
                LSTM Strengths
              </h4>
              <ul className="space-y-1">
                {comparisonData.lstmBetter &&
                comparisonData.lstmBetter.length > 0 ? (
                  comparisonData.lstmBetter.map((metric) => (
                    <li
                      className="flex items-center gap-1 text-slate-400 text-sm"
                      key={metric}
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {metric}
                    </li>
                  ))
                ) : (
                  <li className="flex items-center gap-1 text-slate-500 text-sm">
                    <MinusCircle className="h-3 w-3" />
                    None
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-green-400 text-sm">
                Hybrid Strengths
              </h4>
              <ul className="space-y-1">
                {comparisonData.hybridBetter &&
                comparisonData.hybridBetter.length > 0 ? (
                  comparisonData.hybridBetter.map((metric) => (
                    <li
                      className="flex items-center gap-1 text-slate-400 text-sm"
                      key={metric}
                    >
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      {metric}
                    </li>
                  ))
                ) : (
                  <li className="flex items-center gap-1 text-slate-500 text-sm">
                    <MinusCircle className="h-3 w-3" />
                    None
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Recommendation */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
            <h4 className="mb-1 font-semibold text-blue-400 text-sm">
              Recommendation
            </h4>
            <p className="text-slate-300 text-sm">
              {getRecommendation(comparisonData.winner, lstm, hybrid)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper: Metric Comparison Row
function MetricComparison({
  label,
  lstmValue,
  hybridValue,
  format,
  lowerIsBetter,
}: {
  label: string;
  lstmValue: number;
  hybridValue: number;
  format: (v: number) => string;
  lowerIsBetter: boolean;
}) {
  const lstmBetter = lowerIsBetter
    ? lstmValue < hybridValue
    : lstmValue > hybridValue;

  return (
    <div className="flex items-center justify-between rounded bg-slate-800/30 p-3">
      <div className="flex-1">
        <div className="text-slate-400 text-sm">{label}</div>
      </div>
      <div className="flex items-center gap-4">
        <div
          className={`font-medium text-sm ${lstmBetter ? "text-blue-400" : "text-slate-500"}`}
        >
          LSTM: {format(lstmValue)}
          {lstmBetter && <CheckCircle2 className="ml-1 inline h-3 w-3" />}
        </div>
        <ArrowRight className="h-4 w-4 text-slate-600" />
        <div
          className={`font-medium text-sm ${lstmBetter ? "text-slate-500" : "text-green-400"}`}
        >
          Hybrid: {format(hybridValue)}
          {!lstmBetter && <CheckCircle2 className="ml-1 inline h-3 w-3" />}
        </div>
      </div>
    </div>
  );
}

// Helper: Winner Badge
function WinnerBadge({ winner }: { winner: "LSTM" | "HYBRID" | "TIE" }) {
  const config = {
    LSTM: { label: "LSTM Wins", class: "bg-blue-500/20 text-blue-400" },
    HYBRID: { label: "Hybrid Wins", class: "bg-green-500/20 text-green-400" },
    TIE: { label: "Tie", class: "bg-slate-500/20 text-slate-400" },
  };

  const { label, class: className } = config[winner];

  return (
    <span className={`rounded px-3 py-1 font-medium text-sm ${className}`}>
      {label}
    </span>
  );
}

// Helper: Get recommendation
function getRecommendation(
  winner: "LSTM" | "HYBRID" | "TIE",
  lstm: { executionTime: number },
  hybrid: { executionTime: number }
): string {
  if (winner === "LSTM") {
    return `Use LSTM model for production. It provides better accuracy at the cost of ${(lstm.executionTime / 1000).toFixed(1)}s training time.`;
  }

  if (winner === "HYBRID") {
    return `Use Hybrid model for production. It offers instant predictions (${(hybrid.executionTime / 1000).toFixed(1)}s) with competitive accuracy.`;
  }

  return "Both models perform equally well. Choose LSTM for maximum accuracy or Hybrid for faster predictions.";
}
