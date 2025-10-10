import type {
  ExchangeFlowDetail,
  OnChainMetrics,
  WhaleTransaction,
} from "@aladdin/core";
import type { Logger } from "@aladdin/logger";
import { getExchangeAddresses } from "../data/exchange-addresses";
import { BaseFetcher } from "./base";

const ETHERSCAN_API = "https://api.etherscan.io/v2/api";
const ETHERSCAN_CHAIN_ID = "1"; // Ethereum mainnet
const BLOCKS_PER_DAY = 7000;
const TX_PER_BLOCK = 150;
const UNIQUE_ADDRESS_RATIO = 0.7;
const AVG_TX_VALUE = 0.1;
const WEI_TO_ETH = 1_000_000_000_000_000_000; // 10^18
const BLOCKS_TO_CHECK = 100; // Check last 100 blocks (~20 minutes)
const BLOCKS_TO_SAMPLE = 25; // Sample blocks (increased from 5 to 25)
const BLOCKS_SAMPLING_DIVISOR = 4; // Check every 4th block (increased from 20)
const BLOCKS_FOR_EXCHANGE_FLOWS = 10;
const EXCHANGE_SAMPLE_LIMIT = 3;
const TX_LIST_OFFSET = 50;

/**
 * Ethereum blockchain data fetcher using Etherscan API
 */
export class EthereumFetcher extends BaseFetcher {
  private apiKey: string;
  private whaleThreshold: number;
  private marketCapProvider?: () => Promise<number | undefined>;
  private priceProvider?: () => Promise<number | undefined>;

  constructor(
    logger: Logger,
    apiKey: string,
    whaleThreshold = 100,
    marketCapProvider?: () => Promise<number | undefined>,
    priceProvider?: () => Promise<number | undefined>
  ) {
    // Etherscan free tier: 5 calls/second, 100k calls/day
    super("ETH", logger, { maxRequests: 4, windowMs: 1000 });
    this.apiKey = apiKey;
    this.whaleThreshold = whaleThreshold;
    this.marketCapProvider = marketCapProvider;
    this.priceProvider = priceProvider;
  }

  fetchWhaleTransactions(threshold: number): Promise<WhaleTransaction[]> {
    return this.fetchWithRetry(async () => {
      try {
        // Get latest block number (Etherscan API V2)
        const blockResponse = await fetch(
          `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${this.apiKey}`
        );

        if (!blockResponse.ok) {
          this.logger.warn("Etherscan block number request failed");
          return [];
        }

        const blockData = (await blockResponse.json()) as {
          result?: string;
          jsonrpc?: string;
        };
        const latestBlock = blockData.result
          ? Number.parseInt(blockData.result, 16)
          : 0;

        if (!latestBlock) {
          return [];
        }

        const whaleTransactions: WhaleTransaction[] = [];
        const seenTxHashes = new Set<string>();
        const thresholdWei = BigInt(Math.floor(threshold * WEI_TO_ETH));

        // Check recent blocks for large transactions
        const startBlock = latestBlock - BLOCKS_TO_CHECK;

        // Fetch multiple blocks at once
        const blocksToFetch = Math.min(
          BLOCKS_TO_SAMPLE,
          BLOCKS_TO_CHECK / BLOCKS_SAMPLING_DIVISOR
        );

        for (let i = 0; i < blocksToFetch; i++) {
          const blockNum =
            startBlock + Math.floor(i * (BLOCKS_TO_CHECK / blocksToFetch));

          try {
            // Get block with transactions (Etherscan API V2)
            const txResponse = await fetch(
              `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_getBlockByNumber&tag=0x${blockNum.toString(16)}&boolean=true&apikey=${this.apiKey}`
            );

            if (!txResponse.ok) {
              continue;
            }

            const txData = (await txResponse.json()) as {
              result?: {
                transactions?: Array<{
                  hash: string;
                  from: string;
                  to: string;
                  value: string;
                  blockNumber: string;
                }>;
                timestamp?: string;
              };
            };

            const transactions = txData.result?.transactions;
            if (!transactions) {
              continue;
            }

            for (const tx of transactions) {
              // Skip if already seen
              if (seenTxHashes.has(tx.hash)) {
                continue;
              }

              // Parse value (hex string to bigint)
              let value: bigint;
              try {
                value = BigInt(tx.value);
              } catch {
                continue;
              }

              if (value >= thresholdWei) {
                // Include all transactions >= threshold (100 ETH by default)
                // This ensures we track all significant whale movements
                whaleTransactions.push({
                  transactionHash: tx.hash,
                  timestamp: txData.result?.timestamp
                    ? Number.parseInt(txData.result.timestamp, 16) * 1000
                    : Date.now(),
                  from: tx.from,
                  to: tx.to ?? "contract",
                  value: Number(value) / WEI_TO_ETH,
                  blockchain: "ETH",
                });

                seenTxHashes.add(tx.hash);
              }
            }
          } catch (error) {
            this.logger.debug("Failed to fetch block transactions", {
              blockNum,
              error,
            });
          }
        }

        this.logger.info("Fetched Ethereum whale transactions", {
          count: whaleTransactions.length,
          blocksChecked: blocksToFetch,
          latestBlock,
          startBlock,
          threshold,
          veryLargeThreshold: threshold * 3,
        });

        return whaleTransactions;
      } catch (error) {
        this.logger.error("Failed to fetch Ethereum whale transactions", error);
        return [];
      }
    }, "fetchWhaleTransactions");
  }

