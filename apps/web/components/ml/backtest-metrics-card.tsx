/**
 * Backtest Metrics Card
 * Display evaluation metrics from backtesting
 */

import { Activity, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { EvaluationMetrics } from "../../lib/api/ml";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type BacktestMetricsCardProps = {
  metrics: EvaluationMetrics;
  modelType: "LSTM" | "HYBRID";
};

type Quality = "good" | "medium" | "poor";

// Helper functions for quality determination
function getMAEQuality(mae: number): Quality {
  if (mae < 100) return "good";
  if (mae < 200) return "medium";
  return "poor";
}

function getRMSEQuality(rmse: number): Quality {
  if (rmse < 150) return "good";
  if (rmse < 250) return "medium";
  return "poor";
}

function getMAPEQuality(mape: number): Quality {
  if (mape < 5) return "good";
  if (mape < 10) return "medium";
  return "poor";
}

function getR2Quality(r2Score: number): Quality {
  if (r2Score > 0.8) return "good";
  if (r2Score > 0.5) return "medium";
  return "poor";
}

function getDirectionalQuality(accuracy: number): Quality {
  if (accuracy > 55) return "good";
  if (accuracy > 50) return "medium";
  return "poor";
}

function getErrorQuality(error: number): Quality {
  const abs = Math.abs(error);
  if (abs < 10) return "good";
  if (abs < 50) return "medium";
  return "poor";
}

function getAbsErrorQuality(error: number): Quality {
  const abs = Math.abs(error);
  if (abs < 500) return "good";
  if (abs < 1000) return "medium";
  return "poor";
}

export function BacktestMetricsCard({
  metrics,
  modelType,
}: BacktestMetricsCardProps) {
  const quality = getMetricsQuality(metrics);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{modelType} Model Metrics</span>
          <QualityBadge quality={quality} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricItem
            icon={<Target className="h-4 w-4" />}
            label="MAE"
            quality={getMAEQuality(metrics.mae)}
            tooltip="Mean Absolute Error - Average error in dollars"
            value={`$${metrics.mae.toFixed(2)}`}
          />

          <MetricItem
            icon={<Activity className="h-4 w-4" />}
            label="RMSE"
            quality={getRMSEQuality(metrics.rmse)}
            tooltip="Root Mean Squared Error - Penalizes large errors"
            value={`$${metrics.rmse.toFixed(2)}`}
          />

          <MetricItem
            icon={<TrendingUp className="h-4 w-4" />}
            label="MAPE"
            quality={getMAPEQuality(metrics.mape)}
            tooltip="Mean Absolute Percentage Error"
            value={`${metrics.mape.toFixed(2)}%`}
          />

          <MetricItem
            icon={<Zap className="h-4 w-4" />}
            label="R² Score"
            quality={getR2Quality(metrics.r2Score)}
            tooltip="Coefficient of Determination (0-1)"
            value={metrics.r2Score.toFixed(3)}
          />

          <MetricItem
            icon={<TrendingUp className="h-4 w-4" />}
            label="Direction"
            quality={getDirectionalQuality(metrics.directionalAccuracy)}
            tooltip="Correct direction predictions"
            value={`${metrics.directionalAccuracy.toFixed(1)}%`}
          />

          <MetricItem
            icon={<Activity className="h-4 w-4" />}
            label="Bias"
            quality={getErrorQuality(metrics.meanError)}
            tooltip="Mean Error - Systematic bias"
            value={`${metrics.meanError >= 0 ? "+" : ""}${metrics.meanError.toFixed(2)}`}
          />

          <MetricItem
            icon={<TrendingUp className="h-4 w-4" />}
            label="Max Error"
            quality={getAbsErrorQuality(metrics.maxError)}
            tooltip="Largest positive error"
            value={`$${metrics.maxError.toFixed(0)}`}
          />

          <MetricItem
            icon={<TrendingDown className="h-4 w-4" />}
            label="Min Error"
            quality={getAbsErrorQuality(metrics.minError)}
            tooltip="Largest negative error"
            value={`$${metrics.minError.toFixed(0)}`}
          />
        </div>

        {/* Quality Interpretation */}
        <div className="mt-6 rounded-lg bg-slate-800/50 p-4">
          <h4 className="mb-2 font-semibold text-sm">Interpretation</h4>
          <p className="text-slate-400 text-sm">{getInterpretation(metrics)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper: Metric Item
function MetricItem({
  icon,
  label,
  value,
  quality,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  quality: Quality;
  tooltip: string;
}) {
  let colorClass = "text-red-500";
  if (quality === "good") {
    colorClass = "text-green-500";
  } else if (quality === "medium") {
    colorClass = "text-yellow-500";
  }

  return (
    <div className="flex flex-col gap-1" title={tooltip}>
      <div className="flex items-center gap-1 text-slate-400 text-xs">
        <span className={colorClass}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`font-semibold text-lg ${colorClass}`}>{value}</div>
    </div>
  );
}

// Helper: Quality Badge
function QualityBadge({
  quality,
}: {
  quality: "excellent" | "good" | "medium" | "poor";
}) {
  const config = {
    excellent: { label: "Excellent", class: "bg-green-500/20 text-green-500" },
    good: { label: "Good", class: "bg-blue-500/20 text-blue-500" },
    medium: { label: "Medium", class: "bg-yellow-500/20 text-yellow-500" },
    poor: { label: "Poor", class: "bg-red-500/20 text-red-500" },
  };

  const { label, class: className } = config[quality];

  return (
    <span className={`rounded px-2 py-1 font-medium text-xs ${className}`}>
      {label}
    </span>
  );
}

// Helper: Get metrics quality
function getMetricsQuality(
  metrics: EvaluationMetrics
): "excellent" | "good" | "medium" | "poor" {
  let score = 0;

  if (metrics.mape < 5) score++;
  if (metrics.r2Score > 0.8) score++;
  if (metrics.directionalAccuracy > 55) score++;
  if (Math.abs(metrics.meanError) < 10) score++;
  if (metrics.rmse / metrics.mae < 1.5) score++;

  if (score >= 4) return "excellent";
  if (score >= 3) return "good";
  if (score >= 2) return "medium";
  return "poor";
}

// Helper: Get interpretation
function getInterpretation(metrics: EvaluationMetrics): string {
  const quality = getMetricsQuality(metrics);

  if (quality === "excellent") {
    return "Outstanding model performance! Low error rates, high explanatory power, and profitable direction accuracy. Ready for production deployment.";
  }

  if (quality === "good") {
    return "Good model performance with reliable predictions. Some room for improvement, but suitable for production with monitoring.";
  }

  if (quality === "medium") {
    return "Acceptable model performance but needs improvement. Consider retraining with more data or adjusting hyperparameters.";
  }

  return "Poor model performance. High error rates and low accuracy. Requires significant improvements before deployment.";
}
