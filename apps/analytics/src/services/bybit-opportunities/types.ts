/**
 * Types for Bybit Opportunities
 */

export type PriceData = {
  timestamp: number;
  price: number;
  volume: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
};

export type OpportunitySignal = "BUY" | "SELL" | "NEUTRAL";
export type OpportunityStrength = "WEAK" | "MODERATE" | "STRONG";

export type TechnicalIndicators = {
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  ema20: number;
  ema50: number;
  ema200: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  stochK: number;
  stochD: number;
  atr: number;
  adx: number;
};

export type MomentumMetrics = {
  priceChange1m: number;
  priceChange5m: number;
  priceChange15m: number;
  volumeSpike: number; // ratio to average volume
  acceleration: number; // rate of price change increase
  volatility: number;
};

export type MLAnomaly = {
  type: string;
  confidence: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
};

export type OpportunityScore = {
  total: number; // 0-100
  technical: number; // 0-100
  momentum: number; // 0-100
  mlConfidence: number; // 0-100
  signal: OpportunitySignal;
  strength: OpportunityStrength;
  confidence: number; // 0-100
};

export type TradingOpportunity = {
  timestamp: number;
  symbol: string;
  exchange: string;
  opportunityType: OpportunitySignal;
  totalScore: number;
  technicalScore: number;
  momentumScore: number;
  mlConfidence: number;
  strength: OpportunityStrength;
  confidence: number;
  price: number;
  volume24h: number;
  indicators: TechnicalIndicators;
  momentum: MomentumMetrics;
  anomalies?: MLAnomaly[];
  metadata?: Record<string, unknown>;
};
