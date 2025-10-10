import type {
  ExchangeFlowDetail,
  OnChainMetrics,
  WhaleTransaction,
} from "@aladdin/core";
import type { Logger } from "@aladdin/logger";
import { isExchangeAddress } from "../data/exchange-addresses";
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
  private priceProvider?: () => Promise<number | undefined>;
  private apiKey?: string;

  constructor(
    logger: Logger,
    whaleThreshold = DEFAULT_WHALE_THRESHOLD,
    marketCapProvider?: () => Promise<number | undefined>,
    priceProvider?: () => Promise<number | undefined>,
    apiKey?: string
  ) {
    // Blockchair: free tier 30 req/day (without key), 30 req/min (with key)
    super("BTC", logger, { maxRequests: 5, windowMs: 60_000 });
    this.whaleThreshold = whaleThreshold;
    this.marketCapProvider = marketCapProvider;
    this.priceProvider = priceProvider;
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

        return data.data.map((tx) => {
          const from = "multiple";
          const to = "multiple";
          const fromInfo = isExchangeAddress(from, "BTC");
          const toInfo = isExchangeAddress(to, "BTC");

          return {
            transactionHash: tx.hash,
            timestamp: new Date(tx.time).getTime(),
            from,
            to,
            value: tx.output_total / SATOSHI_TO_BTC,
            blockchain: "BTC",
            fromType: fromInfo.isExchange
              ? ("exchange" as const)
              : ("unknown" as const),
            toType: toInfo.isExchange
              ? ("exchange" as const)
              : ("unknown" as const),
            fromExchange: fromInfo.exchange,
            toExchange: toInfo.exchange,
          };
        });
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
        // Get whale transactions from the last 24 hours
        // Use a lower threshold (1 BTC) to catch more exchange flows
        const whaleTransactions = await this.fetchWhaleTransactions(1);

        let totalInflow = 0;
        let totalOutflow = 0;

        // Analyze each transaction to determine if it involves exchange addresses
        for (const tx of whaleTransactions) {
          const fromIsExchange = isExchangeAddress(tx.from, "BTC");
          const toIsExchange = isExchangeAddress(tx.to, "BTC");

          if (toIsExchange && !fromIsExchange) {
            // Inflow to exchange (from external address)
            totalInflow += tx.value;
          } else if (fromIsExchange && !toIsExchange) {
            // Outflow from exchange (to external address)
            totalOutflow += tx.value;
          }
          // Skip transactions between exchanges or internal exchange transfers
        }

        const netFlow = totalInflow - totalOutflow;

        this.logger.debug("Fetched exchange flows from whale transactions", {
          inflow: totalInflow,
          outflow: totalOutflow,
          netFlow,
          transactionsAnalyzed: whaleTransactions.length,
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

  fetchExchangeFlowsByExchange(): Promise<ExchangeFlowDetail[]> {
    // Blockchair free tier is too limited for per-exchange tracking
    // Would need multiple API calls per exchange
    this.logger.debug(
      "Per-exchange flow tracking not available with Blockchair free tier"
    );
    return Promise.resolve([]);
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

  async fetchPrice(): Promise<number | undefined> {
    if (!this.priceProvider) {
      return;
    }
    return await this.priceProvider();
  }

  async fetchNVTRatio(): Promise<number> {
    try {
      const [marketCap, txVolumeBTC, btcPrice] = await Promise.all([
        this.fetchMarketCap(),
        this.fetchTransactionVolume(),
        this.fetchPrice(),
      ]);

      if (!marketCap || txVolumeBTC === 0 || !btcPrice) {
        return 0;
      }

      // Convert transaction volume from BTC to USD
      const txVolumeUSD = txVolumeBTC * btcPrice;

      if (txVolumeUSD === 0) {
        return 0;
      }

      // NVT = Market Cap (USD) / Daily Transaction Volume (USD)
      const nvtRatio = marketCap / txVolumeUSD;

      this.logger.debug("Calculated NVT Ratio", {
        marketCap,
        txVolumeBTC,
        btcPrice,
        txVolumeUSD,
        nvtRatio,
      });

      return nvtRatio;
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
