/**
 * Formatting utilities
 * Centralized formatting logic for prices, volumes, percentages, etc.
 */

const DEFAULT_PRICE_DECIMALS = 2;
const MAX_PRICE_DECIMALS = 8;
const DEFAULT_VOLUME_DECIMALS = 2;
const MAX_VOLUME_DECIMALS = 8;
const DEFAULT_PERCENT_DECIMALS = 2;

const MILLION = 1_000_000;
const BILLION = 1_000_000_000;
const TRILLION = 1_000_000_000_000;

/**
 * Format a price with locale and appropriate decimal places
 */
export function formatPrice(
  price: number | null | undefined,
  decimals: number = DEFAULT_PRICE_DECIMALS
): string {
  if (price === null || price === undefined || Number.isNaN(price)) {
    return "0.00";
  }

  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.min(decimals, MAX_PRICE_DECIMALS),
  });
}

/**
 * Format a score value with fixed decimal places
 */
export function formatScore(
  score: number | null | undefined,
  decimals: number = DEFAULT_PERCENT_DECIMALS
): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "0.00";
  }

  return score.toFixed(decimals);
}

/**
 * Format a volume with locale and appropriate decimal places
 */
export function formatVolume(
  volume: number | null | undefined,
  decimals: number = DEFAULT_VOLUME_DECIMALS
): string {
  if (volume === null || volume === undefined || Number.isNaN(volume)) {
    return "0.00";
  }

  return volume.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.min(decimals, MAX_VOLUME_DECIMALS),
  });
}

/**
 * Format a percentage value
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = DEFAULT_PERCENT_DECIMALS,
  includeSign = false
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0.00%";
  }

  const sign = includeSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a timestamp to locale time string
 */
export function formatTimestamp(
  timestamp: number | Date | null | undefined
): string {
  if (!timestamp) {
    return "";
  }

  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return date.toLocaleTimeString();
}

/**
 * Format a timestamp to locale date string
 */
export function formatDate(
  timestamp: number | Date | null | undefined
): string {
  if (!timestamp) {
    return "";
  }

  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString();
}

/**
 * Format a timestamp to locale date and time string
 */
export function formatDateTime(
  timestamp: number | Date | null | undefined
): string {
  if (!timestamp) {
    return "";
  }

  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return date.toLocaleString();
}

/**
 * Format market cap with abbreviated notation (K, M, B, T)
 */
export function formatMarketCap(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "$0";
  }

  if (value >= TRILLION) {
    return `$${(value / TRILLION).toFixed(2)}T`;
  }
  if (value >= BILLION) {
    return `$${(value / BILLION).toFixed(2)}B`;
  }
  if (value >= MILLION) {
    return `$${(value / MILLION).toFixed(2)}M`;
  }

  return `$${value.toFixed(2)}K`;
}

/**
 * Format a number with abbreviated notation (K, M, B, T)
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "0";
  }

  if (value >= TRILLION) {
    return `${(value / TRILLION).toFixed(2)}T`;
  }
  if (value >= BILLION) {
    return `${(value / BILLION).toFixed(2)}B`;
  }
  if (value >= MILLION) {
    return `${(value / MILLION).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K`;
  }

  return value.toFixed(2);
}

/**
 * Format quantity with appropriate decimal places
 */
export function formatQuantity(
  qty: number | null | undefined,
  decimals: number = DEFAULT_VOLUME_DECIMALS
): string {
  return formatVolume(qty, decimals);
}

/**
 * Get appropriate decimal places based on price magnitude
 */
export function getDecimalsForPrice(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 100) return 2;
  if (price >= 10) return 3;
  if (price >= 1) return 4;
  if (price >= 0.1) return 5;
  if (price >= 0.01) return 6;
  return 8;
}
