/**
 * HPO Trials Table
 * Display all optimization trials with metrics
 */

import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import type { OptimizationResult } from "../../lib/api/ml";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type HPOTrialsTableProps = {
  result: OptimizationResult;
};

export function HPOTrialsTable({ result }: HPOTrialsTableProps) {
  const { trials, optimizationMetric, bestValue } = result;

  // Sort trials by value
  const sortedTrials = [...trials].sort((a, b) => {
    const lowerIsBetter =
      optimizationMetric === "mae" ||
      optimizationMetric === "rmse" ||
      optimizationMetric === "mape";

    return lowerIsBetter ? a.value - b.value : b.value - a.value;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Optimization Trials ({trials.length} total)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-slate-700 border-b">
                <th className="p-2 text-left text-slate-400">Trial</th>
                <th className="p-2 text-left text-slate-400">
                  Hyperparameters
                </th>
                <th className="p-2 text-right text-slate-400">
                  {optimizationMetric.replace("_", " ").toUpperCase()}
                </th>
                <th className="p-2 text-right text-slate-400">MAE</th>
                <th className="p-2 text-right text-slate-400">RMSE</th>
                <th className="p-2 text-right text-slate-400">Direction</th>
                <th className="p-2 text-center text-slate-400">Best</th>
              </tr>
            </thead>
            <tbody>
              {sortedTrials.map((trial, idx) => {
                const isBest = trial.value === bestValue;
                return (
                  <TrialRow
                    isBest={isBest}
                    isTop3={idx < 3}
                    key={trial.trialNumber}
                    metric={optimizationMetric}
                    trial={trial}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TrialRow({
  trial,
  metric,
  isBest,
  isTop3,
}: {
  trial: import("../../lib/api/ml").OptimizationTrial;
  metric: string;
  isBest: boolean;
  isTop3: boolean;
}) {
  const getRowClass = () => {
    if (isBest) return "border-b border-slate-800 bg-blue-500/10";
    if (isTop3) return "border-b border-slate-800 bg-slate-800/30";
    return "border-b border-slate-800";
  };

  const rowClass = getRowClass();

  return (
    <tr className={rowClass}>
      <td className="p-2">
        <span className="font-mono text-slate-300">#{trial.trialNumber}</span>
      </td>
      <td className="p-2">
        <div className="flex flex-wrap gap-1">
          {Object.entries(trial.params).map(([key, value]) => (
            <span
              className="rounded bg-slate-700 px-2 py-0.5 text-slate-300 text-xs"
              key={key}
            >
              {key}=
              {formatValue(typeof value === "number" ? value : String(value))}
            </span>
          ))}
        </div>
      </td>
      <td className="p-2 text-right">
        <ScoreCell metric={metric} score={trial.value} />
      </td>
      <td className="p-2 text-right font-mono text-slate-300">
        ${trial.metrics.mae.toFixed(2)}
      </td>
      <td className="p-2 text-right font-mono text-slate-300">
        ${trial.metrics.rmse.toFixed(2)}
      </td>
      <td className="p-2 text-right font-mono">
        <DirectionCell accuracy={trial.metrics.directionalAccuracy} />
      </td>
      <td className="p-2 text-center">
        {isBest && <CheckCircle2 className="inline h-4 w-4 text-green-500" />}
      </td>
    </tr>
  );
}

function ScoreCell({ metric, score }: { metric: string; score: number }) {
  const getColorAndIcon = (): { color: string; icon: React.ReactNode } => {
    if (metric === "directionalAccuracy") {
      if (score > 60) {
        return {
          color: "text-green-400",
          icon: <TrendingUp className="inline h-3 w-3" />,
        };
      }
      if (score > 55) {
        return { color: "text-yellow-400", icon: null };
      }
      return {
        color: "text-red-400",
        icon: <TrendingDown className="inline h-3 w-3" />,
      };
    }

    if (metric === "r2Score") {
      if (score > 0.8) return { color: "text-green-400", icon: null };
      if (score > 0.5) return { color: "text-yellow-400", icon: null };
      return { color: "text-red-400", icon: null };
    }

    return { color: "text-slate-300", icon: null };
  };

  const { color, icon } = getColorAndIcon();

  return (
    <span className={`font-mono font-semibold ${color}`}>
      {formatScore(metric, score)} {icon}
    </span>
  );
}

function DirectionCell({ accuracy }: { accuracy: number }) {
  let colorClass = "text-slate-300";
  if (accuracy > 60) {
    colorClass = "text-green-400";
  } else if (accuracy > 55) {
    colorClass = "text-yellow-400";
  } else if (accuracy < 50) {
    colorClass = "text-red-400";
  }

  return <span className={colorClass}>{accuracy.toFixed(1)}%</span>;
}

function formatScore(metric: string, score: number): string {
  if (metric === "mae" || metric === "rmse") {
    return `$${score.toFixed(2)}`;
  }
  if (metric === "mape") {
    return `${score.toFixed(2)}%`;
  }
  if (metric === "r2Score") {
    return score.toFixed(3);
  }
  if (metric === "directionalAccuracy") {
    return `${score.toFixed(1)}%`;
  }
  return score.toFixed(2);
}

function formatValue(value: number | string): string {
  if (typeof value === "string") return value;
  if (value < 0.01 && value > 0) {
    return value.toFixed(4);
  }
  if (value < 1) {
    return value.toFixed(2);
  }
  return value.toString();
}
