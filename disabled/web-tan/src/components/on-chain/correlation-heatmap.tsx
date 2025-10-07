import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCorrelations } from "@/hooks/use-correlations";

type Props = {
  blockchain: "BTC" | "ETH";
  period: { from: number; to: number };
};

const METRIC_LABELS: Record<string, string> = {
  mvrv_ratio: "MVRV",
  nupl: "NUPL",
  reserve_risk: "Reserve Risk",
  exchange_net_flow: "Exchange Flow",
  whale_tx_count: "Whale Activity",
  active_addresses: "Active Addresses",
  puell_multiple: "Puell Multiple",
  sopr: "SOPR",
};

/**
 * Get color for correlation value
 * -1 (red) to +1 (green)
 */
function getCorrelationColor(value: number): string {
  if (value > 0.7) return "bg-emerald-600";
  if (value > 0.4) return "bg-emerald-500";
  if (value > 0.1) return "bg-emerald-400";
  if (value > -0.1) return "bg-slate-400";
  if (value > -0.4) return "bg-red-400";
  if (value > -0.7) return "bg-red-500";
  return "bg-red-600";
}

/**
 * Correlation Heatmap Component
 */
export function CorrelationHeatmap({ blockchain, period }: Props) {
  const { data, isLoading, error } = useCorrelations(blockchain, period);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metric Correlations - {blockchain}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metric Correlations - {blockchain}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">
            Failed to load correlation data
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const { correlationMatrix, metricNames } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Metric Correlations - {blockchain}</span>
          <span className="font-normal text-muted-foreground text-sm">
            {data.dataPoints} data points
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header row */}
            <div className="mb-2 flex">
              <div className="w-32" />
              {metricNames.map((metric) => (
                <div
                  className="w-20 text-center font-medium text-xs"
                  key={metric}
                  style={{
                    writingMode: "vertical-rl",
                    transform: "rotate(180deg)",
                  }}
                >
                  {METRIC_LABELS[metric] || metric}
                </div>
              ))}
            </div>

            {/* Matrix rows */}
            {metricNames.map((rowMetric) => (
              <div className="mb-1 flex items-center" key={rowMetric}>
                {/* Row label */}
                <div className="w-32 pr-2 text-right font-medium text-xs">
                  {METRIC_LABELS[rowMetric] || rowMetric}
                </div>

                {/* Correlation cells */}
                {metricNames.map((colMetric) => {
                  const value = correlationMatrix[rowMetric]?.[colMetric] ?? 0;
                  const colorClass = getCorrelationColor(value);

                  return (
                    <div
                      className={`flex h-12 w-20 items-center justify-center font-medium text-xs ${colorClass} cursor-pointer border border-background text-white transition-opacity hover:opacity-80`}
                      key={`${rowMetric}-${colMetric}`}
                      title={`${METRIC_LABELS[rowMetric]} vs ${METRIC_LABELS[colMetric]}: ${value.toFixed(3)}`}
                    >
                      {value.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <span className="text-muted-foreground text-xs">Strong Negative</span>
          <div className="flex gap-1">
            <div className="h-4 w-8 bg-red-600" />
            <div className="h-4 w-8 bg-red-500" />
            <div className="h-4 w-8 bg-red-400" />
            <div className="h-4 w-8 bg-slate-400" />
            <div className="h-4 w-8 bg-emerald-400" />
            <div className="h-4 w-8 bg-emerald-500" />
            <div className="h-4 w-8 bg-emerald-600" />
          </div>
          <span className="text-muted-foreground text-xs">Strong Positive</span>
        </div>

        {/* Interpretation guide */}
        <div className="mt-4 rounded-lg bg-muted p-4">
          <h4 className="mb-2 font-semibold text-sm">Interpretation:</h4>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>
              <strong className="text-emerald-600">+1.0</strong>: Perfect
              positive correlation
            </li>
            <li>
              <strong className="text-slate-600">0.0</strong>: No correlation
            </li>
            <li>
              <strong className="text-red-600">-1.0</strong>: Perfect negative
              correlation
            </li>
            <li className="mt-2">
              Strong correlations (&gt;0.7 or &lt;-0.7) indicate metrics that
              move together
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
