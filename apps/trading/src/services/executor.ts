import {
  BaseService,
  type BaseServiceConfig,
} from "@aladdin/shared/base-service";
import { OrderManager, type OrderResult } from "./order-manager";
import {
  type ProcessedSignal,
  SignalProcessor,
  type TradingSignal,
} from "./signal-processor";

const DEFAULT_MAX_OPEN_POSITIONS = 5;
const SIGNAL_PROCESSING_INTERVAL_MS = 10_000; // 10 seconds
const MIN_STRONG_SENTIMENT = 0.6;
const MIN_CONFIDENCE_FOR_SIGNAL = 0.7;
const SENTIMENT_SHIFT_THRESHOLD = 0.5;
const HIGH_CONFIDENCE_SHIFT = 0.7;

export type ExecutorConfig = {
  mode: "PAPER" | "LIVE";
  maxOpenPositions: number;
  defaultUserId: string;
  defaultPortfolioId: string;
  defaultExchange: string;
  autoExecute: boolean;
};

export type ExecutorStats = {
  totalSignalsReceived: number;
  totalSignalsProcessed: number;
  totalOrdersExecuted: number;
  totalOrdersSuccessful: number;
  totalOrdersFailed: number;
  mode: "PAPER" | "LIVE";
  autoExecute: boolean;
  currentOpenPositions: number;
};

/**
 * Strategy Executor - main execution engine
 * Subscribes to trading signals and automatically executes orders
 */
export class StrategyExecutor extends BaseService {
  private signalProcessor: SignalProcessor;
  private orderManager: OrderManager;
  private config: ExecutorConfig;
  private stats: ExecutorStats;
  private pendingSignals: ProcessedSignal[] = [];

  constructor(deps: BaseServiceConfig, config?: Partial<ExecutorConfig>) {
    super(deps);

    this.config = {
      mode: config?.mode || "PAPER",
      maxOpenPositions: config?.maxOpenPositions || DEFAULT_MAX_OPEN_POSITIONS,
      defaultUserId: config?.defaultUserId || "",
      defaultPortfolioId: config?.defaultPortfolioId || "",
      defaultExchange: config?.defaultExchange || "binance",
      autoExecute: config?.autoExecute ?? true,
    };

    this.signalProcessor = new SignalProcessor(this.logger);
    this.orderManager = new OrderManager(this.logger, this.config.mode);

    this.stats = {
      totalSignalsReceived: 0,
      totalSignalsProcessed: 0,
      totalOrdersExecuted: 0,
      totalOrdersSuccessful: 0,
      totalOrdersFailed: 0,
      mode: this.config.mode,
      autoExecute: this.config.autoExecute,
      currentOpenPositions: 0,
    };
  }

  getServiceName(): string {
    return "strategy-executor";
  }

