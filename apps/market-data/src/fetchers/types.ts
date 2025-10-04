import type {
  AdvancedOnChainMetrics,
  ExchangeFlowDetail,
  OnChainMetrics,
  WhaleTransaction,
} from "@aladdin/shared/types";

/**
 * Interface for blockchain data fetchers
 */
export interface BlockchainFetcher {
  /**
   * Fetch whale transactions above a certain threshold
   */
  fetchWhaleTransactions(threshold: number): Promise<WhaleTransaction[]>;

  /**
   * Fetch exchange inflow/outflow data
   */
  fetchExchangeFlows(): Promise<{
    inflow: number;
    outflow: number;
    netFlow: number;
  }>;

  /**
   * Fetch exchange flows by exchange
   */
  fetchExchangeFlowsByExchange?(): Promise<ExchangeFlowDetail[]>;

  /**
   * Fetch active addresses count in the last 24 hours
   */
  fetchActiveAddresses(period?: string): Promise<number>;

  /**
   * Fetch Network Value to Transactions ratio
   */
  fetchNVTRatio(): Promise<number>;

  /**
   * Fetch market cap (if available)
   */
  fetchMarketCap(): Promise<number | undefined>;

  /**
   * Fetch total transaction volume in last 24h
   */
  fetchTransactionVolume(): Promise<number>;

  /**
   * Fetch all metrics at once
   */
  fetchMetrics(): Promise<OnChainMetrics>;

  /**
   * Fetch advanced on-chain metrics (optional)
   */
  fetchAdvancedMetrics?(): Promise<AdvancedOnChainMetrics>;

  /**
   * Get the blockchain identifier
   */
  getBlockchain(): string;
}

/**
 * Configuration for rate limiting
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}