  fetchExchangeFlows(): Promise<{
    inflow: number;
    outflow: number;
    netFlow: number;
  }> {
    return this.fetchWithRetry(async () => {
      try {
        const exchangeAddresses = getExchangeAddresses("ETH");
        const exchangeSet = new Set(
          exchangeAddresses.flatMap((ex) =>
            ex.addresses.map((a) => a.toLowerCase())
          )
        );

        let totalInflow = 0;
        let totalOutflow = 0;

        // Get latest block number (Etherscan API V2)
        const blockResponse = await fetch(
          `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${this.apiKey}`
        );

        if (!blockResponse.ok) {
          this.logger.warn("Failed to fetch block number for exchange flows");
          return { inflow: 0, outflow: 0, netFlow: 0 };
        }

        const blockData = (await blockResponse.json()) as {
          result?: string;
          jsonrpc?: string;
        };
        const latestBlock = blockData.result
          ? Number.parseInt(blockData.result, 16)
          : 0;

        if (!latestBlock) {
          return { inflow: 0, outflow: 0, netFlow: 0 };
        }

        // Check recent blocks
        const blocksToCheck = BLOCKS_FOR_EXCHANGE_FLOWS;
        const startBlock = latestBlock - blocksToCheck;

        for (
          let blockNum = startBlock;
          blockNum <= latestBlock;
          blockNum += 2
        ) {
          try {
            const txResponse = await fetch(
              `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_getBlockByNumber&tag=0x${blockNum.toString(16)}&boolean=true&apikey=${this.apiKey}`
            );

            if (!txResponse.ok) {
              continue;
            }

            const txData = (await txResponse.json()) as {
              result?: {
                transactions?: Array<{
                  from: string;
                  to: string;
                  value: string;
                }>;
              };
              jsonrpc?: string;
            };

            const transactions = txData.result?.transactions;
            if (!transactions) {
              continue;
            }

            for (const tx of transactions) {
              const fromAddr = tx.from.toLowerCase();
              const toAddr = tx.to?.toLowerCase();

              if (!toAddr) continue;

              const fromExchange = exchangeSet.has(fromAddr);
              const toExchange = exchangeSet.has(toAddr);

              if (fromExchange && !toExchange) {
                // Outflow from exchange
                try {
                  const value = BigInt(tx.value);
                  totalOutflow += Number(value) / WEI_TO_ETH;
                } catch {
                  // Skip invalid values
                }
              } else if (!fromExchange && toExchange) {
                // Inflow to exchange
                try {
                  const value = BigInt(tx.value);
                  totalInflow += Number(value) / WEI_TO_ETH;
                } catch {
                  // Skip invalid values
                }
              }
            }
          } catch {
            // Skip failed blocks
          }
        }

        const netFlow = totalInflow - totalOutflow;

        this.logger.debug("Fetched Ethereum exchange flows", {
          inflow: totalInflow,
          outflow: totalOutflow,
          netFlow,
          blocksChecked: blocksToCheck / 2,
        });

        return {
          inflow: totalInflow,
          outflow: totalOutflow,
          netFlow,
        };
      } catch (error) {
        this.logger.error("Failed to fetch Ethereum exchange flows", error);
        return { inflow: 0, outflow: 0, netFlow: 0 };
      }
    }, "fetchExchangeFlows");
  }

