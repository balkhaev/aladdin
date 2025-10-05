/**
 * Sentiment color hook
 * Provides consistent color mapping for sentiment scores
 */

import { useMemo } from "react";

const DEFAULT_THRESHOLD = 0.3;

type SentimentColorOptions = {
  threshold?: number;
  neutralColor?: string;
  positiveColor?: string;
  negativeColor?: string;
};

/**
 * Get Tailwind CSS color class based on sentiment score
 */
export function useSentimentColor(
  score: number | null | undefined,
  options: SentimentColorOptions = {}
): string {
  const {
    threshold = DEFAULT_THRESHOLD,
    neutralColor = "text-gray-500",
    positiveColor = "text-green-500",
    negativeColor = "text-red-500",
  } = options;

  return useMemo(() => {
    if (score === null || score === undefined || Number.isNaN(score)) {
      return neutralColor;
    }

    if (score > threshold) return positiveColor;
    if (score < -threshold) return negativeColor;
    return neutralColor;
  }, [score, threshold, neutralColor, positiveColor, negativeColor]);
}

/**
 * Get sentiment color class (pure function, not a hook)
 */
export function getSentimentColor(
  score: number | null | undefined,
  threshold: number = DEFAULT_THRESHOLD
): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "text-gray-500";
  }

  if (score > threshold) return "text-green-500";
  if (score < -threshold) return "text-red-500";
  return "text-gray-500";
}

/**
 * Get price change color class
 */
export function getPriceChangeColor(change: number | null | undefined): string {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return "text-gray-500";
  }

  if (change > 0) return "text-green-500";
  if (change < 0) return "text-red-500";
  return "text-gray-500";
}

