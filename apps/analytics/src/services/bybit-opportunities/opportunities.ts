/**
 * Opportunities Service
 * Main service that manages subscriptions, analysis, and opportunity detection
 */

import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";

type NatsClient = {
  publish: (subject: string, data: unknown) => Promise<void>;
};

import { BybitFuturesConnector } from "./connectors/bybit-futures";
import { MLIntegrationService } from "./ml-integration";
import { MomentumAnalyzer } from "./momentum-analyzer";
import { OpportunityStorageService } from "./opportunity-storage";
import { ScoringEngine } from "./scoring-engine";
import { TechnicalAnalyzer } from "./technical-analyzer";
import type { PriceData, TradingOpportunity } from "./types";

// Bybit opportunities config
const BYBIT_CONFIG = {
  WS_URL: process.env.BYBIT_WS_URL || "wss://stream.bybit.com/v5/public/linear",
  API_URL: process.env.BYBIT_API_URL || "https://api.bybit.com",
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || "http://localhost:3013",
  ANALYSIS_INTERVAL_MS: process.env.ANALYSIS_INTERVAL_MS
    ? Number(process.env.ANALYSIS_INTERVAL_MS)
    : 30_000,
  MIN_CANDLES_FOR_ANALYSIS: process.env.MIN_CANDLES_FOR_ANALYSIS
    ? Number(process.env.MIN_CANDLES_FOR_ANALYSIS)
    : 100,
  SCORE_THRESHOLD_BUY: process.env.SCORE_THRESHOLD_BUY
    ? Number(process.env.SCORE_THRESHOLD_BUY)
    : 60,
  SCORE_THRESHOLD_SELL: process.env.SCORE_THRESHOLD_SELL
    ? Number(process.env.SCORE_THRESHOLD_SELL)
    : 40,
  ML_CONFIDENCE_THRESHOLD: process.env.ML_CONFIDENCE_THRESHOLD
    ? Number(process.env.ML_CONFIDENCE_THRESHOLD)
    : 70,
  BUFFER_SIZE: process.env.BUFFER_SIZE ? Number(process.env.BUFFER_SIZE) : 1000,
  MIN_VOLUME_USD: process.env.MIN_VOLUME_USD
    ? Number(process.env.MIN_VOLUME_USD)
    : 1_000_000,
} as const;

type SymbolBuffer = {
  priceData: PriceData[];
  lastAnalysis: number;
  lastPrice: number;
  volume24h: number;
};

export class OpportunitiesService {
  private connector: BybitFuturesConnector;
  private technicalAnalyzer: TechnicalAnalyzer;
  private momentumAnalyzer: MomentumAnalyzer;
  private scoringEngine: ScoringEngine;
  private mlIntegration: MLIntegrationService;
  private storage: OpportunityStorageService;
  private logger: Logger;
  private natsClient?: NatsClient;

  private symbolBuffers: Map<string, SymbolBuffer> = new Map();
  private analysisTimers: Map<string, Timer> = new Map();
  private serviceRunning = false;

  constructor(
    logger: Logger,
    clickhouse: ClickHouseClient,
    natsClient?: NatsClient
  ) {
    this.logger = logger;
    this.natsClient = natsClient;

    this.connector = new BybitFuturesConnector({
      logger,
      wsUrl: BYBIT_CONFIG.WS_URL,
      apiUrl: BYBIT_CONFIG.API_URL,
    });

    this.technicalAnalyzer = new TechnicalAnalyzer(logger);
    this.momentumAnalyzer = new MomentumAnalyzer(logger);
    this.scoringEngine = new ScoringEngine();
    this.mlIntegration = new MLIntegrationService(logger);
    this.storage = new OpportunityStorageService(clickhouse, logger);
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    if (this.serviceRunning) {
      this.logger.warn("Service already running");
      return;
    }

    this.serviceRunning = true;
    this.logger.info("Starting Bybit Opportunities service");

    // Connect to Bybit WebSocket
    await this.connector.connect();

    // Get all USDT perpetual symbols
    const symbols = await this.connector.getAllSymbols();
    this.logger.info("Fetched Bybit symbols", {
      total: symbols.length,
    });

    // Subscribe to all symbols
    for (const symbol of symbols) {
      this.subscribeToSymbol(symbol);
    }

    this.serviceRunning = true;
    this.logger.info("Bybit Opportunities service started", {
      symbols: symbols.length,
    });
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    if (!this.serviceRunning) {
      return;
    }

    this.logger.info("Stopping Bybit Opportunities service");

    // Stop all analysis timers
    for (const timer of this.analysisTimers.values()) {
      clearInterval(timer);
    }
    this.analysisTimers.clear();

    // Disconnect from WebSocket
    await this.connector.disconnect();

    this.serviceRunning = false;
    this.logger.info("Bybit Opportunities service stopped");
  }

