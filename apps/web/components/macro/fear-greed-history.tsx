/**
 * Fear & Greed History Chart Component
 * Исторический график индекса страха/жадности
 */

import { AreaSeries, createChart, type ISeriesApi } from "lightweight-charts";
import { TrendingUp } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFearGreedHistory } from "@/hooks/use-macro-data";
import {
  deduplicateTimeSeriesData,
  useChartInitialization,
} from "@/lib/chart-init";

const CHART_HEIGHT = 300;

type PeriodOption = "7" | "30" | "90" | "180" | "365";

export const FearGreedHistory = memo(function FearGreedHistoryComponent() {
  const [period, setPeriod] = useState<PeriodOption>("30");
  const { data, isLoading, error } = useFearGreedHistory(Number(period));
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  // Create chart initialization callback
  const createChartCallback = useCallback(
    (container: HTMLDivElement, width: number) => {
      const chart = createChart(container, {
        layout: {
          background: { color: "transparent" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        width,
        height: CHART_HEIGHT,
        timeScale: {
          borderColor: "#1f2937",
          timeVisible: true,
        },
        rightPriceScale: {
          borderColor: "#1f2937",
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
      });

      // Create area series
      const series = chart.addSeries(AreaSeries, {
        topColor: "rgba(34, 197, 94, 0.4)",
        bottomColor: "rgba(239, 68, 68, 0.0)",
        lineColor: "rgba(34, 197, 94, 0.8)",
        lineWidth: 2,
      });

      // Add price bands
      series.createPriceLine({
        price: 75,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Greed",
      });

      series.createPriceLine({
        price: 55,
        color: "#eab308",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Neutral",
      });

      series.createPriceLine({
        price: 25,
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Fear",
      });

      seriesRef.current = series;
      return chart;
    },
    []
  );

  // Initialize chart with universal hook
  const chartRef = useChartInitialization(
    chartContainerRef,
    createChartCallback,
    {
      dependencies: [data],
    }
  );

  // Update chart data when data changes
  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }
    if (!data) {
      return;
    }
    if (!chartRef.current) {
      return;
    }

    // Deduplicate and format data
    const chartData = deduplicateTimeSeriesData(data);

    if (chartData.length > 0) {
      seriesRef.current.setData(chartData);
      chartRef.current.timeScale().fitContent();
    }
  }, [data, chartRef]);

  const handlePeriodChange = useCallback((value: string) => {
    setPeriod(value as PeriodOption);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fear & Greed History
          </CardTitle>
          <CardDescription>
            Historical Fear & Greed Index trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fear & Greed History
          </CardTitle>
          <CardDescription>
            Historical Fear & Greed Index trends
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load historical data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Fear & Greed History
            </CardTitle>
            <CardDescription>
              Historical Fear & Greed Index trends
            </CardDescription>
          </div>
          <Select onValueChange={handlePeriodChange} value={period}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="90">90 Days</SelectItem>
              <SelectItem value="180">6 Months</SelectItem>
              <SelectItem value="365">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full" ref={chartContainerRef} />
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span>0-25: Extreme Fear</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span>25-55: Neutral</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>55-100: Greed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
