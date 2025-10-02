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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvancedMetrics } from "@/hooks/use-advanced-metrics";

interface AdvancedMetricsGridProps {
  portfolioId: string;
  from?: Date;
  to?: Date;
}

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
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Sortino Ratio */}
      <MetricCard
        description="Downside risk-adjusted return"
        icon={<TrendingUp className="h-4 w-4" />}
        title="Sortino Ratio"
        tooltip="Higher is better. >2 is excellent, <1 is poor"
        value={performance.sortinoRatio.toFixed(2)}
        valueColor={getMetricColor(performance.sortinoRatio, 1.5)}
      />

      {/* Calmar Ratio */}
      <MetricCard
        description="Return / Max Drawdown"
        icon={<Target className="h-4 w-4" />}
        title="Calmar Ratio"
        tooltip="Higher is better. >3 is excellent"
        value={performance.calmarRatio.toFixed(2)}
        valueColor={getMetricColor(performance.calmarRatio, 2)}
      />

      {/* Information Ratio */}
      <MetricCard
        description="Excess return vs benchmark"
        icon={<Activity className="h-4 w-4" />}
        title="Information Ratio"
        tooltip="Higher is better. >0.5 is good, >1 is excellent"
        value={performance.informationRatio.toFixed(2)}
        valueColor={getMetricColor(performance.informationRatio, 0.5)}
      />

      {/* Omega Ratio */}
      <MetricCard
        description="Probability-weighted gains/losses"
        icon={<BarChart3 className="h-4 w-4" />}
        title="Omega Ratio"
        tooltip="Higher is better. >1.5 is good"
        value={performance.omegaRatio.toFixed(2)}
        valueColor={getMetricColor(performance.omegaRatio, 1)}
      />

      {/* Ulcer Index */}
      <MetricCard
        description="Drawdown stress measure"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Ulcer Index"
        tooltip="Lower is better. <5 is good, >10 is concerning"
        value={performance.ulcerIndex.toFixed(2)}
        valueColor={
          performance.ulcerIndex < 5
            ? "text-green-500"
            : performance.ulcerIndex > 10
              ? "text-red-500"
              : "text-muted-foreground"
        }
      />

      {/* Max Drawdown */}
      <MetricCard
        description="Maximum decline from peak"
        icon={<TrendingDown className="h-4 w-4" />}
        title="Max Drawdown"
        tooltip="Lower is better. <10% is good, >20% is concerning"
        value={`${performance.maxDrawdown.toFixed(2)}%`}
        valueColor={
          performance.maxDrawdown < 10
            ? "text-green-500"
            : performance.maxDrawdown > 20
              ? "text-red-500"
              : "text-yellow-500"
        }
      />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  valueColor?: string;
  tooltip?: string;
}

function MetricCard({
  title,
  value,
  icon,
  description,
  valueColor = "text-foreground",
  tooltip,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-sm">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`font-bold text-2xl ${valueColor}`}>{value}</div>
        <p className="mt-1 text-muted-foreground text-xs">{description}</p>
        {tooltip && (
          <p className="mt-2 text-muted-foreground/70 text-xs italic">
            💡 {tooltip}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
