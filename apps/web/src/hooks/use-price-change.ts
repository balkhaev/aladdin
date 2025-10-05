/**
 * Price change tracking hook
 * Tracks price changes and provides formatted output
 */

import { useEffect, useMemo, useRef } from "react";

type PriceChangeResult = {
  change: number;
  changePercent: number;
  isPositive: boolean;
  isNegative: boolean;
  isNeutral: boolean;
};

/**
 * Track price changes over time
 */
export function usePriceChange(
  currentPrice: number | null | undefined
): PriceChangeResult {
  const previousPriceRef = useRef<number | null>(null);
  const changeRef = useRef<number>(0);

  useEffect(() => {
    if (
      currentPrice !== null &&
      currentPrice !== undefined &&
      !Number.isNaN(currentPrice)
    ) {
      if (
        previousPriceRef.current !== null &&
        previousPriceRef.current !== undefined
      ) {
        changeRef.current = currentPrice - previousPriceRef.current;
      }
      previousPriceRef.current = currentPrice;
    }
  }, [currentPrice]);

  return useMemo(() => {
    const change = changeRef.current;
    const changePercent =
      previousPriceRef.current && previousPriceRef.current !== 0
        ? (change / previousPriceRef.current) * 100
        : 0;

    return {
      change,
      changePercent,
      isPositive: change > 0,
      isNegative: change < 0,
      isNeutral: change === 0,
    };
  }, []);
}

/**
 * Calculate price change between two values
 */
export function calculatePriceChange(
  current: number | null | undefined,
  previous: number | null | undefined
): PriceChangeResult {
  if (
    current === null ||
    current === undefined ||
    Number.isNaN(current) ||
    previous === null ||
    previous === undefined ||
    Number.isNaN(previous)
  ) {
    return {
      change: 0,
      changePercent: 0,
      isPositive: false,
      isNegative: false,
      isNeutral: true,
    };
  }

  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  return {
    change,
    changePercent,
    isPositive: change > 0,
    isNegative: change < 0,
    isNeutral: change === 0,
  };
}
