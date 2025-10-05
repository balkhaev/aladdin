import {
  BaseService,
  type BaseServiceConfig,
} from "@aladdin/shared/base-service";
import { getEnv, getEnvNumber } from "@aladdin/shared/config";
import type { AggTrade, Candle, Tick, Timeframe } from "@aladdin/shared/types";
import type { ExchangeConnector } from "../connectors/types";
import { CandleBuilderService } from "./candle-builder";
import { MarketDataService } from "./market-data";
import { MultiExchangeAggregator } from "./multi-exchange-aggregator";
import { OnChainService } from "./on-chain";

type MarketDataWrapperConfig = BaseServiceConfig & {
  connectors: {
    primary: ExchangeConnector;
    secondary?: ExchangeConnector[];
  };
};

/**
 * Market Data Service Wrapper - extends BaseService
 * Manages market data from multiple exchanges with aggregation
 */
export class MarketDataServiceWrapper extends BaseService {
  private marketDataService?: MarketDataService;
  private aggregator?: MultiExchangeAggregator;
  private candleBuilder?: CandleBuilderService;
  private onChainService?: OnChainService;
  private readonly primaryConnector: ExchangeConnector;
  private readonly secondaryConnectors: ExchangeConnector[];

  constructor(config: MarketDataWrapperConfig) {
    super(config);
    this.primaryConnector = config.connectors.primary;
    this.secondaryConnectors = config.connectors.secondary ?? [];
  }

  getServiceName(): string {
    return "market-data";
  }

  /**
   * Expose ClickHouse client for macro and on-chain routes
   */
  get clickhouseClient() {
    return this.clickhouse;
  }

  protected async onInitialize(): Promise<void> {
    if (!this.natsClient) {
      throw new Error("NATS client is required for Market Data Service");
    }
    if (!this.clickhouse) {
      throw new Error("ClickHouse client is required for Market Data Service");
    }

    // Initialize Multi-Exchange Aggregator
    this.aggregator = new MultiExchangeAggregator(this.clickhouse, this.logger);
    this.aggregator.start();

    // Initialize Market Data Service (primary connector)
    this.marketDataService = new MarketDataService({
      logger: this.logger,
      natsClient: this.natsClient,
      clickhouse: this.clickhouse,
      connector: this.primaryConnector,
    });

    // Call initialize synchronously (it's actually sync despite the name)
    this.marketDataService.initialize();

    // Connect all connectors to aggregator
    this.primaryConnector.on("tick", (tick: Tick) => {
      this.aggregator?.addTick(tick);
    });

    for (const connector of this.secondaryConnectors) {
      connector.on("tick", (tick: Tick) => {
        this.aggregator?.addTick(tick);
      });
    }

    // Initialize CandleBuilder service
    const timeframes: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
    this.candleBuilder = new CandleBuilderService({
      logger: this.logger,
      natsClient: this.natsClient,
      clickhouse: this.clickhouse,
      timeframes,
    });

    // Start CandleBuilder
    try {
      this.candleBuilder.start();
    } catch (error) {
      this.logger.error("Failed to start CandleBuilder", error);
      throw error;
    }

    // Initialize On-Chain Service if configured
    const enabledChains = getEnv("ENABLED_CHAINS", "");
    const etherscanApiKey = getEnv("ETHERSCAN_API_KEY", "");
    const cmcApiKey = getEnv("CMC_API_KEY", "");

    if (enabledChains && etherscanApiKey && cmcApiKey) {
      this.logger.info("Initializing On-Chain Service", { enabledChains });

      this.onChainService = new OnChainService({
        logger: this.logger,
        natsClient: this.natsClient,
        clickhouse: this.clickhouse,
        cmcApiKey,
        etherscanApiKey,
        blockchairApiKey: getEnv("BLOCKCHAIR_API_KEY", ""),
        enabledChains,
        updateIntervalMs: getEnvNumber("ON_CHAIN_UPDATE_INTERVAL_MS", 300_000),
        whaleThresholdBTC: getEnvNumber("WHALE_THRESHOLD_BTC", 10),
        whaleThresholdETH: getEnvNumber("WHALE_THRESHOLD_ETH", 100),
      });

      await this.onChainService.initialize();
      await this.onChainService.start();

      this.logger.info("On-Chain Service started successfully");
    } else {
      this.logger.warn(
        "On-Chain Service not configured - missing API keys or chains",
        {
          hasChains: !!enabledChains,
          hasEtherscan: !!etherscanApiKey,
          hasCMC: !!cmcApiKey,
        }
      );
    }

    this.logger.info("Market Data Service initialized");
    return Promise.resolve();
  }

