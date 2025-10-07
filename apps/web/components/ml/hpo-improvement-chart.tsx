/**
 * HPO Improvement Chart
 * Visualize score improvement across trials
 */

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { createChart, LineSeries } from "lightweight-charts";
import { Download } from "lucide-react";
import { useEffect, useRef } from "react";
import type { OptimizationResult } from "../../lib/api/ml";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type HPOImprovementChartProps = {
  result: OptimizationResult;
  height?: number;
};

const CHART_HEIGHT_DEFAULT = 300;

export function HPOImprovementChart({
  result,
  height = CHART_HEIGHT_DEFAULT,
}: HPOImprovementChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bestLineRef = useRef<ISeriesApi<"Line"> | null>(null);

  const { trials, config } = result;

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Line"> | null = null;
    let bestLine: ISeriesApi<"Line"> | null = null;

    const initChart = () => {
      if (chart || container.clientWidth === 0) return;

      chart = createChart(container, {
        width: container.clientWidth,
        height,
        layout: {
          background: { color: "transparent" },
          textColor: "rgba(255, 255, 255, 0.7)",
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.06)" },
          horzLines: { color: "rgba(255, 255, 255, 0.06)" },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          visible: false,
        },
      });

      // Trial scores line
      series = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
        title: "Trial Score",
      });

      // Best score so far line
      bestLine = chart.addSeries(LineSeries, {
        color: "#10b981",
        lineWidth: 2,
        lineStyle: 2,
        title: "Best So Far",
      });

      chartRef.current = chart;
      seriesRef.current = series;
      bestLineRef.current = bestLine;

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        if (container && chart) {
          const width = container.clientWidth;
          if (width > 0) {
            chart.applyOptions({ width });
          }
        }
      });
      resizeObserver.observe(container);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
        bestLineRef.current = null;
      };
    };

    const cleanup = initChart();
    return cleanup;
  }, [height]);

  // Update data
  useEffect(() => {
    if (!(seriesRef.current && bestLineRef.current && chartRef.current)) return;
    if (trials.length === 0) return;

    const lowerIsBetter =
      config.optimizationMetric === "mae" ||
      config.optimizationMetric === "rmse" ||
      config.optimizationMetric === "mape";

    // Trial scores
    const trialData = trials.map((trial) => ({
      time: trial.trialId as never,
      value: trial.score,
    }));

    // Best score so far
    let bestSoFar = trials[0].score;
    const bestData = trials.map((trial) => {
      if (lowerIsBetter) {
        bestSoFar = Math.min(bestSoFar, trial.score);
      } else {
        bestSoFar = Math.max(bestSoFar, trial.score);
      }
      return {
        time: trial.trialId as never,
        value: bestSoFar,
      };
    });

    seriesRef.current.setData(trialData);
    bestLineRef.current.setData(bestData);
    chartRef.current.timeScale().fitContent();
  }, [trials, config.optimizationMetric]);

  // Export chart as PNG
  const handleExportChart = () => {
    if (!chartRef.current) return;

    const canvas = chartContainerRef.current?.querySelector("canvas");
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().split("T")[0];
      link.download = `hpo_chart_${result.config.symbol}_${result.config.modelType}_${timestamp}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Optimization Progress</span>
          <Button onClick={handleExportChart} size="sm" variant="ghost">
            <Download className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full" ref={chartContainerRef} />
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-blue-500" />
            <span className="text-slate-400">Trial Score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 border-green-500 border-t-2 border-dashed" />
            <span className="text-slate-400">Best So Far</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
