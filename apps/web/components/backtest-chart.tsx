/**
 * Backtest Chart Component
 * Candlestick chart with trade markers for backtesting results
 */

import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineStyle,
  SeriesMarker,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
} from "lightweight-charts";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BacktestTrade } from "../lib/api/backtest";
import type { Candle } from "../lib/api/market-data";
import Loader from "./loader";

type BacktestChartProps = {
  candles: Candle[];
  trades: BacktestTrade[];
  height?: number;
  symbol: string;
};

const CHART_HEIGHT_DEFAULT = 400;
const MILLISECONDS_TO_SECONDS = 1000;
const INIT_RETRY_DELAY_MS = 50;
const FALLBACK_CHART_WIDTH = 800;
const MAX_INIT_ATTEMPTS = 10;
const MILLISECONDS_THRESHOLD = 10_000_000_000;
const INIT_DELAY_MS = 10;

export function BacktestChart({
  candles,
  trades,
  height = CHART_HEIGHT_DEFAULT,
  symbol,
}: BacktestChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);

  // Helper function to convert timestamp to Unix timestamp in seconds
  const convertTimestamp = useCallback((ts: number | string | Date): number => {
    if (ts instanceof Date) {
      return Math.floor(ts.getTime() / MILLISECONDS_TO_SECONDS);
    }
    if (typeof ts === "string") {
      return Math.floor(new Date(ts).getTime() / MILLISECONDS_TO_SECONDS);
    }
    // Если уже число, проверяем, не в миллисекундах ли оно
    if (ts > MILLISECONDS_THRESHOLD) {
      return Math.floor(ts / MILLISECONDS_TO_SECONDS);
    }
    return ts;
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const initChart = () => {
      if (!chartContainerRef.current) return;

      const containerWidth = chartContainerRef.current.clientWidth;

      // Проверяем, что контейнер имеет ширину
      if (containerWidth === 0 && attempts < MAX_INIT_ATTEMPTS) {
        attempts++;
        timeoutId = setTimeout(initChart, INIT_RETRY_DELAY_MS);
        return;
      }

      // Если так и не получили размеры, используем fallback
      const finalWidth = containerWidth || FALLBACK_CHART_WIDTH;

      // Create chart with modern dark theme
      const chart = createChart(chartContainerRef.current, {
        width: finalWidth,
        height,
        layout: {
          background: { color: "transparent" },
          textColor: "rgba(255, 255, 255, 0.7)",
        },
        grid: {
          vertLines: {
            color: "rgba(255, 255, 255, 0.06)",
            style: 1 as LineStyle,
          },
          horzLines: {
            color: "rgba(255, 255, 255, 0.06)",
            style: 1 as LineStyle,
          },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: "rgba(138, 119, 255, 0.3)",
            width: 1,
            style: 0 as LineStyle,
          },
          horzLine: {
            color: "rgba(138, 119, 255, 0.3)",
            width: 1,
            style: 0 as LineStyle,
          },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          scaleMargins: {
            top: 0.1,
            bottom: 0.2,
          },
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.1)",
          timeVisible: true,
          secondsVisible: false,
        },
      });

      // Add candlestick series with vibrant colors
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderVisible: false,
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      // Add volume histogram
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: "rgba(138, 119, 255, 0.5)",
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "",
      });

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      // Create markers plugin for the candlestick series
      const markersPlugin = createSeriesMarkers(candleSeries);

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
      markersPluginRef.current = markersPlugin;
      setIsChartReady(true);

      // Handle resize with ResizeObserver for better detection of visibility changes
      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          const width = chartContainerRef.current.clientWidth;
          if (width > 0) {
            chart.applyOptions({ width });
          }
        }
      };

      // Use ResizeObserver to detect container size changes (including when tab becomes visible)
      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });

      resizeObserver.observe(chartContainerRef.current);

      // Also listen to window resize
      window.addEventListener("resize", handleResize);

      // Initial resize
      handleResize();

      // Store cleanup function in ref
      cleanupRef.current = () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", handleResize);
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
        markersPluginRef.current = null;
        setIsChartReady(false);
      };
    };

    // Start initialization with a small delay to ensure DOM is ready
    timeoutId = setTimeout(initChart, INIT_DELAY_MS);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanupRef.current?.();
    };
  }, [height]);

  // Update chart data when candles change
  useEffect(() => {
    const hasNoCandles = !candles?.length;
    if (hasNoCandles) {
      return;
    }
    if (!isChartReady) {
      return;
    }
    if (!candleSeriesRef.current) return;
    if (!volumeSeriesRef.current) return;

    // Удаляем дубликаты и сортируем по времени
    const uniqueCandles = Array.from(
      new Map(candles.map((candle) => [candle.timestamp, candle])).values()
    ).sort((a, b) => {
      const aTime = convertTimestamp(a.timestamp);
      const bTime = convertTimestamp(b.timestamp);
      return aTime - bTime;
    });

    const candleData = uniqueCandles.map((candle) => ({
      time: convertTimestamp(candle.timestamp) as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const volumeData = uniqueCandles.map((candle) => ({
      time: convertTimestamp(candle.timestamp) as UTCTimestamp,
      value: candle.volume,
      color:
        candle.close >= candle.open
          ? "rgba(34, 197, 94, 0.4)"
          : "rgba(239, 68, 68, 0.4)",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Fit content to chart
    chartRef.current?.timeScale().fitContent();
  }, [candles, isChartReady, convertTimestamp]);

  // Add trade markers
  useEffect(() => {
    if (!isChartReady) return;
    if (!trades.length) return;
    if (!markersPluginRef.current) return;

    const markers: SeriesMarker<Time>[] = trades.map((trade) => ({
      time: convertTimestamp(trade.timestamp) as UTCTimestamp,
      position: trade.type === "BUY" ? "belowBar" : "aboveBar",
      color: trade.type === "BUY" ? "#22c55e" : "#ef4444",
      shape: trade.type === "BUY" ? "arrowUp" : "arrowDown",
      text: trade.type,
    }));

    markersPluginRef.current.setMarkers(markers);
  }, [trades, isChartReady, convertTimestamp]);

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-10 rounded-md bg-background/80 px-2 py-1 text-muted-foreground text-xs backdrop-blur-sm">
        {symbol}
      </div>
      <div
        className="w-full"
        ref={chartContainerRef}
        style={{ height: `${height}px` }}
      />
      {(() => {
        const hasNoCandles = !candles || candles.length === 0;
        const isLoading = !isChartReady || hasNoCandles;
        return (
          isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
              <Loader />
            </div>
          )
        );
      })()}
    </div>
  );
}
