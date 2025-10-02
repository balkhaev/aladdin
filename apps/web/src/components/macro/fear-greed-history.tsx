/**
 * Fear & Greed History Chart Component
 * Исторический график индекса страха/жадности
 */

import {
  AreaSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
} from "lightweight-charts";
import { TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

const CHART_HEIGHT = 300;
const MILLISECONDS_TO_SECONDS = 1000;
const INIT_DELAY_MS = 100;

type PeriodOption = "7" | "30" | "90" | "180" | "365";

export function FearGreedHistory() {
  const [period, setPeriod] = useState<PeriodOption>("30");
  const { data, isLoading, error } = useFearGreedHistory(Number(period));
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Area"> | null = null;

    const initializeChart = () => {
      // Don't initialize if already initialized or container not visible
      if (chart || container.clientWidth === 0) return;

      // Create chart
      chart = createChart(container, {
        layout: {
          background: { color: "transparent" },
          textColor: "#9ca3af",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        width: container.clientWidth,
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
      series = chart.addSeries(AreaSeries, {
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

      chartRef.current = chart;
      seriesRef.current = series;
    };

    // Handle resize
    const handleResize = () => {
      // Initialize chart if not yet initialized and container is now visible
      if (!chart && container.clientWidth > 0) {
        initializeChart();
      }

      if (container && chart) {
        const width = container.clientWidth;
        if (width > 0) {
          chart.applyOptions({ width });
        }
      }
    };

    // Use MutationObserver to detect when tab becomes visible (handles display:none cases)
    const mutationObserver = new MutationObserver(() => {
      // Check if container is now visible
      if (!chart && container.offsetWidth > 0 && container.offsetHeight > 0) {
        initializeChart();
      }
    });

    // Observe parent elements for attribute changes
    let parent = container.parentElement;
    while (parent) {
      mutationObserver.observe(parent, {
        attributes: true,
        attributeFilter: ["data-state", "hidden", "aria-hidden", "style"],
      });
      parent = parent.parentElement;
      // Stop at a reasonable depth
      if (parent?.getAttribute("role") === "tabpanel") break;
    }

    // Use IntersectionObserver to detect when container becomes visible
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !chart) {
            initializeChart();
          }
        }
      },
      { threshold: 0.1 }
    );

    intersectionObserver.observe(container);

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(container);

    // Also listen to window resize
    window.addEventListener("resize", handleResize);

    // Try initial initialization
    initializeChart();

    // If still not initialized after a short delay, try again (fallback)
    const timeoutId = setTimeout(() => {
      if (!chart && container.offsetWidth > 0) {
        initializeChart();
      }
    }, INIT_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
      mutationObserver.disconnect();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (chart) {
        chart.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!(seriesRef.current && data)) return;

    // Deduplicate by timestamp and ensure ascending order
    const dataMap = new Map<number, number>();

    for (const point of data) {
      const timestamp =
        typeof point.time === "string"
          ? Math.floor(new Date(point.time).getTime() / MILLISECONDS_TO_SECONDS)
          : point.time;
      // If duplicate timestamp, keep the last value
      dataMap.set(timestamp, point.value);
    }

    // Convert to array and sort by time ascending
    const chartData: LineData[] = Array.from(dataMap.entries())
      .map(([time, value]) => ({
        time: time as LineData["time"],
        value,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    if (chartData.length > 0) {
      seriesRef.current.setData(chartData);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

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
          <Select
            onValueChange={(v) => setPeriod(v as PeriodOption)}
            value={period}
          >
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
}
