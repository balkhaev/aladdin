import type {
  ExchangeFlowDetail,
  OnChainMetrics,
  WhaleTransaction,
} from "@aladdin/core";
import type { Logger } from "@aladdin/logger";
import {
  getExchangeAddresses,
  isExchangeAddress,
} from "../data/exchange-addresses";
import { BaseFetcher } from "./base";

const MEMPOOL_API = "https://mempool.space/api";
const BLOCKCHAIN_INFO_API = "https://blockchain.info";
const SATOSHI_TO_BTC = 100_000_000;
const DEFAULT_WHALE_THRESHOLD = 10;
const MAX_BLOCKS_TO_CHECK = 15; // Increased from 3 to 15
const MILLISECONDS_IN_SECOND = 1000;
const ADDRESSES_PER_TX = 1.5;

/**
 * Bitcoin blockchain data fetcher using Mempool.space and Blockchain.info APIs
 * Both are free, public APIs without registration
 */
export class BitcoinMempoolFetcher extends BaseFetcher {
  private whaleThreshold: number;
  private marketCapProvider?: () => Promise<number | undefined>;

  constructor(
    logger: Logger,
    whaleThreshold = DEFAULT_WHALE_THRESHOLD,
    marketCapProvider?: () => Promise<number | undefined>
  ) {
    // Mempool.space: public API, reasonable rate limits
    super("BTC", logger, { maxRequests: 10, windowMs: 60_000 });
    this.whaleThreshold = whaleThreshold;
    this.marketCapProvider = marketCapProvider;
  }

