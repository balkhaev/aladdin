/**
 * Macro Data API Client
 * Работа с глобальными рыночными метриками
 */

import { apiGet } from "./client";

const MACRO_BASE = "/api/macro";

// ==================== Types ====================

export type GlobalMetrics = {
  timestamp: string;
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  marketCapChange24h: number;
  btcDominance: number;
  ethDominance: number;
  altcoinDominance: number;
  activeCryptocurrencies: number;
  markets: number;
};

export type FearGreedData = {
  timestamp: string;
  value: number;
  classification: string;
};

export type TrendingCoin = {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number;
  priceUsd: number;
  priceBtc: number;
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
  rank: number;
};

export type TopCoin = {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number;
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChange7d: number;
  category: string | null;
  sector: string | null;
};

export type CategoryStats = {
  category: string;
  totalMarketCap: number;
  totalVolume24h: number;
  avgPriceChange24h: number;
  avgPriceChange7d: number;
  coinsCount: number;
};

export type FearGreedHistoryPoint = {
  time: number;
  value: number;
};

export type CorrelationData = {
  category1: string;
  category2: string;
  correlation: number;
};

// ==================== API Functions ====================

/**
 * Получить глобальные рыночные метрики
 */
export const getGlobalMetrics = () =>
  apiGet<GlobalMetrics>(`${MACRO_BASE}/global`);

/**
 * Получить Fear & Greed Index
 */
export const getFearGreed = (limit = 1) =>
  apiGet<FearGreedData | FearGreedData[]>(`${MACRO_BASE}/feargreed`, {
    limit,
  });

/**
 * Получить трендовые монеты
 */
export const getTrendingCoins = () =>
  apiGet<TrendingCoin[]>(`${MACRO_BASE}/trending`);

/**
 * Получить топ монеты
 */
export const getTopCoins = (params?: { category?: string; limit?: number }) =>
  apiGet<TopCoin[]>(`${MACRO_BASE}/top-coins`, params);

/**
 * Получить статистику по категориям
 */
export const getCategoryStats = () =>
  apiGet<CategoryStats[]>(`${MACRO_BASE}/categories`);

/**
 * Получить историю Fear & Greed Index
 */
export const getFearGreedHistory = (days = 30) =>
  apiGet<FearGreedHistoryPoint[]>(`${MACRO_BASE}/feargreed/history`, { days });

/**
 * Получить correlation matrix категорий
 */
export const getCategoryCorrelation = (days = 7) =>
  apiGet<CorrelationData[]>(`${MACRO_BASE}/categories/correlation`, { days });

// ==================== Constants ====================

const TRILLION = 1e12;
const BILLION = 1e9;
const MILLION = 1e6;

const FEAR_GREED_THRESHOLDS = {
  EXTREME_FEAR: 25,
  FEAR: 45,
  NEUTRAL: 55,
  GREED: 75,
} as const;

// ==================== Helpers ====================

/**
 * Форматировать market cap
 */
export function formatMarketCap(value: number): string {
  if (value >= TRILLION) return `$${(value / TRILLION).toFixed(2)}T`;
  if (value >= BILLION) return `$${(value / BILLION).toFixed(2)}B`;
  if (value >= MILLION) return `$${(value / MILLION).toFixed(2)}M`;
  return `$${value.toFixed(2)}`;
}

/**
 * Получить цвет для Fear & Greed значения
 */
export function getFearGreedColor(value: number): string {
  if (value < FEAR_GREED_THRESHOLDS.EXTREME_FEAR) return "text-red-600";
  if (value < FEAR_GREED_THRESHOLDS.FEAR) return "text-orange-500";
  if (value < FEAR_GREED_THRESHOLDS.NEUTRAL) return "text-yellow-500";
  if (value < FEAR_GREED_THRESHOLDS.GREED) return "text-green-500";
  return "text-green-600";
}

/**
 * Получить emoji для Fear & Greed
 */
export function getFearGreedEmoji(value: number): string {
  if (value < FEAR_GREED_THRESHOLDS.EXTREME_FEAR) return "😨";
  if (value < FEAR_GREED_THRESHOLDS.FEAR) return "😟";
  if (value < FEAR_GREED_THRESHOLDS.NEUTRAL) return "😐";
  if (value < FEAR_GREED_THRESHOLDS.GREED) return "😊";
  return "🤑";
}

/**
 * Получить цвет для изменения цены
 */
export function getPriceChangeColor(change: number): string {
  return change >= 0 ? "text-green-500" : "text-red-500";
}