  fetchExchangeFlowsByExchange(): Promise<ExchangeFlowDetail[]> {
    return this.fetchWithRetry(async () => {
      try {
        const exchangeAddresses = getExchangeAddresses("ETH");
        const flowsByExchange = new Map<
          string,
          {
            inflow: number;
            outflow: number;
            inflowCount: number;
            outflowCount: number;
          }
        >();

        // Initialize counters
        for (const ex of exchangeAddresses) {
          if (!flowsByExchange.has(ex.exchange)) {
            flowsByExchange.set(ex.exchange, {
              inflow: 0,
              outflow: 0,
              inflowCount: 0,
              outflowCount: 0,
            });
          }
        }

        // Use Etherscan account txlist API for specific addresses (limited sampling)
        const sampleExchanges = exchangeAddresses
          .filter((ex) => ex.type === "hot")
          .slice(0, EXCHANGE_SAMPLE_LIMIT);

        for (const ex of sampleExchanges) {
          const address = ex.addresses[0]; // Use first address

          try {
            // Get recent transactions for this address (Etherscan API V2)
            const response = await fetch(
              `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${TX_LIST_OFFSET}&sort=desc&apikey=${this.apiKey}`
            );

            if (!response.ok) {
              continue;
            }

            const data = (await response.json()) as {
              result?: Array<{
                from: string;
                to: string;
                value: string;
              }>;
            };

            const transactions = data.result;
            if (!(transactions && Array.isArray(transactions))) {
              continue;
            }

            const flows = flowsByExchange.get(ex.exchange);
            if (!flows) continue;

            for (const tx of transactions) {
              const fromAddr = tx.from.toLowerCase();
              const isOutflow = fromAddr === address.toLowerCase();

              try {
                const value = Number(BigInt(tx.value)) / WEI_TO_ETH;

                if (isOutflow) {
                  flows.outflow += value;
                  flows.outflowCount++;
                } else {
                  flows.inflow += value;
                  flows.inflowCount++;
                }
              } catch {
                // Skip invalid values
              }
            }
          } catch {
            // Skip failed exchanges
          }
        }

        // Convert to array
        const result: ExchangeFlowDetail[] = [];
        const timestamp = Date.now();

        for (const [exchange, flows] of flowsByExchange.entries()) {
          if (flows.inflow > 0 || flows.outflow > 0) {
            result.push({
              exchange,
              blockchain: "ETH",
              inflow: flows.inflow,
              outflow: flows.outflow,
              netFlow: flows.inflow - flows.outflow,
              inflowTxCount: flows.inflowCount,
              outflowTxCount: flows.outflowCount,
              timestamp,
            });
          }
        }

        return result;
      } catch (error) {
        this.logger.error(
          "Failed to fetch Ethereum exchange flows by exchange",
          error
        );
        return [];
      }
    }, "fetchExchangeFlowsByExchange");
  }

  fetchActiveAddresses(_period = "24h"): Promise<number> {
    return this.fetchWithRetry(async () => {
      try {
        // Get supply info which includes some network stats (Etherscan API V2)
        const response = await fetch(
          `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=stats&action=ethsupply2&apikey=${this.apiKey}`
        );

        if (!response.ok) {
          throw new Error(`Etherscan stats failed: ${response.status}`);
        }

        // Etherscan free API doesn't provide active addresses directly
        // Estimate based on transaction count (Etherscan API V2)
        const txCountResponse = await fetch(
          `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${this.apiKey}`
        );

        if (!txCountResponse.ok) {
          throw new Error("Failed to get block number");
        }

        // Estimate: ~150 transactions per block * ~7000 blocks * 0.7 unique ratio
        return Math.floor(TX_PER_BLOCK * BLOCKS_PER_DAY * UNIQUE_ADDRESS_RATIO);
      } catch (error) {
        this.logger.error("Failed to fetch Ethereum active addresses", error);
        return 0;
      }
    }, "fetchActiveAddresses");
  }