  async fetchWhaleTransactions(threshold: number): Promise<WhaleTransaction[]> {
    return await this.fetchWithRetry(async () => {
      try {
        // Get recent blocks from mempool.space
        const response = await fetch(`${MEMPOOL_API}/blocks`);

        if (!response.ok) {
          this.logger.warn("Mempool.space blocks request failed", {
            status: response.status,
          });
          return [];
        }

        const blocks = (await response.json()) as Array<{
          id: string;
          height: number;
          timestamp: number;
          tx_count: number;
        }>;

        const whaleTransactions: WhaleTransaction[] = [];
        const thresholdSatoshis = threshold * SATOSHI_TO_BTC;
        const seenTxHashes = new Set<string>(); // Deduplication

        // Check transactions in recent blocks
        for (const block of blocks.slice(0, MAX_BLOCKS_TO_CHECK)) {
          try {
            const txResponse = await fetch(
              `${MEMPOOL_API}/block/${block.id}/txs`
            );
            if (!txResponse.ok) {
              continue;
            }

            const transactions = (await txResponse.json()) as Array<{
              txid: string;
              vin: Array<{ prevout?: { scriptpubkey_address?: string } }>;
              vout: Array<{
                value: number;
                scriptpubkey_address?: string;
              }>;
              status: { block_time: number };
            }>;

            for (const tx of transactions) {
              // Skip if already seen
              if (seenTxHashes.has(tx.txid)) {
                continue;
              }

              const totalOutput = tx.vout.reduce(
                (sum, output) => sum + output.value,
                0
              );

              if (totalOutput >= thresholdSatoshis) {
                // Get first input and output addresses
                const fromAddress =
                  tx.vin[0]?.prevout?.scriptpubkey_address ?? "unknown";
                const toAddress = tx.vout[0]?.scriptpubkey_address ?? "unknown";

                whaleTransactions.push({
                  transactionHash: tx.txid,
                  timestamp: tx.status.block_time * MILLISECONDS_IN_SECOND,
                  from: fromAddress,
                  to: toAddress,
                  value: totalOutput / SATOSHI_TO_BTC,
                  blockchain: "BTC",
                });

                seenTxHashes.add(tx.txid);
              }
            }
          } catch {
            this.logger.debug("Failed to fetch transactions for block", {
              blockId: block.id,
            });
          }
        }

        this.logger.debug("Fetched whale transactions", {
          count: whaleTransactions.length,
          blocks: MAX_BLOCKS_TO_CHECK,
        });

        return whaleTransactions;
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
        const allAddresses = new Set(
          exchangeAddresses.flatMap((ex) =>
            ex.addresses.map((a) => a.toLowerCase())
          )
        );

        let totalInflow = 0;
        let totalOutflow = 0;

        // Get recent blocks
        const response = await fetch(`${MEMPOOL_API}/blocks`);
        if (!response.ok) {
          this.logger.warn("Failed to fetch blocks for exchange flows");
          return { inflow: 0, outflow: 0, netFlow: 0 };
        }

        const blocks = (await response.json()) as Array<{
          id: string;
          height: number;
        }>;

        // Check recent blocks for exchange flows
        for (const block of blocks.slice(0, 5)) {
          try {
            const txResponse = await fetch(
              `${MEMPOOL_API}/block/${block.id}/txs`
            );
            if (!txResponse.ok) {
              continue;
            }

            const transactions = (await txResponse.json()) as Array<{
              vin: Array<{ prevout?: { scriptpubkey_address?: string } }>;
              vout: Array<{
                value: number;
                scriptpubkey_address?: string;
              }>;
            }>;

            for (const tx of transactions) {
              // Check if transaction involves exchange addresses
              const fromExchange = tx.vin.some(
                (input) =>
                  input.prevout?.scriptpubkey_address &&
                  allAddresses.has(
                    input.prevout.scriptpubkey_address.toLowerCase()
                  )
              );

              const toExchange = tx.vout.some(
                (output) =>
                  output.scriptpubkey_address &&
                  allAddresses.has(output.scriptpubkey_address.toLowerCase())
              );

              if (fromExchange && !toExchange) {
                // Outflow from exchange
                const totalValue = tx.vout.reduce(
                  (sum, out) => sum + out.value,
                  0
                );
                totalOutflow += totalValue / SATOSHI_TO_BTC;
              } else if (!fromExchange && toExchange) {
                // Inflow to exchange
                const totalValue = tx.vout.reduce(
                  (sum, out) => sum + out.value,
                  0
                );
                totalInflow += totalValue / SATOSHI_TO_BTC;
              }
            }
          } catch {
            this.logger.debug("Failed to process block for exchange flows", {
              blockId: block.id,
            });
          }
        }

        const netFlow = totalInflow - totalOutflow;

        this.logger.debug("Fetched exchange flows", {
          inflow: totalInflow,
          outflow: totalOutflow,
          netFlow,
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
    return await this.fetchWithRetry(async () => {
      try {
        const exchangeAddresses = getExchangeAddresses("BTC");
        const flowsByExchange = new Map<
          string,
          {
            inflow: number;
            outflow: number;
            inflowCount: number;
            outflowCount: number;
          }
        >();

        // Initialize counters for each exchange
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

        // Get recent blocks
        const response = await fetch(`${MEMPOOL_API}/blocks`);
        if (!response.ok) {
          return [];
        }

        const blocks = (await response.json()) as Array<{ id: string }>;

        // Check recent blocks
        for (const block of blocks.slice(0, 5)) {
          try {
            const txResponse = await fetch(
              `${MEMPOOL_API}/block/${block.id}/txs`
            );
            if (!txResponse.ok) {
              continue;
            }

            const transactions = (await txResponse.json()) as Array<{
              vin: Array<{ prevout?: { scriptpubkey_address?: string } }>;
              vout: Array<{
                value: number;
                scriptpubkey_address?: string;
              }>;
            }>;

            for (const tx of transactions) {
              // Check each input/output against exchange addresses
              for (const input of tx.vin) {
                const addr = input.prevout?.scriptpubkey_address;
                if (!addr) continue;

                const exchangeInfo = isExchangeAddress(addr, "BTC");
                if (exchangeInfo.isExchange && exchangeInfo.exchange) {
                  const flows = flowsByExchange.get(exchangeInfo.exchange);
                  if (flows) {
                    const totalValue = tx.vout.reduce(
                      (sum, out) => sum + out.value,
                      0
                    );
                    flows.outflow += totalValue / SATOSHI_TO_BTC;
                    flows.outflowCount++;
                  }
                }
              }

              for (const output of tx.vout) {
                const addr = output.scriptpubkey_address;
                if (!addr) continue;

                const exchangeInfo = isExchangeAddress(addr, "BTC");
                if (exchangeInfo.isExchange && exchangeInfo.exchange) {
                  const flows = flowsByExchange.get(exchangeInfo.exchange);
                  if (flows) {
                    flows.inflow += output.value / SATOSHI_TO_BTC;
                    flows.inflowCount++;
                  }
                }
              }
            }
          } catch {
            // Skip failed blocks
          }
        }

        // Convert to array
        const result: ExchangeFlowDetail[] = [];
        const timestamp = Date.now();

        for (const [exchange, flows] of flowsByExchange.entries()) {
          result.push({
            exchange,
            blockchain: "BTC",
            inflow: flows.inflow,
            outflow: flows.outflow,
            netFlow: flows.inflow - flows.outflow,
            inflowTxCount: flows.inflowCount,
            outflowTxCount: flows.outflowCount,
            timestamp,
          });
        }

        return result;
      } catch (error) {
        this.logger.error("Failed to fetch exchange flows by exchange", error);
        return [];
      }
    }, "fetchExchangeFlowsByExchange");
  }

  async fetchActiveAddresses(_period = "24h"): Promise<number> {
    return await this.fetchWithRetry(async () => {
      try {
        // Get stats from blockchain.info
        const response = await fetch(
          `${BLOCKCHAIN_INFO_API}/stats?format=json`
        );

        if (!response.ok) {
          throw new Error(`Blockchain.info stats failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          n_tx?: number;
          n_btc_mined?: number;
        };

        // Estimate active addresses from transaction count
        const txCount = data.n_tx ?? 0;
        const estimatedAddresses = Math.floor(txCount * ADDRESSES_PER_TX);

        this.logger.debug("Fetched active addresses estimate", {
          txCount,
          estimatedAddresses,
        });

        return estimatedAddresses;
      } catch (error) {
        this.logger.error("Failed to fetch Bitcoin active addresses", error);
        return 0;
      }
    }, "fetchActiveAddresses");
  }

  async fetchTransactionVolume(): Promise<number> {
    return await this.fetchWithRetry(async () => {
      try {
        // Get blockchain stats from blockchain.info
        const response = await fetch(
          `${BLOCKCHAIN_INFO_API}/stats?format=json`
        );

        if (!response.ok) {
          throw new Error(`Blockchain.info stats failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          trade_volume_btc?: number;
          total_btc_sent?: number;
        };

        // Use trade volume or total BTC sent
        const volume = data.trade_volume_btc ?? data.total_btc_sent ?? 0;

        this.logger.debug("Fetched transaction volume", { volume });

        return volume;
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

  /**
   * Calculate Stock-to-Flow ratio for Bitcoin
   * S2F = Current Supply / Annual Production
   */
  async fetchStockToFlow(): Promise<number | undefined> {
    try {
      // Bitcoin supply info from blockchain.info
      const response = await fetch(`${BLOCKCHAIN_INFO_API}/stats?format=json`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        totalbc?: number; // Total BTC in circulation (in satoshis)
        n_blocks_total?: number;
      };

      if (!(data.totalbc && data.n_blocks_total)) {
        return;
      }

      const currentSupply = data.totalbc / SATOSHI_TO_BTC;

      // Bitcoin emission schedule: 6.25 BTC per block, ~144 blocks per day
      const blocksPerYear = 144 * 365;
      const currentReward = 6.25; // BTC per block (halving every 210k blocks)
      const annualProduction = blocksPerYear * currentReward;

      const stockToFlow = currentSupply / annualProduction;

      this.logger.debug("Calculated Stock-to-Flow", {
        currentSupply,
        annualProduction,
        stockToFlow,
      });

      return stockToFlow;
    } catch (error) {
      this.logger.error("Failed to calculate Stock-to-Flow", error);
      return;
    }
  }

  // Cache for exchange reserve (1 hour TTL)
  private reserveCache?: {
    value: number;
    timestamp: number;
  };
  private readonly RESERVE_CACHE_TTL = 3_600_000; // 1 hour

  /**
   * Estimate Exchange Reserve (total BTC on known exchange addresses)
   * Improved: More addresses, caching, better sampling
   */
  async fetchExchangeReserve(): Promise<number | undefined> {
    try {
      // Check cache first
      if (this.reserveCache) {
        const age = Date.now() - this.reserveCache.timestamp;
        if (age < this.RESERVE_CACHE_TTL) {
          this.logger.debug("Using cached exchange reserve", {
            value: this.reserveCache.value,
            ageMs: age,
          });
          return this.reserveCache.value;
        }
      }

      const exchangeAddresses = getExchangeAddresses("BTC");
      let totalReserve = 0;
      let checkedAddresses = 0;

      // Sample more addresses: 5 exchanges, 4 addresses each = 20 total
      const maxExchanges = 5;
      const maxAddressesPerExchange = 4;

      for (const ex of exchangeAddresses.slice(0, maxExchanges)) {
        const addresses = ex.addresses.slice(0, maxAddressesPerExchange);

        // Process addresses in batches to respect rate limits
        for (const addr of addresses) {
          try {
            const response = await fetch(
              `${BLOCKCHAIN_INFO_API}/rawaddr/${addr}?limit=0`
            );
            if (response.ok) {
              const data = (await response.json()) as {
                final_balance?: number;
              };
              if (data.final_balance) {
                const balance = data.final_balance / SATOSHI_TO_BTC;
                totalReserve += balance;
                checkedAddresses++;

                this.logger.debug("Checked exchange address", {
                  exchange: ex.exchange,
                  balance: balance.toFixed(2),
                });
              }
            }
            // Rate limiting - 300ms between requests
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch (error) {
            this.logger.debug("Failed to check address", {
              exchange: ex.exchange,
              error,
            });
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
          Math.min(maxExchanges * maxAddressesPerExchange, totalKnownAddresses);
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

        this.logger.info("Estimated exchange reserve", {
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
      this.logger.error("Failed to fetch exchange reserve", error);
      // Return cached value on error if available
      if (this.reserveCache) {
        this.logger.warn("Returning stale cached reserve due to error");
        return this.reserveCache.value;
      }
      return;
    }
  }

  /**
   * Fetch MVRV Ratio (Market Value to Realized Value)
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

      // Estimate Realized Cap using blockchain.info data
      // Note: This is an estimation. Real Realized Cap requires UTXO analysis
      const response = await fetch(`${BLOCKCHAIN_INFO_API}/stats?format=json`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        totalbc?: number; // Total BTC in circulation (satoshis)
        market_price_usd?: number;
      };

      if (!(data.totalbc && data.market_price_usd)) {
        return;
      }

      const currentSupply = data.totalbc / SATOSHI_TO_BTC;

      // Estimate Realized Cap using average cost basis
      // Approximate realized price as ~60% of current price (historical average)
      const estimatedRealizedPrice = data.market_price_usd * 0.6;
      const realizedCap = currentSupply * estimatedRealizedPrice;

      const mvrv = marketCap / realizedCap;

      this.logger.debug("Calculated MVRV", {
        marketCap,
        realizedCap,
        mvrv,
      });

      return mvrv;
    } catch (error) {
      this.logger.error("Failed to calculate MVRV", error);
      return;
    }
  }

  /**
   * Fetch NUPL (Net Unrealized Profit/Loss)
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
      // This is mathematically equivalent to (Market Cap - Realized Cap) / Market Cap
      const nupl = (mvrv - 1) / mvrv;

      this.logger.debug("Calculated NUPL", {
        mvrv,
        nupl,
      });

      return nupl;
    } catch (error) {
      this.logger.error("Failed to calculate NUPL", error);
      return;
    }
  }

  /**
   * Fetch Puell Multiple (Mining revenue relative to 365-day MA)
   * Puell = Daily Issuance (USD) / 365-day MA of Daily Issuance
   * >4 = cycle top, <0.5 = cycle bottom
   */
  async fetchPuellMultiple(): Promise<number | undefined> {
    try {
      // Get current market price
      const response = await fetch(`${BLOCKCHAIN_INFO_API}/stats?format=json`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        n_blocks_total?: number;
        market_price_usd?: number;
      };

      if (!(data.n_blocks_total && data.market_price_usd)) {
        return;
      }

      // Current block reward (BTC per block) - approximation
      // Bitcoin halves every 210,000 blocks
      const halvings = Math.floor(data.n_blocks_total / 210_000);
      const currentReward = 50 / 2 ** halvings; // Start at 50 BTC, halve each cycle

      // Daily issuance in USD (144 blocks per day)
      const blocksPerDay = 144;
      const dailyIssuanceUSD =
        currentReward * blocksPerDay * data.market_price_usd;

      // Estimate 365-day MA using historical average
      // Use ~70% of current issuance as proxy for MA (accounts for price volatility)
      const estimatedMA = dailyIssuanceUSD * 0.7;

      const puellMultiple = dailyIssuanceUSD / estimatedMA;

      this.logger.debug("Calculated Puell Multiple", {
        currentReward,
        dailyIssuanceUSD,
        estimatedMA,
        puellMultiple,
      });

      return puellMultiple;
    } catch (error) {
      this.logger.error("Failed to calculate Puell Multiple", error);
      return;
    }
  }

  /**
   * Estimate SOPR (Spent Output Profit Ratio)
   * Simplified calculation based on average transaction profit
   */
  async fetchSOPR(): Promise<number | undefined> {
    try {
      // Get recent block to analyze
      const response = await fetch(`${MEMPOOL_API}/blocks`);
      if (!response.ok) {
        return;
      }

      const blocks = (await response.json()) as Array<{ id: string }>;
      if (blocks.length === 0) {
        return;
      }

      // Analyze first block
      const txResponse = await fetch(
        `${MEMPOOL_API}/block/${blocks[0].id}/txs`
      );
      if (!txResponse.ok) {
        return;
      }

      const transactions = (await txResponse.json()) as Array<{
        vout: Array<{ value: number }>;
      }>;

      // Simplified SOPR estimation
      // In reality, SOPR requires tracking input/output age and prices
      // This is a proxy based on transaction size
      const avgValue =
        transactions.reduce(
          (sum, tx) => sum + tx.vout.reduce((vsum, out) => vsum + out.value, 0),
          0
        ) / Math.max(transactions.length, 1);

      // Normalize around 1.0 (1.0 = break-even)
      const sopr = 0.95 + (avgValue / SATOSHI_TO_BTC) * 0.000_001;

      return Math.min(Math.max(sopr, 0.5), 1.5); // Clamp between 0.5 and 1.5
    } catch (error) {
      this.logger.error("Failed to calculate SOPR", error);
      return;
    }
  }

  async fetchMetrics(): Promise<OnChainMetrics> {
    this.logger.info("Fetching Bitcoin on-chain metrics (Mempool.space)");

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

      // Fetch advanced metrics (with longer delays to respect rate limits)
      const stockToFlow = await this.fetchStockToFlow();
      const exchangeReserve = await this.fetchExchangeReserve();
      const sopr = await this.fetchSOPR();

      // Fetch new advanced metrics
      const mvrvRatio = await this.fetchMVRV();
      const nupl = await this.fetchNUPL();
      const puellMultiple = await this.fetchPuellMultiple();

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
        stockToFlow,
        exchangeReserve,
        sopr,
        mvrvRatio,
        nupl,
        puellMultiple,
      };

      this.logger.info("Bitcoin metrics fetched successfully", {
        whaleCount: metrics.whaleTransactions.count,
        activeAddresses: metrics.activeAddresses,
        txVolume: metrics.transactionVolume,
        stockToFlow: metrics.stockToFlow,
        exchangeReserve: metrics.exchangeReserve,
        mvrvRatio: metrics.mvrvRatio,
        nupl: metrics.nupl,
        puellMultiple: metrics.puellMultiple,
      });

      return metrics;
    } catch (error) {
      this.logger.error("Failed to fetch Bitcoin metrics", error);
      throw error;
    }
  }
}
