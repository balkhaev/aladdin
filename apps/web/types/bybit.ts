/**
 * Types for Bybit Opportunities
 */

export type OpportunitySignal = "BUY" | "SELL" | "NEUTRAL";
export type OpportunityStrength = "WEAK" | "MODERATE" | "STRONG";

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
  priceChange1m: number;
  priceChange5m: number;
  priceChange15m: number;
  rsi: number;
  macd: number;
  volumeSpike: number;
  anomalyTypes: string[];
  metadata: {
    technicalIndicators?: Record<string, unknown>;
    momentumMetrics?: Record<string, unknown>;
    mlAnomalies?: Array<{
      type: string;
      severity: string;
      confidence: number;
      description: string;
    }>;
  };
};
