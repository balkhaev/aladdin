/**
 * Trading Chart Component
 * Real-time candlestick chart using Lightweight Charts
 */

import type {
  IChartApi,
  ISeriesApi,
  LineStyle,
  UTCTimestamp,
} from "lightweight-charts";
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";
import { Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCandlesWS } from "../hooks/use-candles-ws";
import { useCandles } from "../hooks/use-market-data";
import { usePrediction } from "../hooks/use-ml-prediction";
import {
  calculateBollingerBands,
  calculateEMA,
  calculateSMA,
} from "../lib/indicators";
import type { Indicator } from "./indicator-controls";
import Loader from "./loader";

type TradingChartProps = {
  symbol: string;
  interval: "1m" | "5m" | "15m" | "1h" | "1d";
  height?: number;
  selectedIndicators: Indicator[];
  showMLPrediction?: boolean;
};

const CHART_HEIGHT_DEFAULT = 500;
const MILLISECONDS_TO_SECONDS = 1000;
const INIT_RETRY_DELAY_MS = 50;
const FALLBACK_CHART_WIDTH = 800;
const MAX_INIT_ATTEMPTS = 10;
const DEFAULT_CANDLES_LIMIT = 1000;
const MILLISECONDS_THRESHOLD = 10_000_000_000;

// Indicator periods
const EMA_FAST_PERIOD = 12;
const EMA_SLOW_PERIOD = 26;
const SMA_SHORT_PERIOD = 20;
const SMA_MEDIUM_PERIOD = 50;
const SMA_LONG_PERIOD = 200;
const BB_PERIOD = 20;
const BB_STD_DEV = 2;

