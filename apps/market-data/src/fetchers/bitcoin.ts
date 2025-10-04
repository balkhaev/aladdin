import type { Logger } from "@aladdin/shared/logger";
import type {
  ExchangeFlowDetail,
  OnChainMetrics,
  WhaleTransaction,
} from "@aladdin/shared/types";
import {
  getExchangeAddresses,
  isExchangeAddress,
} from "../data/exchange-addresses";
import { BaseFetcher } from "./base";

const BLOCKCHAIR_API = "https://api.blockchair.com/bitcoin";
const SATOSHI_TO_BTC = 100_000_000;
const SECONDS_IN_DAY = 86_400;
const USD_MULTIPLIER = 50_000;
const ADDRESSES_PER_TX = 1.5;
const MILLISECONDS_IN_SECOND = 1000;
const DEFAULT_WHALE_THRESHOLD = 10;

/**
 * Bitcoin blockchain data fetcher using Blockchain.info and Blockchair APIs
 */
export class BitcoinFetcher extends BaseFetcher {
  private whaleThreshold: number;
  private marketCapProvider?: () => Promise<number | undefined>;
  private apiKey?: string;

  constructor(
    logger: Logger,
    whaleThreshold = DEFAULT_WHALE_THRESHOLD,
    marketCapProvider?: () => Promise<number | undefined>,
    apiKey?: string
  ) {
    // Blockchair: free tier 30 req/day (without key), 30 req/min (with key)
    super("BTC", logger, { maxRequests: 5, windowMs: 60_000 });
    this.whaleThreshold = whaleThreshold;
    this.marketCapProvider = marketCapProvider;
    this.apiKey = apiKey;
  }

  async fetchWhaleTransactions(threshold: number): Promise<WhaleTransaction[]> {
    return await this.fetchWithRetry(async () => {
      try {
        const minUsd = threshold * USD_MULTIPLIER;
        const startTime = Date.now() - SECONDS_IN_DAY * MILLISECONDS_IN_SECOND;
        // Use Blockchair to get recent large transactions
        const keyParam = this.apiKey ? `&key=${this.apiKey}` : "";
        const response = await fetch(
          `${BLOCKCHAIR_API}/transactions?q=output_total_usd(${minUsd}..),time(${startTime}..)&limit=100${keyParam}`
        );

        if (!response.ok) {
          this.logger.warn("Blockchair API request failed, returning empty", {
            status: response.status,
          });
          return [];
        }

        const data = (await response.json()) as {
          data?: Array<{
            hash: string;
            time: string;
            input_total: number;
            output_total: number;
          }>;
        };

        if (!data.data) {
          return [];
        }

        return data.data.map((tx) => ({
          transactionHash: tx.hash,
          timestamp: new Date(tx.time).getTime(),
          from: "multiple", // Bitcoin has multiple inputs
          to: "multiple", // Bitcoin has multiple outputs
          value: tx.output_total / SATOSHI_TO_BTC,
          blockchain: "BTC",
        }));
      } catch (error) {
        this.logger.error("Failed to fetch Bitcoin whale transactions", error);
        return [];
      }
    }, "fetchWhaleTransactions");
  }

  async fetchExchangeFlows(): Promise<{
    inflow: number;
    outflow: number;
    netFlow: number;
  }> {
    return await this.fetchWithRetry(async () => {
      try {
        const exchangeAddresses = getExchangeAddresses("BTC");

        // For Blockchair, we can query specific addresses
        let totalInflow = 0;
        let totalOutflow = 0;

        // Sample a few exchange addresses to estimate flows
        const sampleAddresses = exchangeAddresses
          .filter((ex) => ex.type === "hot") // Hot wallets are more active
          .slice(0, 3) // Limit to avoid rate limits
          .flatMap((ex) => ex.addresses.slice(0, 2)); // Max 2 addresses per exchange

        for (const address of sampleAddresses) {
          try {
            const keyParam = this.apiKey ? `&key=${this.apiKey}` : "";
            const response = await fetch(
              `${BLOCKCHAIR_API}/dashboards/address/${address}${keyParam}`
            );

            if (!response.ok) {
              continue;
            }

            const data = (await response.json()) as {
              data?: {
                [key: string]: {
                  address?: {
                    received?: number;
                    spent?: number;
                  };
                };
              };
            };

            const addressData = data.data?.[address];
            if (addressData?.address) {
              const received = addressData.address.received ?? 0;
              const spent = addressData.address.spent ?? 0;

              // Estimate daily flow (rough approximation)
              totalInflow += (received / SATOSHI_TO_BTC) * 0.01; // 1% as daily estimate
              totalOutflow += (spent / SATOSHI_TO_BTC) * 0.01;
            }
          } catch {
            // Skip failed addresses
          }
        }

        const netFlow = totalInflow - totalOutflow;

        this.logger.debug("Fetched exchange flows (estimated)", {
          inflow: totalInflow,
          outflow: totalOutflow,
          netFlow,
          sampleSize: sampleAddresses.length,
        });

        return {
          inflow: totalInflow,
          outflow: totalOutflow,
          netFlow,
        };
      } catch (error) {
        this.logger.error("Failed to fetch Bitcoin exchange flows", error);
        return { inflow: 0, outflow: 0, netFlow: 0 };
      }
    }, "fetchExchangeFlows");
  }

