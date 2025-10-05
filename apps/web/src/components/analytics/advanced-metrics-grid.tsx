/**
 * Advanced Performance Metrics Grid
 * Displays all advanced performance metrics in a grid layout
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { useAdvancedMetrics } from "@/hooks/use-advanced-metrics";

type AdvancedMetricsGridProps = {
  portfolioId: string;
  from?: Date;
  to?: Date;
};

export function AdvancedMetricsGrid({
  portfolioId,
  from,
  to,
}: AdvancedMetricsGridProps) {
  const { data, isLoading, error } = useAdvancedMetrics(portfolioId, {
    from,
    to,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MetricCard
            description="Loading..."
            key={i}
            loading
            title="Metric"
            value="0"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-muted-foreground text-sm">
            Failed to load advanced metrics
          </div>
        </CardContent>
      </Card>
    );
  }

  const { performance } = data;

  const getMetricColor = (value: number, threshold: number) => {
    if (value > threshold) return "text-green-500";
    if (value < -threshold) return "text-red-500";
    return "text-muted-foreground";
  };

  const getUlcerIndexColor = (value: number) => {
    if (value < 5) return "text-green-500";
    if (value > 10) return "text-red-500";
    return "text-muted-foreground";
  };

  const getDrawdownColor = (value: number) => {
    if (value < 10) return "text-green-500";
    if (value > 20) return "text-red-500";
    return "text-yellow-500";
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Sortino Ratio */}
      <MetricCard
        description="Downside risk-adjusted return"
        footer={
          <p className="text-muted-foreground/70 text-xs italic">
            💡 Higher is better. &gt;2 is excellent, &lt;1 is poor
          </p>
        }
        icon={TrendingUp}
        title="Sortino Ratio"
        value={performance.sortinoRatio.toFixed(2)}
        valueClassName={getMetricColor(performance.sortinoRatio, 1.5)}
      />

      {/* Calmar Ratio */}
      <MetricCard
        description="Return / Max Drawdown"
        footer={
          <p className="text-muted-foreground/70 text-xs italic">
            💡 Higher is better. &gt;3 is excellent
          </p>
        }
        icon={Target}
        title="Calmar Ratio"
        value={performance.calmarRatio.toFixed(2)}
        valueClassName={getMetricColor(performance.calmarRatio, 2)}
      />

      {/* Information Ratio */}
      <MetricCard
        description="Excess return vs benchmark"
        footer={
          <p className="text-muted-foreground/70 text-xs italic">
            💡 Higher is better. &gt;0.5 is good, &gt;1 is excellent
          </p>
        }
        icon={Activity}
        title="Information Ratio"
        value={performance.informationRatio.toFixed(2)}
        valueClassName={getMetricColor(performance.informationRatio, 0.5)}
      />

      {/* Omega Ratio */}
      <MetricCard
        description="Probability-weighted gains/losses"
        footer={
          <p className="text-muted-foreground/70 text-xs italic">
            💡 Higher is better. &gt;1.5 is good
          </p>
        }
        icon={BarChart3}
        title="Omega Ratio"
        value={performance.omegaRatio.toFixed(2)}
        valueClassName={getMetricColor(performance.omegaRatio, 1)}
      />

      {/* Ulcer Index */}
      <MetricCard
        description="Drawdown stress measure"
        footer={
          <p className="text-muted-foreground/70 text-xs italic">
            💡 Lower is better. &lt;5 is good, &gt;10 is concerning
          </p>
        }
        icon={AlertTriangle}
        title="Ulcer Index"
        value={performance.ulcerIndex.toFixed(2)}
        valueClassName={getUlcerIndexColor(performance.ulcerIndex)}
      />

      {/* Max Drawdown */}
      <MetricCard
        description="Maximum decline from peak"
        footer={
          <p className="text-muted-foreground/70 text-xs italic">
            💡 Lower is better. &lt;10% is good, &gt;20% is concerning
          </p>
        }
        icon={TrendingDown}
        title="Max Drawdown"
        value={`${performance.maxDrawdown.toFixed(2)}%`}
        valueClassName={getDrawdownColor(performance.maxDrawdown)}
      />
    </div>
  );
}
