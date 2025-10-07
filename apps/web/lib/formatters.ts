/**
 * Utility functions for formatting numbers, currency, and other values
 * Centralized formatters to reduce code duplication across components
 */

const THOUSAND = 1000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;
const TRILLION = 1_000_000_000_000;

/**
 * Format a number as currency with specified locale and currency code
 * @param value - Number to format
 * @param currency - Currency code (default: 'USD')
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  currency = "USD",
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a price with appropriate decimal places
 * For large numbers (>= 1000): 2 decimals
 * For small numbers (< 1): 6 decimals
 * For medium numbers: 2 decimals
 *
 * @param value - Price to format
 * @param decimals - Optional fixed decimal places
 * @returns Formatted price string with $ prefix
 */
export function formatPrice(value: number, decimals?: number): string {
  if (decimals !== undefined) {
    return `$${value.toFixed(decimals)}`;
  }

  if (value >= THOUSAND) {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }

  return `$${value.toFixed(6)}`;
}

/**
 * Format a number as percentage
 * @param value - Number to format (can be 0-100 or 0-1 based on divide100 param)
 * @param decimals - Number of decimal places (default: 2)
 * @param divide100 - Whether to divide by 100 (default: true)
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number,
  decimals = 2,
  divide100 = true
): string {
  const percentValue = divide100 ? value / 100 : value;
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(percentValue);
}

/**
 * Format large volumes with K/M/B suffixes
 * @param value - Volume to format
 * @returns Formatted volume string with suffix
 */
export function formatVolume(value: number): string {
  if (value >= BILLION) {
    return `$${(value / BILLION).toFixed(2)}B`;
  }
  if (value >= MILLION) {
    return `$${(value / MILLION).toFixed(2)}M`;
  }
  if (value >= THOUSAND) {
    return `$${(value / THOUSAND).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format a number with locale-specific thousand separators
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted number string
 */
export function formatNumber(
  value: number,
  decimals = 2,
  locale = "en-US"
): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format large numbers with compact notation (K, M, B, T)
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Compact formatted number string
 */
export function formatCompactNumber(value: number, decimals = 1): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absValue >= TRILLION) {
    return `${sign}${(absValue / TRILLION).toFixed(decimals)}T`;
  }
  if (absValue >= BILLION) {
    return `${sign}${(absValue / BILLION).toFixed(decimals)}B`;
  }
  if (absValue >= MILLION) {
    return `${sign}${(absValue / MILLION).toFixed(decimals)}M`;
  }
  if (absValue >= THOUSAND) {
    return `${sign}${(absValue / THOUSAND).toFixed(decimals)}K`;
  }
  return `${sign}${absValue.toFixed(decimals)}`;
}

/**
 * Format a timestamp as relative time (e.g., "5m ago", "2h ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  if (seconds > 0) {
    return `${seconds}s ago`;
  }
  return "just now";
}

/**
 * Format blockchain address with ellipsis in the middle
 * @param address - Full blockchain address
 * @param prefixLength - Characters to show at start (default: 6)
 * @param suffixLength - Characters to show at end (default: 4)
 * @returns Formatted address string
 */
export function formatAddress(
  address: string,
  prefixLength = 6,
  suffixLength = 4
): string {
  if (
    address === "unknown" ||
    address === "multiple" ||
    address === "contract"
  ) {
    return address;
  }

  if (address.length <= prefixLength + suffixLength) {
    return address;
  }

  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}

/**
 * Format transaction hash with ellipsis in the middle
 * @param hash - Full transaction hash
 * @param prefixLength - Characters to show at start (default: 10)
 * @param suffixLength - Characters to show at end (default: 8)
 * @returns Formatted hash string
 */
export function formatTxHash(
  hash: string,
  prefixLength = 10,
  suffixLength = 8
): string {
  if (hash.length <= prefixLength + suffixLength) {
    return hash;
  }

  return `${hash.slice(0, prefixLength)}...${hash.slice(-suffixLength)}`;
}

/**
 * Get color class based on PnL value
 * @param value - PnL value
 * @returns Tailwind color class string
 */
export function getPnLColor(value: number): string {
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-muted-foreground";
}

/**
 * Get trend color based on change percentage
 * @param change - Change percentage value
 * @returns Tailwind color class string
 */
export function getTrendColor(change: number): string {
  if (change > 0) return "text-green-500";
  if (change < 0) return "text-red-500";
  return "text-gray-500";
}

/**
 * Format quantity with appropriate decimal places
 * Removes trailing zeros for cleaner display
 * @param value - Quantity to format
 * @param maxDecimals - Maximum decimal places (default: 8)
 * @returns Formatted quantity string
 */
export function formatQuantity(value: number, maxDecimals = 8): string {
  return value.toFixed(maxDecimals).replace(/\.?0+$/, "");
}