  protected async onInitialize(): Promise<void> {
    if (!this.natsClient) {
      throw new Error("NATS client is required for Strategy Executor");
    }

    this.logger.info("Strategy Executor initialized", {
      mode: this.config.mode,
      maxOpenPositions: this.config.maxOpenPositions,
      autoExecute: this.config.autoExecute,
    });

    // Subscribe to screener signals
    await this.natsClient.subscribe(
      "screener.signal.*",
      this.handleScreenerSignal.bind(this)
    );

    // Subscribe to sentiment events
    await this.natsClient.subscribe(
      "sentiment.analysis",
      this.handleSentimentAnalysis.bind(this)
    );

    // Subscribe to sentiment shifts
    await this.natsClient.subscribe(
      "sentiment.shift",
      this.handleSentimentShift.bind(this)
    );

    this.logger.info("Subscribed to signal sources");

    // Start periodic processing of pending signals
    this.startPeriodicProcessing();
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      signalsProcessing: true,
      ordersExecuting: true,
    });
  }

  /**
   * Handle screener signal from NATS
   */
  private async handleScreenerSignal(data: string): Promise<void> {
    try {
      const event = JSON.parse(data);
      const signal: TradingSignal = {
        symbol: event.data.symbol,
        recommendation: event.data.recommendation,
        confidence: event.data.confidence || 0.7,
        indicators: event.data.indicators,
        source: "screener",
        timestamp: new Date(event.timestamp || Date.now()),
      };

      this.stats.totalSignalsReceived++;
      this.logger.info("Received screener signal", signal);

      // Process signal
      const processed = this.signalProcessor.processSignal(signal);
      this.stats.totalSignalsProcessed++;

      if (processed.shouldExecute) {
        this.pendingSignals.push(processed);
        this.logger.info("Signal queued for execution", {
          symbol: processed.symbol,
          reason: processed.reason,
        });
      } else {
        this.logger.debug("Signal filtered out", {
          symbol: processed.symbol,
          reason: processed.reason,
        });
      }
    } catch (error) {
      this.logger.error("Failed to handle screener signal", error);
    }
  }

  /**
   * Handle sentiment analysis from NATS
   */
  private async handleSentimentAnalysis(data: string): Promise<void> {
    try {
      const event = JSON.parse(data);
      const analysis = event.data;

      // Create signal from sentiment if strong
      if (
        Math.abs(analysis.overall) > MIN_STRONG_SENTIMENT &&
        analysis.confidence > MIN_CONFIDENCE_FOR_SIGNAL
      ) {
        const signal: TradingSignal = {
          symbol: analysis.symbol,
          recommendation: analysis.overall > 0 ? "BUY" : "SELL",
          confidence: analysis.confidence,
          sentiment: analysis.overall,
          source: "sentiment",
          timestamp: new Date(analysis.timestamp),
        };

        this.stats.totalSignalsReceived++;
        this.logger.info("Received sentiment signal", signal);

        const processed = this.signalProcessor.processSignal(signal);
        this.stats.totalSignalsProcessed++;

        if (processed.shouldExecute) {
          this.pendingSignals.push(processed);
        }
      }
    } catch (error) {
      this.logger.error("Failed to handle sentiment analysis", error);
    }
  }

  /**
   * Handle sentiment shift from NATS
   */
  private async handleSentimentShift(data: string): Promise<void> {
    try {
      const event = JSON.parse(data);
      const shift = event.data;

      this.logger.info("Sentiment shift detected", shift);

      // Strong shifts can trigger signals
      const isSignificantShift =
        shift.magnitude > SENTIMENT_SHIFT_THRESHOLD &&
        shift.confidence > HIGH_CONFIDENCE_SHIFT;

      if (isSignificantShift && shift.shift === "BULLISH") {
        const signal: TradingSignal = {
          symbol: shift.symbol,
          recommendation: "BUY",
          confidence: shift.confidence,
          sentiment: shift.currentScore,
          source: "sentiment",
          timestamp: new Date(shift.timestamp),
        };

        this.stats.totalSignalsReceived++;
        const processed = this.signalProcessor.processSignal(signal);
        this.stats.totalSignalsProcessed++;

        if (processed.shouldExecute) {
          this.pendingSignals.push(processed);
        }
      }
    } catch (error) {
      this.logger.error("Failed to handle sentiment shift", error);
    }
  }

  /**
   * Start periodic processing of pending signals
   */
  private startPeriodicProcessing(): void {
    setInterval(async () => {
      if (!this.config.autoExecute || this.pendingSignals.length === 0) {
        return;
      }

      try {
        await this.processPendingSignals();
      } catch (error) {
        this.logger.error("Failed to process pending signals", error);
      }
    }, SIGNAL_PROCESSING_INTERVAL_MS);

    this.logger.info("Started periodic signal processing", {
      intervalSeconds: SIGNAL_PROCESSING_INTERVAL_MS / 1000,
    });
  }

  /**
   * Process pending signals and execute orders
   */
  private async processPendingSignals(): Promise<void> {
    if (this.pendingSignals.length === 0) {
      return;
    }

    this.logger.info("Processing pending signals", {
      count: this.pendingSignals.length,
      currentOpenPositions: this.stats.currentOpenPositions,
    });

    // Filter by risk criteria
    const filtered = this.signalProcessor.filterByRisk(
      this.pendingSignals,
      this.config.maxOpenPositions,
      this.stats.currentOpenPositions
    );

    if (filtered.length === 0) {
      this.logger.debug("No signals passed risk filter");
      this.pendingSignals = [];
      return;
    }

    // Execute orders for filtered signals
    const results: OrderResult[] = [];

    for (const signal of filtered) {
      const result = await this.orderManager.executeOrder(
        signal,
        this.config.defaultUserId,
        this.config.defaultPortfolioId,
        this.config.defaultExchange
      );

      results.push(result);
      this.stats.totalOrdersExecuted++;

      if (result.success) {
        this.stats.totalOrdersSuccessful++;
        this.stats.currentOpenPositions++;

        // Publish execution event
        await this.natsClient?.publish(
          "strategy.order.executed",
          JSON.stringify({
            type: "strategy.order.executed",
            data: {
              ...result,
              mode: this.config.mode,
            },
          })
        );
      } else {
        this.stats.totalOrdersFailed++;
        this.logger.error("Order execution failed", {
          signal: signal.symbol,
          error: result.error,
        });
      }
    }

    // Clear pending signals
    this.pendingSignals = [];

    this.logger.info("Completed signal processing", {
      executed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });
  }

  /**
   * Get executor statistics
   */
  getStats(): ExecutorStats {
    return { ...this.stats };
  }

  /**
   * Get pending signals
   */
  getPendingSignals(): ProcessedSignal[] {
    return [...this.pendingSignals];
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ExecutorConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.mode) {
      this.orderManager.setMode(updates.mode);
      this.stats.mode = updates.mode;
    }

    if (updates.autoExecute !== undefined) {
      this.stats.autoExecute = updates.autoExecute;
    }

    this.logger.info("Executor configuration updated", updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutorConfig {
    return { ...this.config };
  }

  /**
   * Manually execute a specific signal (for testing)
   */
  async manualExecute(signal: ProcessedSignal): Promise<OrderResult> {
    this.logger.info("Manual execution requested", { signal });

    const result = await this.orderManager.executeOrder(
      signal,
      this.config.defaultUserId,
      this.config.defaultPortfolioId,
      this.config.defaultExchange
    );

    this.stats.totalOrdersExecuted++;
    if (result.success) {
      this.stats.totalOrdersSuccessful++;
      this.stats.currentOpenPositions++;
    } else {
      this.stats.totalOrdersFailed++;
    }

    return result;
  }
}