  /**
   * Subscribe to symbol and setup analysis
   */
  private subscribeToSymbol(symbol: string): void {
    // Initialize buffer for symbol
    if (!this.symbolBuffers.has(symbol)) {
      this.symbolBuffers.set(symbol, {
        priceData: [],
        lastAnalysis: 0,
        lastPrice: 0,
        volume24h: 0,
      });
    }

    // Register ticker handler
    this.connector.onTick((sym: string, data) => {
      if (sym === symbol) {
        // Use turnover24h (USD volume) instead of volume24h (base volume)
        const volumeUSD = Number.parseFloat(
          data.turnover24h || data.volume24h || "0"
        );

        // Debug log first few ticks to verify data
        if (Math.random() < 0.001) {
          // Log ~0.1% of ticks
          this.logger.debug("Ticker data received", {
            symbol,
            lastPrice: data.lastPrice,
            volume24h: data.volume24h,
            turnover24h: data.turnover24h,
            volumeUSD,
          });
        }

        const priceData: PriceData = {
          timestamp: Date.now(),
          price: Number.parseFloat(data.lastPrice || "0"),
          volume: volumeUSD,
          high: Number.parseFloat(data.highPrice24h || "0"),
          low: Number.parseFloat(data.lowPrice24h || "0"),
        };
        this.handleTick(symbol, priceData);
      }
    });

    // Subscribe via connector
    this.connector.subscribe(symbol);

    // Setup periodic analysis timer
    const timer = setInterval(() => {
      this.analyzeSymbol(symbol).catch((error) => {
        this.logger.error("Analysis failed", { symbol, error });
      });
    }, BYBIT_CONFIG.ANALYSIS_INTERVAL_MS);

    this.analysisTimers.set(symbol, timer);
  }

  /**
   * Handle ticker update
   */
  private handleTick(symbol: string, priceData: PriceData): void {
    const buffer = this.symbolBuffers.get(symbol);
    if (!buffer) {
      return;
    }

    // Add to buffer
    buffer.priceData.push(priceData);
    buffer.lastPrice = priceData.price;
    buffer.volume24h = priceData.volume;

    // Keep buffer size manageable
    if (buffer.priceData.length > BYBIT_CONFIG.BUFFER_SIZE) {
      buffer.priceData.shift();
    }
  }

