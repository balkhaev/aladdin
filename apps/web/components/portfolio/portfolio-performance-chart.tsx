/**
 * Portfolio Performance Chart Component
 * Displays P&L timeline using lightweight-charts
 */

import {
  AreaSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
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
import { usePortfolioPerformance } from "@/hooks/use-portfolio";

const CHART_HEIGHT = 350;
const MILLISECONDS_TO_SECONDS = 1000;
const INIT_DELAY_MS = 100;

type PeriodOption = "7" | "30" | "90" | "365";

type PortfolioPerformanceChartProps = {
  portfolioId: string;
};

export function PortfolioPerformanceChart({
  portfolioId,
}: PortfolioPerformanceChartProps) {
  const [period, setPeriod] = useState<PeriodOption>("30");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data: performance, isLoading } = usePortfolioPerformance(portfolioId);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Area"> | null = null;

    const initializeChart = () => {
      // Don't initialize if already initialized or container not visible
      if (chart || container.clientWidth === 0) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height: CHART_HEIGHT,
        layout: {
          background: { color: "transparent" },
          textColor: "#d1d5db",
        },
        grid: {
          vertLines: { color: "#334155" },
          horzLines: { color: "#334155" },
        },
        timeScale: {
          borderColor: "#334155",
          timeVisible: true,
        },
        rightPriceScale: {
          borderColor: "#334155",
        },
      });

      series = chart.addSeries(AreaSeries, {
        lineColor: "#10b981",
        topColor: "rgba(16, 185, 129, 0.4)",
        bottomColor: "rgba(16, 185, 129, 0.0)",
        lineWidth: 2,
      });

      chartRef.current = chart;
      seriesRef.current = series;
    };

    // Handle resize with ResizeObserver for better detection of visibility changes
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

    // Observe parent elements for attribute changes (like data-state or hidden)
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

    // Try initial initialization (will work if container is already visible)
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

  // Update chart data
  useEffect(() => {
    // If we have performance data but no chart, try to initialize
    if (performance && !chartRef.current && chartContainerRef.current) {
      const container = chartContainerRef.current;
      if (container.offsetWidth > 0) {
        console.log(
          "[PortfolioPerformanceChart] Chart not initialized but data available, forcing initialization"
        );
        // Chart should have been initialized by the other effect, but force it if needed
        const chart = createChart(container, {
          width: container.offsetWidth,
          height: CHART_HEIGHT,
          layout: {
            background: { color: "transparent" },
            textColor: "#d1d5db",
          },
          grid: {
            vertLines: { color: "#334155" },
            horzLines: { color: "#334155" },
          },
          timeScale: {
            borderColor: "#334155",
            timeVisible: true,
          },
          rightPriceScale: {
            borderColor: "#334155",
          },
        });

        const series = chart.addSeries(AreaSeries, {
          lineColor: "#10b981",
          topColor: "rgba(16, 185, 129, 0.4)",
          bottomColor: "rgba(16, 185, 129, 0.0)",
          lineWidth: 2,
        });

        chartRef.current = chart;
        seriesRef.current = series;
      }
    }

    if (!(performance && seriesRef.current)) return;

    // Use real snapshot data from API
    if (performance.snapshots && performance.snapshots.length > 0) {
      // Convert to LineData and deduplicate by timestamp
      const dataMap = new Map<number, number>();

      for (const snapshot of performance.snapshots) {
        const timestamp = Math.floor(
          new Date(snapshot.timestamp).getTime() / MILLISECONDS_TO_SECONDS
        );
        // If duplicate timestamp, keep the last value
        dataMap.set(timestamp, snapshot.pnl);
      }

      // Convert to array and sort by time ascending
      const data: LineData[] = Array.from(dataMap.entries())
        .map(([time, value]) => ({
          time: time as UTCTimestamp,
          value,
        }))
        .sort((a, b) => a.time - b.time);

      if (data.length > 0) {
        seriesRef.current.setData(data);
      }
    } else {
      // Fallback: show current total P&L as single point
      const now = Math.floor(Date.now() / MILLISECONDS_TO_SECONDS);
      seriesRef.current.setData([
        {
          time: now as UTCTimestamp,
          value: performance.totalPnl,
        },
      ]);
    }

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [performance]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Производительность
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px]" />
        </CardContent>
      </Card>
    );
  }

  if (!performance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Производительность
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Данные недоступны</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Производительность
            </CardTitle>
            <CardDescription className="mt-1">
              P&L за выбранный период
            </CardDescription>
          </div>
          <Select
            onValueChange={(v) => setPeriod(v as PeriodOption)}
            value={period}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 дней</SelectItem>
              <SelectItem value="30">30 дней</SelectItem>
              <SelectItem value="90">90 дней</SelectItem>
              <SelectItem value="365">1 год</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]" ref={chartContainerRef} />
      </CardContent>
    </Card>
  );
}
