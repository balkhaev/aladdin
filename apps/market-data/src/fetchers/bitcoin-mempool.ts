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

const MEMPOOL_API = "https://mempool.space/api";
const BLOCKCHAIN_INFO_API = "https://blockchain.info";
const SATOSHI_TO_BTC = 100_000_000;
const DEFAULT_WHALE_THRESHOLD = 10;
const MAX_BLOCKS_TO_CHECK = 15; // Increased from 3 to 15
const MILLISECONDS_IN_SECOND = 1000;
const ADDRESSES_PER_TX = 1.5;
const SECONDS_IN_DAY = 86_400;

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
        txVolume: metrics.transactionVolume,
      });

      return metrics;
    } catch (error) {
      this.logger.error("Failed to fetch Bitcoin metrics", error);
      throw error;
    }
  }
}
