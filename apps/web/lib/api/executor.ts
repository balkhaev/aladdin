/**
 * Strategy Executor API
 * Automated trading execution service
 */

import { apiClient } from "./client";

export type ExecutionMode = "PAPER" | "LIVE";

export type ExecutorStats = {
  totalSignalsReceived: number;
  totalSignalsProcessed: number;
  totalOrdersExecuted: number;
  totalOrdersSuccessful: number;
  totalOrdersFailed: number;
  mode: ExecutionMode;
  autoExecute: boolean;
  currentOpenPositions: number;
  activeAlgorithmicExecutions: number;
};

export type ExecutorConfig = {
  mode: ExecutionMode;
  maxOpenPositions: number;
  userId: string;
  portfolioId: string;
  exchangeCredentialsId: string;
  autoExecute: boolean;
  enableAlgorithmicExecution: boolean;
};

export type TradingSignal = {
  symbol: string;
  recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL";
  confidence: number;
  shouldExecute: boolean;
  source: string;
  timestamp: string;
};

export type ManualExecuteParams = {
  symbol: string;
  recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL";
  confidence: number;
};

export type OrderResult = {
  success: boolean;
  orderId?: string;
  message: string;
  error?: string;
};

/**
 * Get executor statistics
 */
export function getExecutorStats(): Promise<ExecutorStats> {
  return apiClient.get<ExecutorStats>("/api/trading/executor/stats");
}

/**
 * Get executor configuration
 */
export function getExecutorConfig(): Promise<ExecutorConfig> {
  return apiClient.get<ExecutorConfig>("/api/trading/executor/config");
}

/**
 * Update executor configuration
 */
export function updateExecutorConfig(
  config: Partial<ExecutorConfig>
): Promise<{ message: string; config: ExecutorConfig }> {
  return apiClient.patch<{ message: string; config: ExecutorConfig }>(
    "/api/trading/executor/config",
    config
  );
}

/**
 * Get pending signals
 */
export async function getPendingSignals(): Promise<TradingSignal[]> {
  const response = await apiClient.get<{
    signals: TradingSignal[];
    count: number;
  }>("/api/trading/executor/pending");
  return response.signals;
}

/**
 * Set execution mode (PAPER or LIVE)
 */
export function setExecutionMode(
  mode: ExecutionMode
): Promise<{ message: string; mode: ExecutionMode }> {
  return apiClient.post<{ message: string; mode: ExecutionMode }>(
    "/api/trading/executor/mode",
    { mode }
  );
}

/**
 * Toggle auto-execution on/off
 */
export function toggleAutoExecute(
  autoExecute: boolean
): Promise<{ message: string; autoExecute: boolean }> {
  return apiClient.post<{ message: string; autoExecute: boolean }>(
    "/api/trading/executor/toggle",
    { autoExecute }
  );
}

/**
 * Manually execute a trading signal
 */
export function manualExecuteSignal(
  params: ManualExecuteParams
): Promise<OrderResult> {
  return apiClient.post<OrderResult>("/api/trading/executor/manual", params);
}
