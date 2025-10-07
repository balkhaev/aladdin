/**
 * Backtest Chart
 * Visualize predicted vs actual prices from backtesting
 */

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { createChart, LineSeries } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { BacktestPrediction } from "../../lib/api/ml";

type BacktestChartProps = {
  predictions: BacktestPrediction[];
  height?: number;
};

const CHART_HEIGHT_DEFAULT = 400;
const MILLISECONDS_TO_SECONDS = 1000;
const MAX_INIT_ATTEMPTS = 10;
const INIT_RETRY_DELAY_MS = 100;
const FALLBACK_CHART_WIDTH = 800;

export function BacktestChart({
  predictions,
  height = CHART_HEIGHT_DEFAULT,
}: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const actualSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const predictedSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const initChart = () => {
      if (!chartContainerRef.current) return;

      const containerWidth = chartContainerRef.current.clientWidth;

      // Check if container has width
      if (containerWidth === 0 && attempts < MAX_INIT_ATTEMPTS) {
        attempts++;
        timeoutId = setTimeout(initChart, INIT_RETRY_DELAY_MS);
        return;
      }

      const finalWidth = containerWidth || FALLBACK_CHART_WIDTH;

      // Create chart
      const chart = createChart(chartContainerRef.current, {
        width: finalWidth,
        height,
        layout: {
          background: { color: "transparent" },
          textColor: "rgba(255, 255, 255, 0.7)",
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.06)" },
          horzLines: { color: "rgba(255, 255, 255, 0.06)" },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: "rgba(138, 119, 255, 0.3)",
            width: 1,
            style: 0,
          },
          horzLine: {
            color: "rgba(138, 119, 255, 0.3)",
            width: 1,
            style: 0,
          },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Add actual price series
      const actualSeries = chart.addSeries(LineSeries, {
        color: "#10b981",
        lineWidth: 2,
        title: "Actual Price",
      });

      // Add predicted price series
      const predictedSeries = chart.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
        lineStyle: 2, // Dashed
        title: "Predicted Price",
      });

      chartRef.current = chart;
      actualSeriesRef.current = actualSeries;
      predictedSeriesRef.current = predictedSeries;

      // Handle resize
      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          const width = chartContainerRef.current.clientWidth;
          if (width > 0) {
            chart.applyOptions({ width });
          }
        }
      };

      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(chartContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        actualSeriesRef.current = null;
        predictedSeriesRef.current = null;
      };
    };

    const cleanup = initChart();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (cleanup) cleanup();
    };
  }, [height]);

  // Update data
  useEffect(() => {
    if (
      !(
        actualSeriesRef.current &&
        predictedSeriesRef.current &&
        chartRef.current
      )
    )
      return;

    if (predictions.length === 0) return;

    // Convert to chart format
    const actualData = predictions.map((p) => ({
      time: Math.floor(p.timestamp / MILLISECONDS_TO_SECONDS) as never,
      value: p.actual,
    }));

    const predictedData = predictions.map((p) => ({
      time: Math.floor(p.timestamp / MILLISECONDS_TO_SECONDS) as never,
      value: p.predicted,
    }));

    // Sort by time
    actualData.sort((a, b) => (a.time as number) - (b.time as number));
    predictedData.sort((a, b) => (a.time as number) - (b.time as number));

    // Set data
    actualSeriesRef.current.setData(actualData);
    predictedSeriesRef.current.setData(predictedData);

    // Fit content
    chartRef.current.timeScale().fitContent();
  }, [predictions]);

  return (
    <div className="w-full">
      <div className="w-full" ref={chartContainerRef} />
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 bg-green-500" />
          <span className="text-slate-400">Actual Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-0.5 w-4 border-t-2 border-dashed bg-blue-500" />
          <span className="text-slate-400">Predicted Price</span>
        </div>
      </div>
    </div>
  );
}