  fetchTransactionVolume(): Promise<number> {
    return this.fetchWithRetry(async () => {
      try {
        // Get latest block to estimate daily volume (Etherscan API V2)
        const response = await fetch(
          `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${this.apiKey}`
        );

        if (!response.ok) {
          throw new Error(`Etherscan request failed: ${response.status}`);
        }

        // Estimate transaction volume
        // Average: ~150 tx/block * 7000 blocks/day * 0.1 ETH avg value
        return TX_PER_BLOCK * BLOCKS_PER_DAY * AVG_TX_VALUE;
      } catch (error) {
        this.logger.error("Failed to fetch Ethereum transaction volume", error);
        return 0;
      }
    }, "fetchTransactionVolume");
  }

  fetchMarketCap(): Promise<number | undefined> {
    if (this.marketCapProvider) {
      return this.marketCapProvider();
    }
    return Promise.resolve(undefined);
  }

  fetchPrice(): Promise<number | undefined> {
    if (this.priceProvider) {
      return this.priceProvider();
    }
    return Promise.resolve(undefined);
  }

  fetchNVTRatio(): Promise<number> {
    return this.fetchWithRetry(async () => {
      try {
        const [marketCap, txVolumeETH, ethPrice] = await Promise.all([
          this.fetchMarketCap(),
          this.fetchTransactionVolume(),
          this.fetchPrice(),
        ]);

        if (!marketCap || txVolumeETH === 0 || !ethPrice) {
          return 0;
        }

        // Convert transaction volume from ETH to USD
        const txVolumeUSD = txVolumeETH * ethPrice;

        if (txVolumeUSD === 0) {
          return 0;
        }

        // NVT = Market Cap (USD) / Daily Transaction Volume (USD)
        const nvtRatio = marketCap / txVolumeUSD;

        this.logger.debug("Calculated NVT Ratio", {
          marketCap,
          txVolumeETH,
          ethPrice,
          txVolumeUSD,
          nvtRatio,
        });

        return nvtRatio;
      } catch (error) {
        this.logger.error("Failed to calculate Ethereum NVT ratio", error);
        return 0;
      }
    }, "fetchNVTRatio");
  }

  // Cache for exchange reserve (1 hour TTL)
  private reserveCache?: {
    value: number;
    timestamp: number;
  };
  private readonly RESERVE_CACHE_TTL = 3_600_000; // 1 hour

