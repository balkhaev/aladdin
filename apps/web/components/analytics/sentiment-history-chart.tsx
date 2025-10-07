/**
 * Sentiment History Chart Component
 * Displays historical sentiment scores using lightweight-charts
 */

import {
  AreaSeries,
  createChart,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
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
import { useSentimentHistory } from "@/hooks/use-social-sentiment";
import {
  deduplicateTimeSeriesData,
  useChartInitialization,
} from "@/lib/chart-init";

const CHART_HEIGHT = 300;

type PeriodOption = "7" | "30" | "90";

type SentimentHistoryChartProps = {
  symbol: string;
};

export const SentimentHistoryChart = memo(
  function SentimentHistoryChartComponent({
    symbol,
  }: SentimentHistoryChartProps) {
    const [period, setPeriod] = useState<PeriodOption>("30");
    const { data, isLoading, error } = useSentimentHistory(symbol);
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

        // Create area series with gradient from red (negative) to green (positive)
        const series = chart.addSeries(AreaSeries, {
          topColor: "rgba(34, 197, 94, 0.4)",
          bottomColor: "rgba(239, 68, 68, 0.1)",
          lineColor: "rgba(34, 197, 94, 0.8)",
          lineWidth: 2,
        });

        // Add sentiment zones (assuming score range is -1 to 1)
        series.createPriceLine({
          price: 0.3,
          color: "#22c55e",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Бычий",
        });

        series.createPriceLine({
          price: 0,
          color: "#eab308",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Нейтральный",
        });

        series.createPriceLine({
          price: -0.3,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Медвежий",
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

      // Convert sentiment history to chart format
      // Assuming data is an array of sentiment scores with timestamps
      const chartData = Array.isArray(data)
        ? deduplicateTimeSeriesData(
            data.map((score, index) => ({
              time: Math.floor(
                (Date.now() - (data.length - index) * 3_600_000) / 1000
              ) as UTCTimestamp,
              value: score,
            }))
          ).map((d) => ({ ...d, time: d.time as UTCTimestamp }))
        : [];

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
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              История Настроений
            </CardTitle>
            <CardDescription>
              Исторические тренды настроений для {symbol}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full animate-pulse" />
          </CardContent>
        </Card>
      );
    }

    if (error || !data) {
      return (
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              История Настроений
            </CardTitle>
            <CardDescription>
              Исторические тренды настроений для {symbol}
            </CardDescription>
          </CardHeader>
          <CardContent className="py-8 text-center text-muted-foreground">
            Не удалось загрузить исторические данные
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                История Настроений
              </CardTitle>
              <CardDescription>
                Изменение настроений за период для {symbol}
              </CardDescription>
            </div>
            <Select onValueChange={handlePeriodChange} value={period}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="30">30 дней</SelectItem>
                <SelectItem value="90">90 дней</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-[300px] w-full" ref={chartContainerRef} />
        </CardContent>
      </Card>
    );
  }
);
