import { BaseService, type BaseServiceConfig } from "@aladdin/service";
import { BitcoinFetcher } from "../fetchers/bitcoin";
import { BitcoinMempoolFetcher } from "../fetchers/bitcoin-mempool";
import { EthereumFetcher } from "../fetchers/ethereum";
import type { BlockchainFetcher } from "../fetchers/types";
import { MarketCapProvider } from "./market-cap-provider";
import { MetricsScheduler } from "./on-chain-scheduler";

const DEFAULT_WHALE_THRESHOLD_BTC = 10;
const DEFAULT_WHALE_THRESHOLD_ETH = 100;
const DEFAULT_UPDATE_INTERVAL = 300_000;

type OnChainServiceConfig = BaseServiceConfig & {
  cmcApiKey: string;
  enabledChains: string;
  updateIntervalMs?: number;
  whaleThresholdBTC?: number;
  whaleThresholdETH?: number;
  blockchairApiKey?: string;
  etherscanApiKey?: string;
};

/**
 * On-Chain Service - Blockchain metrics and analytics
 */
export class OnChainService extends BaseService {
  private scheduler?: MetricsScheduler;
  private marketCapProvider?: MarketCapProvider;
  private fetchers: BlockchainFetcher[] = [];
  private config: OnChainServiceConfig;

  constructor(config: OnChainServiceConfig) {
    super(config);
    this.config = config;
  }

  getServiceName(): string {
    return "on-chain";
  }

  protected async onInitialize(): Promise<void> {
    await Promise.resolve(); // Satisfy linter requirement for async/await

    if (!this.clickhouse) {
      throw new Error("ClickHouse is required for On-Chain Service");
    }

    if (!this.natsClient) {
      throw new Error("NATS client is required for On-Chain Service");
    }

    // Initialize market cap provider
    this.marketCapProvider = new MarketCapProvider(
      this.config.cmcApiKey,
      this.logger
    );

    // Initialize blockchain fetchers
    const enabledChains = this.config.enabledChains.split(",");
    this.logger.info("Initializing blockchain fetchers", {
      enabledChains: this.config.enabledChains,
      parsed: enabledChains,
    });

    for (const chain of enabledChains) {
      const trimmedChain = chain.trim().toUpperCase();
      this.logger.info("Processing chain", { chain, trimmedChain });

      if (trimmedChain === "BTC") {
        const whaleThreshold =
          this.config.whaleThresholdBTC ?? DEFAULT_WHALE_THRESHOLD_BTC;

        // Use Mempool.space fetcher (free, no API key) if no Blockchair API key
        const btcFetcher = this.config.blockchairApiKey
          ? new BitcoinFetcher(
              this.logger,
              whaleThreshold,
              () => this.marketCapProvider?.getMarketCap("BTC") ?? 0,
              () => this.marketCapProvider?.getPrice("BTC") ?? 0,
              this.config.blockchairApiKey
            )
          : new BitcoinMempoolFetcher(
              this.logger,
              whaleThreshold,
              () => this.marketCapProvider?.getMarketCap("BTC") ?? 0,
              () => this.marketCapProvider?.getPrice("BTC") ?? 0
            );

        this.fetchers.push(btcFetcher);
        this.logger.info("Bitcoin fetcher initialized", {
          whaleThreshold,
          source: this.config.blockchairApiKey ? "Blockchair" : "Mempool.space",
        });
      } else if (trimmedChain === "ETH") {
        const whaleThreshold =
          this.config.whaleThresholdETH ?? DEFAULT_WHALE_THRESHOLD_ETH;
        const ethFetcher = new EthereumFetcher(
          this.logger,
          this.config.etherscanApiKey ?? "",
          whaleThreshold,
          () => this.marketCapProvider?.getMarketCap("ETH") ?? 0,
          () => this.marketCapProvider?.getPrice("ETH") ?? 0
        );
        this.fetchers.push(ethFetcher);
        this.logger.info("Ethereum fetcher initialized", { whaleThreshold });
      }
    }

    if (this.fetchers.length === 0) {
      this.logger.warn("No blockchain fetchers initialized");
    }

    // Initialize scheduler
    const updateIntervalMs =
      this.config.updateIntervalMs ?? DEFAULT_UPDATE_INTERVAL;

    this.scheduler = new MetricsScheduler({
      logger: this.logger,
      natsClient: this.natsClient,
      clickhouse: this.clickhouse,
      fetchers: this.fetchers,
      updateIntervalMs,
    });

    this.logger.info("On-Chain Service initialized", {
      hasScheduler: !!this.scheduler,
      fetchersCount: this.fetchers.length,
      updateIntervalMs,
    });
  }

  protected async onStart(): Promise<void> {
    this.logger.info("onStart called", {
      hasScheduler: !!this.scheduler,
      hasFetchers: this.fetchers.length,
      hasClickhouse: !!this.clickhouse,
      hasNats: !!this.natsClient,
    });

    if (this.scheduler) {
      this.scheduler.start();
      this.logger.info("Metrics scheduler started");
    } else {
      this.logger.error("Scheduler not initialized!");
    }

    await Promise.resolve();
  }

  protected async onStop(): Promise<void> {
    if (this.scheduler) {
      this.scheduler.stop();
      this.logger.info("Metrics scheduler stopped");
    }

    await Promise.resolve();
  }

  protected async onHealthCheck(): Promise<Record<string, boolean>> {
    return await Promise.resolve({
      scheduler: this.scheduler !== undefined,
      marketCap: this.marketCapProvider !== undefined,
      fetchers: this.fetchers.length > 0,
    });
  }

  get clickhouseClient() {
    return this.clickhouse;
  }

  get metricsScheduler() {
    return this.scheduler;
  }
}
