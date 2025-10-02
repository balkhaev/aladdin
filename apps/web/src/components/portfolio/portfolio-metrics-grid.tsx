/**
 * Portfolio Metrics Grid Component
 * Displays advanced performance metrics (Sharpe, Sortino, Calmar, Max Drawdown)
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

// Thresholds for color coding
const SHARPE_GOOD_THRESHOLD = 1;
const SORTINO_GOOD_THRESHOLD = 1.5;
const CALMAR_GOOD_THRESHOLD = 2;
const INFO_RATIO_GOOD_THRESHOLD = 0.5;
const DRAWDOWN_GOOD_THRESHOLD = 10;
const DRAWDOWN_WARNING_THRESHOLD = 20;
const ULCER_GOOD_THRESHOLD = 3;
const ULCER_WARNING_THRESHOLD = 5;
const WIN_RATE_GOOD_THRESHOLD = 50;
const WIN_RATE_EXCELLENT_THRESHOLD = 60;
const PROFIT_FACTOR_GOOD_THRESHOLD = 1.5;
const PROFIT_FACTOR_EXCELLENT_THRESHOLD = 2;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdvancedPortfolioMetrics } from "@/hooks/use-portfolio";

type PortfolioMetricsGridProps = {
  portfolioId: string;
  from?: Date;
  to?: Date;
};

export function PortfolioMetricsGrid({
  portfolioId,
  from,
  to,
}: PortfolioMetricsGridProps) {
  const { data, isLoading, error } = useAdvancedPortfolioMetrics(portfolioId, {
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
            Не удалось загрузить метрики
          </div>
        </CardContent>
      </Card>
    );
  }

  const { performance, trading } = data;

  // Safely format metric value
  const formatMetric = (
    value: number | null | undefined,
    decimals = 2,
    suffix = ""
  ): string => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "N/A";
    }
    return `${value.toFixed(decimals)}${suffix}`;
  };

  const getMetricColor = (
    value: number | null | undefined,
    threshold: number
  ) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "text-muted-foreground";
    }
    if (value > threshold) return "text-green-500";
    if (value < -threshold) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Sharpe Ratio */}
      <MetricCard
        description="Доходность с учетом риска"
        icon={<TrendingUp className="h-4 w-4" />}
        title="Sharpe Ratio"
        tooltip=">1 хорошо, >2 отлично"
        value={formatMetric(performance.sharpeRatio, 2)}
        valueColor={getMetricColor(
          performance.sharpeRatio,
          SHARPE_GOOD_THRESHOLD
        )}
      />

      {/* Sortino Ratio */}
      <MetricCard
        description="Доходность с учетом downside риска"
        icon={<TrendingUp className="h-4 w-4" />}
        title="Sortino Ratio"
        tooltip=">2 отлично, <1 плохо"
        value={formatMetric(performance.sortinoRatio, 2)}
        valueColor={getMetricColor(
          performance.sortinoRatio,
          SORTINO_GOOD_THRESHOLD
        )}
      />

      {/* Calmar Ratio */}
      <MetricCard
        description="Доходность / Max Drawdown"
        icon={<Target className="h-4 w-4" />}
        title="Calmar Ratio"
        tooltip=">3 отлично"
        value={formatMetric(performance.calmarRatio, 2)}
        valueColor={getMetricColor(
          performance.calmarRatio,
          CALMAR_GOOD_THRESHOLD
        )}
      />

      {/* Information Ratio */}
      <MetricCard
        description="Превышение доходности над бенчмарком"
        icon={<Activity className="h-4 w-4" />}
        title="Information Ratio"
        tooltip=">0.5 хорошо, >1 отлично"
        value={formatMetric(performance.informationRatio, 2)}
        valueColor={getMetricColor(
          performance.informationRatio,
          INFO_RATIO_GOOD_THRESHOLD
        )}
      />

      {/* Max Drawdown */}
      <MetricCard
        description="Максимальная просадка"
        icon={<TrendingDown className="h-4 w-4" />}
        title="Max Drawdown"
        tooltip="Чем меньше, тем лучше"
        value={formatMetric(performance.maxDrawdown, 2, "%")}
        valueColor={(() => {
          if (
            performance.maxDrawdown === null ||
            performance.maxDrawdown === undefined ||
            Number.isNaN(performance.maxDrawdown)
          ) {
            return "text-muted-foreground";
          }
          if (performance.maxDrawdown > DRAWDOWN_WARNING_THRESHOLD)
            return "text-red-500";
          if (performance.maxDrawdown > DRAWDOWN_GOOD_THRESHOLD)
            return "text-yellow-500";
          return "text-green-500";
        })()}
      />

      {/* Ulcer Index */}
      <MetricCard
        description="Глубина и длительность просадок"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Ulcer Index"
        tooltip="Чем меньше, тем лучше"
        value={formatMetric(performance.ulcerIndex, 2)}
        valueColor={(() => {
          if (
            performance.ulcerIndex === null ||
            performance.ulcerIndex === undefined ||
            Number.isNaN(performance.ulcerIndex)
          ) {
            return "text-muted-foreground";
          }
          if (performance.ulcerIndex > ULCER_WARNING_THRESHOLD)
            return "text-red-500";
          if (performance.ulcerIndex > ULCER_GOOD_THRESHOLD)
            return "text-yellow-500";
          return "text-green-500";
        })()}
      />

      {/* Win Rate */}
      <MetricCard
        description="Процент прибыльных сделок"
        icon={<BarChart3 className="h-4 w-4" />}
        title="Win Rate"
        tooltip=">50% хорошо, >60% отлично"
        value={formatMetric(trading.winRate, 1, "%")}
        valueColor={(() => {
          if (
            trading.winRate === null ||
            trading.winRate === undefined ||
            Number.isNaN(trading.winRate)
          ) {
            return "text-muted-foreground";
          }
          if (trading.winRate >= WIN_RATE_EXCELLENT_THRESHOLD)
            return "text-green-500";
          if (trading.winRate >= WIN_RATE_GOOD_THRESHOLD)
            return "text-yellow-500";
          return "text-red-500";
        })()}
      />

      {/* Profit Factor */}
      <MetricCard
        description="Отношение прибыли к убыткам"
        icon={<Target className="h-4 w-4" />}
        title="Profit Factor"
        tooltip=">2 отлично, >1.5 хорошо"
        value={formatMetric(trading.profitFactor, 2)}
        valueColor={(() => {
          if (
            trading.profitFactor === null ||
            trading.profitFactor === undefined ||
            Number.isNaN(trading.profitFactor)
          ) {
            return "text-muted-foreground";
          }
          if (trading.profitFactor >= PROFIT_FACTOR_EXCELLENT_THRESHOLD)
            return "text-green-500";
          if (trading.profitFactor >= PROFIT_FACTOR_GOOD_THRESHOLD)
            return "text-yellow-500";
          return "text-red-500";
        })()}
      />

      {/* Total Trades */}
      <MetricCard
        description="Всего сделок"
        icon={<Activity className="h-4 w-4" />}
        title="Всего сделок"
        tooltip={`Выигрышных: ${trading.winningTrades ?? 0}, Убыточных: ${trading.losingTrades ?? 0}`}
        value={(trading.totalTrades ?? 0).toString()}
        valueColor="text-muted-foreground"
      />
    </div>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  tooltip: string;
  valueColor?: string;
};

function MetricCard({
  title,
  value,
  description,
  icon,
  tooltip,
  valueColor = "text-foreground",
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <CardTitle className="cursor-help font-medium text-sm">
                {title}
              </CardTitle>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={`font-bold text-2xl ${valueColor}`}>{value}</div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </CardContent>
    </Card>
  );
}
