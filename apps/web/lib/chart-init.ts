/**
 * Chart initialization utilities
 * Universal chart initialization logic with observers for proper lifecycle
 */

import type { IChartApi } from "lightweight-charts";
import { type RefObject, useEffect, useRef } from "react";
import { logger } from "./logger";

const INIT_DELAY_MS = 100;

type ChartInitOptions = {
  onInit?: (chart: IChartApi) => void;
  onResize?: (chart: IChartApi, width: number) => void;
  dependencies?: unknown[];
};

/**
 * Universal hook for chart initialization with proper lifecycle management
 * Handles visibility detection, resize, and cleanup
 */
export function useChartInitialization(
  containerRef: RefObject<HTMLDivElement>,
  createChart: (container: HTMLDivElement, width: number) => IChartApi | null,
  options: ChartInitOptions = {}
): RefObject<IChartApi | null> {
  const chartRef = useRef<IChartApi | null>(null);
  const { onInit, onResize, dependencies = [] } = options;

  // Refs for stable callbacks
  const createChartRef = useRef(createChart);
  const onInitRef = useRef(onInit);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    createChartRef.current = createChart;
    onInitRef.current = onInit;
    onResizeRef.current = onResize;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let chart: IChartApi | null = null;

    const initializeChart = () => {
      // Don't initialize if already initialized or container not visible
      if (chart || container.clientWidth === 0 || container.offsetWidth === 0) {
        return;
      }

      try {
        logger.info("Chart", "Initializing chart", {
          width: container.clientWidth,
        });
        chart = createChartRef.current(container, container.clientWidth);

        if (chart) {
          chartRef.current = chart;
          onInitRef.current?.(chart);
        }
      } catch (error) {
        logger.error("Chart", "Failed to initialize chart", error);
      }
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
          onResizeRef.current?.(chart, width);
        }
      }
    };

    // Use MutationObserver to detect when tab becomes visible
    const mutationObserver = new MutationObserver(() => {
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
        chartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- containerRef.current is intentionally not in deps
  }, [containerRef, ...dependencies]);

  return chartRef;
}

/**
 * Deduplicate time series data by timestamp
 * Ensures data is sorted in ascending order
 */
export function deduplicateTimeSeriesData<
  T extends { time: number | string; value: number },
>(
  data: T[],
  millisecondsToSeconds = 1000
): Array<{ time: number; value: number }> {
  const dataMap = new Map<number, number>();

  for (const point of data) {
    let timestamp = 0;

    if (typeof point.time === "string") {
      timestamp = Math.floor(
        new Date(point.time).getTime() / millisecondsToSeconds
      );
    } else if (typeof point.time === "number") {
      timestamp = Math.floor(point.time);
    }

    // If duplicate timestamp, keep the last value
    dataMap.set(timestamp, point.value);
  }

  // Convert to array and sort by time ascending
  return Array.from(dataMap.entries())
    .map(([time, value]) => ({ time, value }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Check if container is visible
 */
export function isContainerVisible(container: HTMLElement | null): boolean {
  if (!container) return false;
  return container.offsetWidth > 0 && container.clientWidth > 0;
}
