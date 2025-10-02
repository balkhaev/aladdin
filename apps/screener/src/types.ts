/**
 * Типы для сервиса скринера
 */

export type SymbolInfo = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
};

export type TechnicalAnalysisResult = {
  symbol: string;
  timestamp: number;
  timeframe: string;
  indicators: {
    rsi?: number;
    macd?: {
      macd: number;
      signal: number;
      histogram: number;
    };
    ema20?: number;
    ema50?: number;
    ema200?: number;
    sma20?: number;
    sma50?: number;
    sma200?: number;
    bollingerBands?: {
      upper: number;
      middle: number;
      lower: number;
    };
    stochastic?: {
      k: number;
      d: number;
    };
    atr?: number;
    adx?: number;
  };
  signals: {
    trend: "BULLISH" | "BEARISH" | "NEUTRAL";
    strength: number; // 0-100
    momentum: "STRONG" | "MODERATE" | "WEAK";
    volatility: "HIGH" | "MEDIUM" | "LOW";
    recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  };
  price: {
    current: number;
    change24h: number;
    changePercent24h: number;
    volume24h: number;
  };
};

export type ScreenerJob = {
  symbol: string;
  timeframe: string;
};

export type ScreenerResult = {
  id: string;
  timestamp: number;
  results: TechnicalAnalysisResult[];
  totalSymbols: number;
  processedSymbols: number;
  failedSymbols: number;
  executionTimeMs: number;
};
