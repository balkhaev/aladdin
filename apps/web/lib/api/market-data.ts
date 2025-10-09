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

/**
 * Get order book (market depth)
 */
export async function getOrderBook(
  symbol: string,
  limit = 20
): Promise<OrderBook> {
  return apiGet<OrderBook>(`/api/market-data/orderbook/${symbol}`, { limit });
}

/**
 * Get recent trades
 */
export async function getRecentTrades(
  symbol: string,
  limit = 100
): Promise<RecentTrade[]> {
  const response = await apiGet<{ trades: RecentTrade[] }>(
    `/api/market-data/trades/${symbol}`,
    { limit }
  );
  return response.trades;
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
  return apiGet<FundingRate>(`/api/market-data/${symbol}/funding-rate`, {
    exchange,
  });
}

/**
 * Get funding rates across all exchanges
 */
export async function getAllFundingRates(
  symbol: string
): Promise<Record<string, FundingRate>> {
  return apiGet<Record<string, FundingRate>>(
    `/api/market-data/${symbol}/funding-rate/all`
  );
}

/**
 * Get open interest for a symbol
 */
export async function getOpenInterest(
  symbol: string,
  exchange = "binance"
): Promise<OpenInterest> {
  return apiGet<OpenInterest>(`/api/market-data/${symbol}/open-interest`, {
    exchange,
  });
}

/**
 * Get open interest across all exchanges
 */
export async function getAllOpenInterest(
  symbol: string
): Promise<Record<string, OpenInterest>> {
  return apiGet<Record<string, OpenInterest>>(
    `/api/market-data/${symbol}/open-interest/all`
  );
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
  return apiGet<AggregatedPrice>(`/api/market-data/aggregated/${symbol}`, {
    limit,
  });
}

/**
 * Get arbitrage opportunities
 */
export async function getArbitrageOpportunities(
  minSpread = 0.1,
  limit = 20
): Promise<ArbitrageOpportunity[]> {
  return apiGet<ArbitrageOpportunity[]>("/api/market-data/arbitrage", {
    minSpread,
    limit,
  });
}