  async fetchExchangeFlowsByExchange(): Promise<ExchangeFlowDetail[]> {
    // Blockchair free tier is too limited for per-exchange tracking
    // Would need multiple API calls per exchange
    this.logger.debug(
      "Per-exchange flow tracking not available with Blockchair free tier"
    );
    return [];
  }

  async fetchActiveAddresses(_period = "24h"): Promise<number> {
    return await this.fetchWithRetry(async () => {
      try {
        // Use Blockchair stats API
        const keyParam = this.apiKey ? `?key=${this.apiKey}` : "";
        const response = await fetch(`${BLOCKCHAIR_API}/stats${keyParam}`);

        if (!response.ok) {
          throw new Error(`Blockchair stats failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          data?: {
            transactions_24h?: number;
          };
        };

        // Estimate active addresses from transaction count
        // Typically ~1.5 addresses per transaction
        const txCount = data.data?.transactions_24h ?? 0;
        return Math.floor(txCount * ADDRESSES_PER_TX);
      } catch (error) {
        this.logger.error("Failed to fetch Bitcoin active addresses", error);
        return 0;
      }
    }, "fetchActiveAddresses");
  }

  async fetchTransactionVolume(): Promise<number> {
    return await this.fetchWithRetry(async () => {
      try {
        const keyParam = this.apiKey ? `?key=${this.apiKey}` : "";
        const response = await fetch(`${BLOCKCHAIR_API}/stats${keyParam}`);

        if (!response.ok) {
          throw new Error(`Blockchair stats failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          data?: {
            volume_24h?: number;
          };
        };

        // Volume is in satoshis, convert to BTC
        return (data.data?.volume_24h ?? 0) / SATOSHI_TO_BTC;
      } catch (error) {
        this.logger.error("Failed to fetch Bitcoin transaction volume", error);
        return 0;
      }
    }, "fetchTransactionVolume");
  }

  async fetchMarketCap(): Promise<number | undefined> {
    if (!this.marketCapProvider) {
      return;
    }
    return await this.marketCapProvider();
  }

  async fetchNVTRatio(): Promise<number> {
    try {
      const [marketCap, txVolume] = await Promise.all([
        this.fetchMarketCap(),
        this.fetchTransactionVolume(),
      ]);

      if (!marketCap || txVolume === 0) {
        return 0;
      }

      // NVT = Market Cap / Daily Transaction Volume
      return marketCap / txVolume;
    } catch (error) {
      this.logger.error("Failed to calculate Bitcoin NVT ratio", error);
      return 0;
    }
  }

  async fetchMetrics(): Promise<OnChainMetrics> {
    this.logger.info("Fetching Bitcoin on-chain metrics");

    try {
      // Fetch sequentially to avoid rate limits
      const whaleTransactions = await this.fetchWhaleTransactions(
        this.whaleThreshold
      );
      const exchangeFlow = await this.fetchExchangeFlows();
      const activeAddresses = await this.fetchActiveAddresses();
      const txVolume = await this.fetchTransactionVolume();
      const marketCap = await this.fetchMarketCap();

      // NVT ratio calculation uses cached values
      const nvtRatio = marketCap && txVolume > 0 ? marketCap / txVolume : 0;

      const metrics: OnChainMetrics = {
        timestamp: Date.now(),
        blockchain: "BTC",
        whaleTransactions: {
          count: whaleTransactions.length,
          totalVolume: whaleTransactions.reduce((sum, tx) => sum + tx.value, 0),
        },
        exchangeFlow,
        activeAddresses,
        nvtRatio,
        marketCap,
        transactionVolume: txVolume,
      };

      this.logger.info("Bitcoin metrics fetched successfully", {
        whaleCount: metrics.whaleTransactions.count,
        activeAddresses: metrics.activeAddresses,
      });

      return metrics;
    } catch (error) {
      this.logger.error("Failed to fetch Bitcoin metrics", error);
      throw error;
    }
  }
}
