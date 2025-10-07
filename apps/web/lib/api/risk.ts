/**
 * Risk API module
 * Provides functions to interact with Risk Service via API Gateway
 */

import { apiClient } from "./client";

export type CorrelationData = {
  symbol1: string;
  symbol2: string;
  correlation: number;
};

export type PortfolioCorrelations = {
  portfolioId: string;
  window: string;
  diversificationScore: number;
  avgCorrelation: number;
  correlations: CorrelationData[];
  highlyCorrelated: Array<{
    symbol1: string;
    symbol2: string;
    correlation: number;
  }>;
  generatedAt: string;
};

export type PortfolioExposure = {
  portfolioId: string;
  totalValue: number;
  longExposure: number;
  shortExposure: number;
  netExposure: number;
  leverage: number;
  marginUsed: number;
  availableMargin: number;
  generatedAt: string;
};

export type RiskLimitType =
  | "MAX_LEVERAGE"
  | "MAX_POSITION_SIZE"
  | "MAX_DAILY_LOSS"
  | "MIN_MARGIN";

export type RiskLimit = {
  id: string;
  userId: string;
  portfolioId?: string;
  type: RiskLimitType;
  value: number;
  enabled: boolean;
};

export type CreateRiskLimitInput = {
  portfolioId?: string;
  type: RiskLimitType;
  value: number;
  enabled?: boolean;
};

export type UpdateRiskLimitInput = {
  value?: number;
  enabled?: boolean;
};

export type VaRResult = {
  var95: number;
  var99: number;
  portfolioValue: number;
  confidenceLevel: number;
  timeHorizon: number;
  sharpeRatio: number;
  maxDrawdown: number;
};

export type CVaRResult = {
  cvar95: number;
  cvar99: number;
  var95: number;
  var99: number;
  portfolioValue: number;
  tailRisk95: number;
  tailRisk99: number;
  historicalReturns: number[];
  calculatedAt: string;
};

export type StressScenario = {
  name: string;
  description: string;
  priceShocks: Record<string, number>;
};

export type StressTestResult = {
  scenarioName: string;
  currentValue: number;
  projectedValue: number;
  loss: number;
  lossPercentage: number;
  worstAssets: Array<{
    symbol: string;
    loss: number;
    lossPercentage: number;
  }>;
};

export type StressTestSummary = {
  portfolioId: string;
  currentValue: number;
  worstCase: StressTestResult;
  bestCase: StressTestResult;
  averageLoss: number;
  averageLossPercentage: number;
  resilienceScore: number;
  recommendations: string[];
  results: StressTestResult[];
  testedAt: string;
};

/**
 * Get portfolio correlations
 */
export function getPortfolioCorrelations(
  portfolioId: string,
  params?: { window?: "7d" | "30d" | "90d" | "1y" }
): Promise<PortfolioCorrelations> {
  const searchParams = new URLSearchParams();
  if (params?.window) searchParams.set("window", params.window);

  const query = searchParams.toString();
  return apiClient.get<PortfolioCorrelations>(
    `/api/portfolio/${portfolioId}/risk/correlations${query ? `?${query}` : ""}`
  );
}

/**
 * Get portfolio exposure
 */
export function getPortfolioExposure(
  portfolioId: string
): Promise<PortfolioExposure> {
  return apiClient.get<PortfolioExposure>(
    `/api/portfolio/${portfolioId}/risk/exposure`
  );
}

/**
 * Calculate Value at Risk (VaR)
 */
export function getVaR(params: {
  portfolioId: string;
  confidenceLevel?: number;
  timeHorizon?: number;
}): Promise<VaRResult> {
  const searchParams = new URLSearchParams();
  if (params.confidenceLevel)
    searchParams.set("confidence", params.confidenceLevel.toString());
  if (params.timeHorizon)
    searchParams.set("days", params.timeHorizon.toString());

  const query = searchParams.toString();
  return apiClient.get<VaRResult>(
    `/api/portfolio/${params.portfolioId}/risk/var${query ? `?${query}` : ""}`
  );
}

/**
 * Get risk limits
 */
export function getRiskLimits(params?: {
  portfolioId?: string;
  enabled?: boolean;
}): Promise<RiskLimit[]> {
  const searchParams = new URLSearchParams();
  if (params?.portfolioId) searchParams.set("portfolioId", params.portfolioId);
  if (params?.enabled !== undefined)
    searchParams.set("enabled", params.enabled.toString());

  const query = searchParams.toString();
  return apiClient.get<RiskLimit[]>(
    `/api/portfolio/risk/limits${query ? `?${query}` : ""}`
  );
}

/**
 * Create risk limit
 */
export function createRiskLimit(
  data: CreateRiskLimitInput
): Promise<RiskLimit> {
  return apiClient.post<RiskLimit>("/api/portfolio/risk/limits", data);
}

/**
 * Update risk limit
 */
export function updateRiskLimit(
  limitId: string,
  data: UpdateRiskLimitInput
): Promise<RiskLimit> {
  return apiClient.patch<RiskLimit>(
    `/api/portfolio/risk/limits/${limitId}`,
    data
  );
}

/**
 * Delete risk limit
 */
export function deleteRiskLimit(limitId: string): Promise<void> {
  return apiClient.delete<void>(`/api/portfolio/risk/limits/${limitId}`);
}

/**
 * Calculate Conditional Value at Risk (CVaR)
 */
export function getCVaR(
  portfolioId: string,
  confidence?: 95 | 99
): Promise<CVaRResult> {
  const searchParams = new URLSearchParams();
  if (confidence) searchParams.set("confidence", confidence.toString());

  const query = searchParams.toString();
  return apiClient.get<CVaRResult>(
    `/api/portfolio/${portfolioId}/risk/cvar${query ? `?${query}` : ""}`
  );
}

/**
 * Run stress test on portfolio
 */
export function runStressTest(
  portfolioId: string,
  scenarios?: StressScenario[]
): Promise<StressTestSummary> {
  return apiClient.post<StressTestSummary>(
    `/api/portfolio/${portfolioId}/risk/stress-test`,
    { scenarios }
  );
}

/**
 * Get available stress test scenarios
 */
export function getStressTestScenarios(): Promise<StressScenario[]> {
  return apiClient.get<StressScenario[]>("/api/portfolio/risk/scenarios");
}