export function TradingChart({
  symbol,
  interval,
  height = CHART_HEIGHT_DEFAULT,
  selectedIndicators,
  showMLPrediction = false,
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<
    Map<string, ReturnType<IChartApi["addSeries"]>>
  >(new Map());
  const mlPredictionSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [isChartReady, setIsChartReady] = useState(false);

  // Fetch initial candles data
  const candlesLimit = DEFAULT_CANDLES_LIMIT;
  const { data: candles, isLoading } = useCandles(
    symbol,
    interval,
    candlesLimit
  );

  // Флаг готовности для WebSocket: график готов И данные загружены
  const isReadyForWebSocket = isChartReady && candles && candles.length > 0;

  // WebSocket для real-time обновлений
  const { candle: realtimeCandle, isConnected: wsConnected } = useCandlesWS(
    symbol,
    interval,
    isReadyForWebSocket // Подключаем WebSocket только когда график готов И данные загружены
  );

  // ML Prediction
  const { data: mlPrediction } = usePrediction(symbol, "1h", showMLPrediction);

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
        // Пробуем еще раз через небольшую задержку
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

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;
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
        setIsChartReady(false);
      };
    };

    // Start initialization with a small delay to ensure DOM is ready
    timeoutId = setTimeout(initChart, 10);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      cleanupRef.current?.();
    };
  }, [height]);

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

  // Update chart data when candles change
  useEffect(() => {
    if (!candles?.length) {
      console.log("[TradingChart] No candles data available");
      return;
    }
    if (!isChartReady) {
      console.log("[TradingChart] Chart not ready yet");
      return;
    }
    if (!candleSeriesRef.current) return;
    if (!volumeSeriesRef.current) return;

    console.log(
      `[TradingChart] Loading ${candles.length} candles for ${symbol} ${interval}`
    );

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
  }, [candles, isChartReady, convertTimestamp, symbol, interval]);

  // Update chart with real-time candle data
  useEffect(() => {
    if (!realtimeCandle) return;
    if (!isChartReady) return;
    if (!candleSeriesRef.current) return;
    if (!volumeSeriesRef.current) return;

    try {
      const timestamp = convertTimestamp(realtimeCandle.timestamp);

      // Validate timestamp is a valid number
      if (typeof timestamp !== "number" || Number.isNaN(timestamp)) {
        console.error("[TradingChart] Invalid timestamp:", timestamp);
        return;
      }

      const candleData = {
        time: timestamp as UTCTimestamp,
        open: Number(realtimeCandle.open),
        high: Number(realtimeCandle.high),
        low: Number(realtimeCandle.low),
        close: Number(realtimeCandle.close),
      };

      const volumeData = {
        time: timestamp as UTCTimestamp,
        value: Number(realtimeCandle.volume),
        color:
          realtimeCandle.close >= realtimeCandle.open
            ? "rgba(34, 197, 94, 0.4)"
            : "rgba(239, 68, 68, 0.4)",
      };

      // Update the chart
      candleSeriesRef.current.update(candleData);
      volumeSeriesRef.current.update(volumeData);
    } catch (error) {
      console.error("[TradingChart] Error updating chart:", error);
    }
  }, [realtimeCandle, isChartReady, convertTimestamp]);

  // Add/remove indicators on chart when selection changes
  useEffect(() => {
    if (!(chartRef.current && isChartReady && candles && candles.length > 0))
      return;

    const chart = chartRef.current;
    const currentSeries = indicatorSeriesRef.current;

    // Remove indicators that are no longer selected
    for (const [key, series] of currentSeries.entries()) {
      const indicatorType = key.split("_")[0];
      if (!selectedIndicators.includes(indicatorType as Indicator)) {
        chart.removeSeries(series);
        currentSeries.delete(key);
      }
    }

    // Add EMA indicators
    if (selectedIndicators.includes("EMA")) {
      if (!currentSeries.has("EMA_12")) {
        const ema12Data = calculateEMA(candles, EMA_FAST_PERIOD);
        const ema12Series = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 2,
          title: "EMA 12",
        });
        ema12Series.setData(ema12Data);
        currentSeries.set("EMA_12", ema12Series);
      }
      if (!currentSeries.has("EMA_26")) {
        const ema26Data = calculateEMA(candles, EMA_SLOW_PERIOD);
        const ema26Series = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          title: "EMA 26",
        });
        ema26Series.setData(ema26Data);
        currentSeries.set("EMA_26", ema26Series);
      }
    }

    // Add SMA indicators
    if (selectedIndicators.includes("SMA")) {
      if (!currentSeries.has("SMA_20")) {
        const sma20Data = calculateSMA(candles, SMA_SHORT_PERIOD);
        const sma20Series = chart.addSeries(LineSeries, {
          color: "#10b981",
          lineWidth: 2,
          title: "SMA 20",
        });
        sma20Series.setData(sma20Data);
        currentSeries.set("SMA_20", sma20Series);
      }
      if (!currentSeries.has("SMA_50")) {
        const sma50Data = calculateSMA(candles, SMA_MEDIUM_PERIOD);
        const sma50Series = chart.addSeries(LineSeries, {
          color: "#6366f1",
          lineWidth: 2,
          title: "SMA 50",
        });
        sma50Series.setData(sma50Data);
        currentSeries.set("SMA_50", sma50Series);
      }
      if (!currentSeries.has("SMA_200")) {
        const sma200Data = calculateSMA(candles, SMA_LONG_PERIOD);
        const sma200Series = chart.addSeries(LineSeries, {
          color: "#ec4899",
          lineWidth: 2,
          title: "SMA 200",
        });
        sma200Series.setData(sma200Data);
        currentSeries.set("SMA_200", sma200Series);
      }
    }

    // Add Bollinger Bands indicators
    if (selectedIndicators.includes("BB")) {
      const bbData = calculateBollingerBands(candles, BB_PERIOD, BB_STD_DEV);

      if (!currentSeries.has("BB_UPPER")) {
        const bbUpperSeries = chart.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 1,
          title: "BB Upper",
        });
        bbUpperSeries.setData(bbData.upper);
        currentSeries.set("BB_UPPER", bbUpperSeries);
      }
      if (!currentSeries.has("BB_MIDDLE")) {
        const bbMiddleSeries = chart.addSeries(LineSeries, {
          color: "#a78bfa",
          lineWidth: 1,
          title: "BB Middle",
        });
        bbMiddleSeries.setData(bbData.middle);
        currentSeries.set("BB_MIDDLE", bbMiddleSeries);
      }
      if (!currentSeries.has("BB_LOWER")) {
        const bbLowerSeries = chart.addSeries(LineSeries, {
          color: "#8b5cf6",
          lineWidth: 1,
          title: "BB Lower",
        });
        bbLowerSeries.setData(bbData.lower);
        currentSeries.set("BB_LOWER", bbLowerSeries);
      }
    }
  }, [selectedIndicators, isChartReady, candles]);

  // Add/remove ML prediction line
  useEffect(() => {
    if (!chartRef.current) return;
    if (!isChartReady) return;
    if (!candles) return;
    if (candles.length === 0) return;

    const chart = chartRef.current;

    // Remove existing ML prediction series
    if (mlPredictionSeriesRef.current) {
      chart.removeSeries(mlPredictionSeriesRef.current);
      mlPredictionSeriesRef.current = null;
    }

    // Add ML prediction if enabled and available
    if (showMLPrediction && mlPrediction?.predictions?.[0]) {
      const prediction = mlPrediction.predictions[0];
      const lastCandle = candles.at(-1);
      const currentPrice = lastCandle?.close || 0;

      // Determine color based on direction
      const isPositive = prediction.predictedPrice > currentPrice;
      const color = isPositive ? "#22c55e" : "#ef4444";

      // Create price line marker at the predicted price level
      const mlSeries = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: 2, // Dashed line
        title: `ML: $${prediction.predictedPrice.toFixed(2)}`,
        priceLineVisible: true,
        lastValueVisible: true,
      });

      // Create horizontal line at prediction level
      // Use last candle time + 1 hour for future prediction
      const lastCandleTimestamp = candles.at(-1)?.timestamp;
      if (!lastCandleTimestamp) return;

      const lastCandleTime = convertTimestamp(lastCandleTimestamp);
      const futureTime = (lastCandleTime + 3600) as UTCTimestamp; // +1 hour

      mlSeries.setData([
        {
          time: lastCandleTime as UTCTimestamp,
          value: currentPrice,
        },
        {
          time: futureTime,
          value: prediction.predictedPrice,
        },
      ]);

      mlPredictionSeriesRef.current = mlSeries;
    }
  }, [showMLPrediction, mlPrediction, isChartReady, candles, convertTimestamp]);

  return (
    <div className="relative">
      {/* WebSocket connection indicator */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-muted-foreground text-xs backdrop-blur-sm">
        {wsConnected ? (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <span className="text-[10px]">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px]">Offline</span>
          </>
        )}
      </div>

      <div
        className="w-full"
        ref={chartContainerRef}
        style={{ height: `${height}px` }}
      />
      {(isLoading || !isChartReady || !candles || candles.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <Loader />
        </div>
      )}
    </div>
  );
}