  /**
   * Analyze symbol for trading opportunities
   */
  private async analyzeSymbol(symbol: string): Promise<void> {
    const buffer = this.symbolBuffers.get(symbol);
    if (!buffer) {
      return;
    }

    // Check if we have enough data
    if (buffer.priceData.length < BYBIT_CONFIG.MIN_CANDLES_FOR_ANALYSIS) {
      return;
    }

    // Check volume threshold
    if (buffer.volume24h < BYBIT_CONFIG.MIN_VOLUME_USD) {
      return;
    }

    // Prevent too frequent analysis
    const now = Date.now();
    if (now - buffer.lastAnalysis < BYBIT_CONFIG.ANALYSIS_INTERVAL_MS) {
      return;
    }
    buffer.lastAnalysis = now;

    try {
      this.logger.debug("Analyzing symbol", {
        symbol,
        dataPoints: buffer.priceData.length,
        volume24h: buffer.volume24h,
      });

      // Calculate technical indicators
      const technicalIndicators = this.technicalAnalyzer.calculateIndicators(
        buffer.priceData
      );
      if (!technicalIndicators) {
        return;
      }

      const technicalScore =
        this.technicalAnalyzer.calculateScore(technicalIndicators);

      // Calculate momentum metrics
      const momentumMetrics = this.momentumAnalyzer.calculateMomentum(
        buffer.priceData
      );
      if (!momentumMetrics) {
        return;
      }

      const momentumScore =
        this.momentumAnalyzer.calculateScore(momentumMetrics);

      // Get ML anomalies (graceful degradation if unavailable)
      const mlAnomalies = await this.mlIntegration.getAnomalies(symbol);

      // Calculate combined score
      const score = this.scoringEngine.calculateScore({
        technicalScore,
        momentumScore,
        mlAnomalies,
        technicalIndicators,
        momentumMetrics,
      });

      // Check if this is a valid opportunity
      if (!this.scoringEngine.isValidOpportunity(score)) {
        return;
      }

      // Create opportunity object
      const opportunity: TradingOpportunity = {
        timestamp: now,
        symbol,
        exchange: "bybit",
        opportunityType: score.signal,
        totalScore: score.total,
        technicalScore: score.technical,
        momentumScore: score.momentum,
        mlConfidence: score.mlConfidence,
        strength: score.strength,
        confidence: score.confidence,
        price: buffer.lastPrice,
        volume24h: buffer.volume24h,
        indicators: technicalIndicators,
        momentum: momentumMetrics,
        anomalies: mlAnomalies,
        metadata: {
          macdHistogram: technicalIndicators.macdHistogram,
          rsi: technicalIndicators.rsi,
        },
      };

      this.logger.info("Trading opportunity detected", {
        symbol,
        signal: score.signal,
        totalScore: score.total,
        strength: score.strength,
        confidence: score.confidence,
      });

      // Publish to NATS
      await this.publishOpportunity(opportunity);

      // Store in ClickHouse
      await this.storage.storeOpportunity(opportunity);
    } catch (error) {
      this.logger.error("Failed to analyze symbol", { symbol, error });
    }
  }

  /**
   * Publish opportunity to NATS
   */
  private async publishOpportunity(
    opportunity: TradingOpportunity
  ): Promise<void> {
    if (!this.natsClient) {
      this.logger.warn("NATS client not available, skipping publish");
      return;
    }

    try {
      // Publish to all opportunities
      await this.natsClient.publish("opportunities.bybit.all", opportunity);

      // Publish by signal type
      await this.natsClient.publish(
        `opportunities.bybit.${opportunity.opportunityType.toLowerCase()}`,
        opportunity
      );

      // Publish strong signals separately
      if (opportunity.totalScore > 80 || opportunity.totalScore < 20) {
        await this.natsClient.publish(
          "opportunities.alert.strong",
          opportunity
        );
      }

      // Publish symbol-specific
      await this.natsClient.publish(
        `opportunities.bybit.${opportunity.symbol}`,
        opportunity
      );

      this.logger.debug("Published opportunity to NATS", {
        symbol: opportunity.symbol,
        signal: opportunity.opportunityType,
      });
    } catch (error) {
      this.logger.error("Failed to publish opportunity to NATS", {
        error,
        symbol: opportunity.symbol,
      });
    }
  }

  /**
   * Get recent opportunities
   */
  async getOpportunities(params: {
    limit?: number;
    minScore?: number;
    signal?: string;
    minConfidence?: number;
  }): Promise<TradingOpportunity[]> {
    return await this.storage.getRecentOpportunities(params);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    total: number;
    bySignal: Record<string, number>;
    byStrength: Record<string, number>;
  }> {
    return await this.storage.getStats();
  }

  /**
   * Get monitored symbols
   */
  getSymbols(): string[] {
    return Array.from(this.symbolBuffers.keys());
  }

  /**
   * Manually trigger analysis for a symbol
   */
  async analyzeSymbolManually(symbol: string): Promise<void> {
    await this.analyzeSymbol(symbol);
  }
}