  protected async onStop(): Promise<void> {
    if (this.onChainService) {
      await this.onChainService.stop();
    }
    if (this.candleBuilder) {
      await this.candleBuilder.stop();
    }
    if (this.marketDataService) {
      await this.marketDataService.stop();
    }
    if (this.aggregator) {
      this.aggregator.stop();
    }

    // Disconnect secondary connectors
    for (const connector of this.secondaryConnectors) {
      await connector.disconnect();
    }
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {
      marketData: this.marketDataService !== undefined,
      aggregator: this.aggregator !== undefined,
      onChain: this.onChainService !== undefined,
      primaryConnector: true, // Always true if initialized
    };

    // Check secondary connectors
    for (let i = 0; i < this.secondaryConnectors.length; i++) {
      health[`secondaryConnector${i}`] = true;
    }

    return Promise.resolve(health);
  }

  // Proxy methods to MarketDataService
  getMarketDataService(): MarketDataService {
    if (!this.marketDataService) {
      throw new Error("Market Data Service not initialized");
    }
    return this.marketDataService;
  }

  getAggregator(): MultiExchangeAggregator {
    if (!this.aggregator) {
      throw new Error("Aggregator not initialized");
    }
    return this.aggregator;
  }

  // Direct proxy methods for convenience
  subscribeToSymbol(symbol: string): Promise<void> {
    return this.getMarketDataService().subscribeToSymbol(symbol);
  }

  subscribeToSymbols(symbols: string[]): Promise<void> {
    return this.getMarketDataService().subscribeToSymbols(symbols);
  }

  unsubscribeFromSymbol(symbol: string): Promise<void> {
    return this.getMarketDataService().unsubscribeFromSymbol(symbol);
  }

  getAvailableTickers(): string[] {
    return this.getMarketDataService().getAvailableTickers();
  }

  getQuote(symbol: string): Tick | null {
    return this.getMarketDataService().getQuote(symbol);
  }

  getConnector(): ExchangeConnector {
    return this.getMarketDataService().getConnector();
  }

  onTick(callback: (tick: Tick) => void): void {
    this.getMarketDataService().onTick(callback);
  }

  offTick(callback: (tick: Tick) => void): void {
    this.getMarketDataService().offTick(callback);
  }

  onCandle(callback: (candle: Candle) => void): void {
    this.getMarketDataService().onCandle(callback);
  }

  offCandle(callback: (candle: Candle) => void): void {
    this.getMarketDataService().offCandle(callback);
  }

  onAggTrade(callback: (aggTrade: AggTrade) => void): void {
    this.getMarketDataService().onAggTrade(callback);
  }

  offAggTrade(callback: (aggTrade: AggTrade) => void): void {
    this.getMarketDataService().offAggTrade(callback);
  }

  getCandles(
    symbol: string,
    timeframe: string,
    limit?: number
  ): Promise<Candle[]> {
    return this.getMarketDataService().getCandles(symbol, timeframe, limit);
  }

  getRecentTicks(symbol: string, limit?: number): Promise<Tick[]> {
    return this.getMarketDataService().getRecentTicks(symbol, limit);
  }

  // Aggregator proxy methods
  getAggregatedPrices(symbols: string[], limit?: number) {
    return this.getAggregator().getAggregatedPrices(symbols, limit);
  }

  getArbitrageOpportunities(minSpreadPercent?: number, limit?: number) {
    return this.getAggregator().getArbitrageOpportunities(
      minSpreadPercent,
      limit
    );
  }

  // Secondary connectors access
  getSecondaryConnectors(): ExchangeConnector[] {
    return this.secondaryConnectors;
  }
}
