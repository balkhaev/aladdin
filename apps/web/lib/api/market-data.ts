import { API_CONFIG } from "../config";
import { apiGet } from "./client";

/**
 * Типы для Market Data API
 */
export type Ticker = {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
};

export type Tick = {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  bid: number;
  ask: number;
  bidVolume: number;
  askVolume: number;
  exchange: string;
};

export type Candle = {
  symbol: string;
  timeframe: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Quote = {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  bidVolume: number;
  askVolume: number;
  timestamp: number;
};

/**
 * Market Data API
 */
export const marketDataApi = {
  /**
   * Получить список доступных тикеров (подписанных)
   */
  getTickers: () => apiGet<string[]>(API_CONFIG.ENDPOINTS.MARKET_DATA.TICKERS),

  /**
   * Получить ВСЕ доступные символы с Binance
   */
  getAllSymbols: () => apiGet<string[]>("/api/market-data/symbols"),

  /**
   * Получить текущую котировку
   */
  getQuote: (symbol: string) =>
    apiGet<Quote>(`${API_CONFIG.ENDPOINTS.MARKET_DATA.QUOTE}/${symbol}`),

  /**
   * Получить свечи (исторические данные)
   */
  getCandles: (symbol: string, timeframe = "1h", limit = 100) =>
    apiGet<Candle[]>(`${API_CONFIG.ENDPOINTS.MARKET_DATA.CANDLES}/${symbol}`, {
      timeframe,
      limit,
    }),

  /**
   * Получить тики (сырые данные)
   */
  getTicks: (symbol: string, limit = 100) =>
    apiGet<Tick[]>(`${API_CONFIG.ENDPOINTS.MARKET_DATA.TICKS}/${symbol}`, {
      limit,
    }),
};

/**
 * Order Book Types
 */
export type OrderBookLevel = [number, number]; // [price, quantity]

export type OrderBook = {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  timestamp: number;
};

/**
 * Recent Trade Types
 */
export type RecentTrade = {
  id: number;
  price: number;
  qty: number;
  quoteQty: number;
  time: number;
  isBuyerMaker: boolean;
};

import { API_BASE_URL } from "../runtime-env";

/**
 * Get order book (market depth)
 */
export async function getOrderBook(
  symbol: string,
  limit = 20
): Promise<OrderBook> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/orderbook/${symbol}?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch order book");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get recent trades
 */
export async function getRecentTrades(
  symbol: string,
  limit = 100
): Promise<RecentTrade[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/trades/${symbol}?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recent trades");
  }

  const result = await response.json();
  return result.data.trades;
}

/**
 * Funding Rates Types
 */
export type FundingRate = {
  symbol: string;
  exchange: string;
  timestamp: Date;
  fundingRate: number;
  fundingIntervalHours: number;
  nextFundingTime: Date;
  avgFunding24h: number;
  avgFunding7d: number;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  signal: string;
};

/**
 * Open Interest Types
 */
export type OpenInterest = {
  symbol: string;
  exchange: string;
  timestamp: Date;
  openInterest: number;
  openInterestChange24h: number;
  openInterestChangePct: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  explanation: string;
};

/**
 * Get funding rate for a symbol
 */
export async function getFundingRate(
  symbol: string,
  exchange = "binance"
): Promise<FundingRate> {
  const params = new URLSearchParams({ exchange });

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/${symbol}/funding-rate?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch funding rate");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get funding rates across all exchanges
 */
export async function getAllFundingRates(
  symbol: string
): Promise<Record<string, FundingRate>> {
  const response = await fetch(
    `${API_BASE_URL}/api/market-data/${symbol}/funding-rate/all`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch funding rates");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get open interest for a symbol
 */
export async function getOpenInterest(
  symbol: string,
  exchange = "binance"
): Promise<OpenInterest> {
  const params = new URLSearchParams({ exchange });

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/${symbol}/open-interest?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch open interest");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get open interest across all exchanges
 */
export async function getAllOpenInterest(
  symbol: string
): Promise<Record<string, OpenInterest>> {
  const response = await fetch(
    `${API_BASE_URL}/api/market-data/${symbol}/open-interest/all`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch open interest");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Aggregated Price Types
 */
export type AggregatedPrice = {
  timestamp: number;
  symbol: string;
  vwap: number; // Volume Weighted Average Price
  binance_price: number | null;
  bybit_price: number | null;
  okx_price: number | null;
  binance_volume: number;
  bybit_volume: number;
  okx_volume: number;
  total_volume: number;
  avg_price: number;
  max_spread_percent: number;
  max_spread_exchange_high: string | null;
  max_spread_exchange_low: string | null;
  exchanges_count: number;
};

/**
 * Arbitrage Opportunity Types
 */
export type ArbitrageOpportunity = {
  symbol: string;
  spread_percent: number;
  high_exchange: string;
  low_exchange: string;
  high_price: number;
  low_price: number;
  vwap: number;
  total_volume: number;
  timestamp: number;
};

/**
 * Get aggregated price (VWAP across exchanges)
 */
export async function getAggregatedPrice(
  symbol: string,
  limit = 1
): Promise<AggregatedPrice> {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/aggregated/${symbol}?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch aggregated price");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get arbitrage opportunities
 */
export async function getArbitrageOpportunities(
  minSpread = 0.1,
  limit = 20
): Promise<ArbitrageOpportunity[]> {
  const params = new URLSearchParams({
    minSpread: minSpread.toString(),
    limit: limit.toString(),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/market-data/arbitrage?${params}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch arbitrage opportunities");
  }

  const result = await response.json();
  return result.data;
}