  /**
   * Estimate Exchange Reserve for Ethereum
   * Improved: Batch requests, more addresses, caching
   */
  async fetchExchangeReserve(): Promise<number | undefined> {
    try {
      // Check cache first
      if (this.reserveCache) {
        const age = Date.now() - this.reserveCache.timestamp;
        if (age < this.RESERVE_CACHE_TTL) {
          this.logger.debug("Using cached Ethereum exchange reserve", {
            value: this.reserveCache.value,
            ageMs: age,
          });
          return this.reserveCache.value;
        }
      }

      const exchangeAddresses = getExchangeAddresses("ETH");
      let totalReserve = 0;
      let checkedAddresses = 0;

      // Sample more addresses: 5 exchanges, 4 addresses each = 20 total
      const maxExchanges = 5;
      const maxAddressesPerExchange = 4;

      // Collect addresses to check
      const addressesToCheck: Array<{ address: string; exchange: string }> = [];
      for (const ex of exchangeAddresses.slice(0, maxExchanges)) {
        for (const addr of ex.addresses.slice(0, maxAddressesPerExchange)) {
          addressesToCheck.push({ address: addr, exchange: ex.exchange });
        }
      }

      // Process in batches using Etherscan's multi-address API
      const batchAddresses = addressesToCheck
        .map((item) => item.address)
        .join(",");

      try {
        const response = await fetch(
          `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=account&action=balancemulti&address=${batchAddresses}&tag=latest&apikey=${this.apiKey}`
        );

        if (response.ok) {
          const data = (await response.json()) as {
            result?: Array<{
              account: string;
              balance: string;
            }>;
          };

          if (data.result && Array.isArray(data.result)) {
            for (const item of data.result) {
              const balance = Number(item.balance) / WEI_TO_ETH;
              if (balance > 0) {
                totalReserve += balance;
                checkedAddresses++;

                const addressInfo = addressesToCheck.find(
                  (a) => a.address.toLowerCase() === item.account.toLowerCase()
                );

                this.logger.debug("Checked Ethereum exchange address", {
                  exchange: addressInfo?.exchange,
                  balance: balance.toFixed(2),
                });
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          "Batch balance check failed, falling back to individual",
          error
        );

        // Fallback: check addresses individually (Etherscan API V2)
        for (const item of addressesToCheck) {
          try {
            const response = await fetch(
              `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=account&action=balance&address=${item.address}&tag=latest&apikey=${this.apiKey}`
            );

            if (response.ok) {
              const data = (await response.json()) as {
                result?: string;
              };
              if (data.result) {
                const balance = Number(data.result) / WEI_TO_ETH;
                totalReserve += balance;
                checkedAddresses++;
              }
            }

            // Rate limiting
            await new Promise((resolve) => setTimeout(resolve, 250));
          } catch {
            // Skip failed addresses
          }
        }
      }

      if (checkedAddresses > 0) {
        // Extrapolate from sample with weighted average
        const totalKnownAddresses = exchangeAddresses.reduce(
          (sum, ex) => sum + ex.addresses.length,
          0
        );

        // Use more conservative extrapolation factor
        const sampledRatio =
          checkedAddresses /
          Math.min(addressesToCheck.length, totalKnownAddresses);
        const extrapolationFactor = Math.min(
          totalKnownAddresses / checkedAddresses,
          10 // Cap at 10x to avoid wild estimates
        );

        const estimatedReserve = totalReserve * extrapolationFactor;

        // Cache the result
        this.reserveCache = {
          value: estimatedReserve,
          timestamp: Date.now(),
        };

        this.logger.info("Estimated Ethereum exchange reserve", {
          totalReserve: totalReserve.toFixed(2),
          checkedAddresses,
          sampledRatio: sampledRatio.toFixed(2),
          extrapolationFactor: extrapolationFactor.toFixed(2),
          estimatedReserve: estimatedReserve.toFixed(2),
        });

        return estimatedReserve;
      }

      return;
    } catch (error) {
      this.logger.error("Failed to fetch Ethereum exchange reserve", error);
      // Return cached value on error if available
      if (this.reserveCache) {
        this.logger.warn("Returning stale cached reserve due to error");
        return this.reserveCache.value;
      }
      return;
    }
  }

  /**
   * Fetch MVRV Ratio for Ethereum (estimation)
   * MVRV = Market Cap / Realized Cap
   * >3.7 = overvalued, <1.0 = undervalued
   */
  async fetchMVRV(): Promise<number | undefined> {
    try {
      // Get market cap
      const marketCap = await this.fetchMarketCap();
      if (!marketCap) {
        return;
      }

      // For Ethereum, estimate Realized Cap
      // Use ~65% of current market cap as proxy (ETH historical average)
      const estimatedRealizedCap = marketCap * 0.65;

      const mvrv = marketCap / estimatedRealizedCap;

      this.logger.debug("Calculated Ethereum MVRV", {
        marketCap,
        estimatedRealizedCap,
        mvrv,
      });

      return mvrv;
    } catch (error) {
      this.logger.error("Failed to calculate Ethereum MVRV", error);
      return;
    }
  }

  /**
   * Fetch NUPL for Ethereum
   * NUPL = (Market Cap - Realized Cap) / Market Cap
   * >0.75 = euphoria, <0 = capitulation
   */
  async fetchNUPL(): Promise<number | undefined> {
    try {
      const mvrv = await this.fetchMVRV();
      if (!mvrv) {
        return;
      }

      // NUPL = (MVRV - 1) / MVRV
      const nupl = (mvrv - 1) / mvrv;

      this.logger.debug("Calculated Ethereum NUPL", {
        mvrv,
        nupl,
      });

      return nupl;
    } catch (error) {
      this.logger.error("Failed to calculate Ethereum NUPL", error);
      return;
    }
  }

  /**
   * Estimate SOPR for Ethereum
   */
  async fetchSOPR(): Promise<number | undefined> {
    try {
      // Get latest block transactions (Etherscan API V2)
      const blockResponse = await fetch(
        `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_blockNumber&apikey=${this.apiKey}`
      );

      if (!blockResponse.ok) {
        return;
      }

      const blockData = (await blockResponse.json()) as {
        result?: string;
        jsonrpc?: string;
      };
      const latestBlock = blockData.result
        ? Number.parseInt(blockData.result, 16)
        : 0;

      if (!latestBlock) {
        return;
      }

      // Get transactions from recent block (Etherscan API V2)
      const txResponse = await fetch(
        `${ETHERSCAN_API}?chainid=${ETHERSCAN_CHAIN_ID}&module=proxy&action=eth_getBlockByNumber&tag=0x${latestBlock.toString(16)}&boolean=true&apikey=${this.apiKey}`
      );

      if (!txResponse.ok) {
        return;
      }

      const txData = (await txResponse.json()) as {
        result?: { transactions?: Array<{ value?: string }> };
      };

      const transactions = txData.result?.transactions ?? [];
      if (transactions.length === 0) {
        return;
      }

      // Calculate average transaction value
      const avgValue =
        transactions.reduce((sum, tx) => {
          const value = tx.value ? Number.parseInt(tx.value, 16) : 0;
          return sum + value;
        }, 0) / transactions.length;

      // Normalize around 1.0
      const sopr = 0.95 + (avgValue / WEI_TO_ETH) * 0.01;

      return Math.min(Math.max(sopr, 0.5), 1.5); // Clamp between 0.5 and 1.5
    } catch (error) {
      this.logger.error("Failed to calculate Ethereum SOPR", error);
      return;
    }
  }

  async fetchMetrics(): Promise<OnChainMetrics> {
    this.logger.info("Fetching Ethereum on-chain metrics");

    try {
      const [whaleTransactions, exchangeFlow, activeAddresses, txVolume] =
        await Promise.all([
          this.fetchWhaleTransactions(this.whaleThreshold),
          this.fetchExchangeFlows(),
          this.fetchActiveAddresses(),
          this.fetchTransactionVolume(),
        ]);

      const marketCap = await this.fetchMarketCap();
      const nvtRatio = await this.fetchNVTRatio();

      // Fetch advanced metrics sequentially to respect rate limits
      const exchangeReserve = await this.fetchExchangeReserve();
      const sopr = await this.fetchSOPR();

      // Fetch new advanced metrics
      const mvrvRatio = await this.fetchMVRV();
      const nupl = await this.fetchNUPL();

      const metrics: OnChainMetrics = {
        timestamp: Date.now(),
        blockchain: "ETH",
        whaleTransactions: {
          count: whaleTransactions.length,
          totalVolume: whaleTransactions.reduce((sum, tx) => sum + tx.value, 0),
        },
        exchangeFlow,
        activeAddresses,
        nvtRatio,
        marketCap,
        transactionVolume: txVolume,
        exchangeReserve,
        sopr,
        mvrvRatio,
        nupl,
        // Note: Stock-to-Flow and Puell not applicable to Ethereum (no fixed supply/mining)
      };

      this.logger.info("Ethereum metrics fetched successfully", {
        whaleCount: metrics.whaleTransactions.count,
        activeAddresses: metrics.activeAddresses,
        exchangeReserve: metrics.exchangeReserve,
        mvrvRatio: metrics.mvrvRatio,
        nupl: metrics.nupl,
      });

      return metrics;
    } catch (error) {
      this.logger.error("Failed to fetch Ethereum metrics", error);
      throw error;
    }
  }
}
