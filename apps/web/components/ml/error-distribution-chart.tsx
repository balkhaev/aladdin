/**
 * Error Distribution Chart
 * Histogram showing error distribution from backtesting
 */

import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { createChart, HistogramSeries } from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { BacktestPrediction } from "../../lib/api/ml";

type ErrorDistributionChartProps = {
  predictions: BacktestPrediction[];
  height?: number;
};

const CHART_HEIGHT_DEFAULT = 300;
const NUM_BINS = 50;

export function ErrorDistributionChart({
  predictions,
  height = CHART_HEIGHT_DEFAULT,
}: ErrorDistributionChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    let chart: IChartApi | null = null;
    let series: ISeriesApi<"Histogram"> | null = null;

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

      series = chart.addSeries(HistogramSeries, {
        color: "#3b82f6",
        priceFormat: {
          type: "volume",
        },
      });

      chartRef.current = chart;
      seriesRef.current = series;

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
        if (chart) {
          chart.remove();
        }
        chartRef.current = null;
        seriesRef.current = null;
      };
    };

    const cleanup = initChart();
    return cleanup;
  }, [height]);

  // Update data
  useEffect(() => {
    if (!(seriesRef.current && chartRef.current)) return;
    if (predictions.length === 0) return;

    // Calculate histogram
    const errors = predictions.map((p) => p.error);
    const minError = Math.min(...errors);
    const maxError = Math.max(...errors);
    const binSize = (maxError - minError) / NUM_BINS;

    // Create bins
    const bins = new Map<number, number>();
    for (let i = 0; i < NUM_BINS; i++) {
      bins.set(i, 0);
    }

    // Fill bins
    for (const error of errors) {
      const binIndex = Math.min(
        Math.floor((error - minError) / binSize),
        NUM_BINS - 1
      );
      bins.set(binIndex, (bins.get(binIndex) || 0) + 1);
    }

    // Convert to chart format
    const histogramData = Array.from(bins.entries()).map(
      ([binIndex, count]) => {
        const binValue = minError + binIndex * binSize;
        return {
          time: binIndex as never,
          value: count,
          color: binValue < 0 ? "#ef4444" : "#10b981",
        };
      }
    );

    seriesRef.current.setData(histogramData);
    chartRef.current.timeScale().fitContent();
  }, [predictions]);

  return (
    <div className="w-full">
      <div className="w-full" ref={chartContainerRef} />
      <div className="mt-2 text-center text-slate-400 text-sm">
        Error Distribution (negative = underestimation, positive =
        overestimation)
      </div>
    </div>
  );
}
