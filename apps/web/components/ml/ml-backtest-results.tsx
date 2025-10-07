/**
 * ML Backtest Results
 * Main component for displaying backtesting results
 */

import { Calendar, Clock, MessageSquare, TrendingUp } from "lucide-react";
import type { BacktestResult } from "../../lib/api/ml";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { BacktestChart } from "./backtest-chart";
import { BacktestMetricsCard } from "./backtest-metrics-card";
import { ErrorDistributionChart } from "./error-distribution-chart";

type MLBacktestResultsProps = {
  result: BacktestResult;
};

export function MLBacktestResults({ result }: MLBacktestResultsProps) {
  const { config, metrics, predictions, summary, executionTime } = result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              Backtest Results: {config.symbol} ({config.modelType})
            </span>
            <div className="flex items-center gap-2 font-normal text-slate-400 text-sm">
              <Clock className="h-4 w-4" />
              {(executionTime / 1000).toFixed(1)}s
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {/* Horizon */}
            <InfoItem
              icon={<TrendingUp className="h-4 w-4" />}
              label="Horizon"
              value={config.horizon}
            />

            {/* Period */}
            <InfoItem
              icon={<Calendar className="h-4 w-4" />}
              label="Period"
              value={`${Math.ceil((config.endDate - config.startDate) / (1000 * 60 * 60 * 24))} days`}
            />

            {/* Mode */}
            <InfoItem
              icon={<TrendingUp className="h-4 w-4" />}
              label="Mode"
              value={config.walkForward ? "Walk-Forward" : "Simple"}
            />

            {/* Predictions */}
            <InfoItem
              icon={<TrendingUp className="h-4 w-4" />}
              label="Predictions"
              value={`${summary.successfulPredictions}/${summary.totalPredictions}`}
            />

            {/* Sentiment Status */}
            <InfoItem
              icon={<MessageSquare className="h-4 w-4" />}
              label="Sentiment"
              value={
                (result.includeSentiment ?? config.includeSentiment ?? true)
                  ? "Enabled"
                  : "Disabled"
              }
            />
          </div>

          {/* Walk-Forward Info */}
          {config.walkForward && (
            <div className="mt-4 rounded border border-blue-500/20 bg-blue-500/10 p-3">
              <div className="text-sm">
                <span className="font-medium text-blue-400">
                  Walk-Forward Testing:
                </span>{" "}
                <span className="text-slate-300">
                  Model retrained {summary.modelRetrains} times every{" "}
                  {config.retrainInterval} days
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Card */}
      <BacktestMetricsCard metrics={metrics} modelType={config.modelType} />

      {/* Charts */}
      <Tabs className="w-full" defaultValue="predicted-vs-actual">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="predicted-vs-actual">
            Predicted vs Actual
          </TabsTrigger>
          <TabsTrigger value="error-distribution">
            Error Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predicted-vs-actual">
          <Card>
            <CardHeader>
              <CardTitle>Predicted vs Actual Prices</CardTitle>
            </CardHeader>
            <CardContent>
              <BacktestChart height={400} predictions={predictions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="error-distribution">
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorDistributionChart height={300} predictions={predictions} />

              {/* Error Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded bg-slate-800/30 p-3">
                  <div className="mb-1 text-slate-400 text-xs">Mean Error</div>
                  <div className="font-semibold text-lg">
                    ${metrics.meanError.toFixed(2)}
                  </div>
                  <div className="text-slate-500 text-xs">
                    {metrics.meanError > 0
                      ? "Overestimating"
                      : "Underestimating"}
                  </div>
                </div>
                <div className="rounded bg-slate-800/30 p-3">
                  <div className="mb-1 text-slate-400 text-xs">Max Error</div>
                  <div className="font-semibold text-lg text-red-400">
                    ${metrics.maxError.toFixed(0)}
                  </div>
                  <div className="text-slate-500 text-xs">Worst case</div>
                </div>
                <div className="rounded bg-slate-800/30 p-3">
                  <div className="mb-1 text-slate-400 text-xs">Min Error</div>
                  <div className="font-semibold text-green-400 text-lg">
                    ${metrics.minError.toFixed(0)}
                  </div>
                  <div className="text-slate-500 text-xs">Best case</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detailed Predictions Table (first 10) */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Predictions (First 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-slate-700 border-b">
                  <th className="p-2 text-left text-slate-400">Timestamp</th>
                  <th className="p-2 text-right text-slate-400">Actual</th>
                  <th className="p-2 text-right text-slate-400">Predicted</th>
                  <th className="p-2 text-right text-slate-400">Error</th>
                  <th className="p-2 text-right text-slate-400">Error %</th>
                  <th className="p-2 text-center text-slate-400">Direction</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 10).map((pred, idx) => (
                  <tr className="border-slate-800 border-b" key={idx}>
                    <td className="p-2 text-slate-300">
                      {new Date(pred.timestamp).toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono">
                      ${pred.actual.toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-mono">
                      ${pred.predicted.toFixed(2)}
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${pred.error > 0 ? "text-red-400" : "text-green-400"}`}
                    >
                      {pred.error > 0 ? "+" : ""}
                      {pred.error.toFixed(2)}
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${Math.abs(pred.percentError) > 5 ? "text-red-400" : "text-slate-300"}`}
                    >
                      {pred.percentError > 0 ? "+" : ""}
                      {pred.percentError.toFixed(2)}%
                    </td>
                    <td className="p-2 text-center">
                      {pred.correctDirection ? (
                        <span className="text-green-500">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper: Info Item
function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-slate-400 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}
