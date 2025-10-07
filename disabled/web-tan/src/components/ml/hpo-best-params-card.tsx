/**
 * HPO Best Parameters Card
 * Display best hyperparameters and improvement
 */

import { Award, TrendingUp } from "lucide-react";
import type { OptimizationResult } from "../../lib/api/ml";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type HPOBestParamsCardProps = {
  result: OptimizationResult;
};

export function HPOBestParamsCard({ result }: HPOBestParamsCardProps) {
  const { bestTrial, bestHyperparameters, improvementPercentage, config } =
    result;

  const getImprovementColor = () => {
    if (improvementPercentage > 10) return "text-green-500";
    if (improvementPercentage > 5) return "text-yellow-500";
    return "text-slate-400";
  };

  const improvementColor = getImprovementColor();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-yellow-500" />
          Best Parameters (Trial #{bestTrial.trialId})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Improvement Badge */}
        <div className="flex items-center justify-center rounded-lg bg-slate-800/50 p-6">
          <div className="text-center">
            <div className="mb-2 text-slate-400 text-sm">Improvement</div>
            <div
              className={`flex items-center gap-2 font-bold text-4xl ${improvementColor}`}
            >
              <TrendingUp className="h-8 w-8" />
              {improvementPercentage > 0 ? "+" : ""}
              {improvementPercentage.toFixed(2)}%
            </div>
            <div className="mt-2 text-slate-500 text-sm">
              vs baseline (Trial #1)
            </div>
          </div>
        </div>

        {/* Best Hyperparameters */}
        <div>
          <h4 className="mb-3 font-semibold text-sm">Best Hyperparameters</h4>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(bestHyperparameters).map(([key, value]) => (
              <div
                className="rounded-lg border border-slate-700 bg-slate-800/30 p-3"
                key={key}
              >
                <div className="mb-1 text-slate-400 text-xs">
                  {formatKey(key)}
                </div>
                <div className="font-mono font-semibold text-lg">
                  {formatValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Metrics */}
        <div>
          <h4 className="mb-3 font-semibold text-sm">Performance Metrics</h4>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricItem
              label="MAE"
              quality={getMAEQuality(bestTrial.metrics.mae)}
              value={`$${bestTrial.metrics.mae.toFixed(2)}`}
            />
            <MetricItem
              label="RMSE"
              quality={getRMSEQuality(bestTrial.metrics.rmse)}
              value={`$${bestTrial.metrics.rmse.toFixed(2)}`}
            />
            <MetricItem
              label="MAPE"
              quality={getMAPEQuality(bestTrial.metrics.mape)}
              value={`${bestTrial.metrics.mape.toFixed(2)}%`}
            />
            <MetricItem
              label="R² Score"
              quality={getR2Quality(bestTrial.metrics.r2Score)}
              value={bestTrial.metrics.r2Score.toFixed(3)}
            />
            <MetricItem
              label="Direction"
              quality={getDirectionQuality(
                bestTrial.metrics.directionalAccuracy
              )}
              value={`${bestTrial.metrics.directionalAccuracy.toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Copy Command */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="mb-2 font-semibold text-sm">Use These Parameters</div>
          <pre className="overflow-x-auto text-slate-300 text-xs">
            {JSON.stringify(bestHyperparameters, null, 2)}
          </pre>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <div className="mb-1 font-semibold text-green-400 text-sm">
            Recommendation
          </div>
          <p className="text-slate-300 text-sm">
            {getRecommendation(
              improvementPercentage,
              config.optimizationMetric
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricItem({
  label,
  value,
  quality,
}: {
  label: string;
  value: string;
  quality: "good" | "medium" | "poor";
}) {
  const getColorClass = () => {
    if (quality === "good") return "text-green-500";
    if (quality === "medium") return "text-yellow-500";
    return "text-red-500";
  };

  const colorClass = getColorClass();

  return (
    <div className="rounded-lg bg-slate-800/30 p-2">
      <div className="mb-1 text-slate-400 text-xs">{label}</div>
      <div className={`font-mono font-semibold text-sm ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}

const UPPERCASE_REGEX = /([A-Z])/g;
const FIRST_CHAR_REGEX = /^./;

function formatKey(key: string): string {
  return key
    .replace(UPPERCASE_REGEX, " $1")
    .replace(FIRST_CHAR_REGEX, (str) => str.toUpperCase())
    .trim();
}

function formatValue(key: string, value: number): string {
  if (key.includes("rate") || key.includes("Factor")) {
    return value.toFixed(4);
  }
  return value.toString();
}

function getMAEQuality(mae: number): "good" | "medium" | "poor" {
  if (mae < 100) return "good";
  if (mae < 200) return "medium";
  return "poor";
}

function getRMSEQuality(rmse: number): "good" | "medium" | "poor" {
  if (rmse < 150) return "good";
  if (rmse < 250) return "medium";
  return "poor";
}

function getMAPEQuality(mape: number): "good" | "medium" | "poor" {
  if (mape < 5) return "good";
  if (mape < 10) return "medium";
  return "poor";
}

function getR2Quality(r2: number): "good" | "medium" | "poor" {
  if (r2 > 0.8) return "good";
  if (r2 > 0.5) return "medium";
  return "poor";
}

function getDirectionQuality(acc: number): "good" | "medium" | "poor" {
  if (acc > 55) return "good";
  if (acc > 50) return "medium";
  return "poor";
}

function getRecommendation(improvement: number, metric: string): string {
  if (improvement > 10) {
    return (
      "Excellent improvement! These parameters significantly boost " +
      metric +
      ". Deploy to production with confidence."
    );
  }

  if (improvement > 5) {
    return (
      "Good improvement! These parameters enhance " +
      metric +
      " noticeably. Suitable for production after validation."
    );
  }

  if (improvement > 0) {
    return (
      "Modest improvement in " +
      metric +
      ". Consider running more trials or expanding the parameter space."
    );
  }

  return "No improvement found. The baseline parameters may already be optimal, or consider different parameter ranges.";
}
