import { BaseService, type BaseServiceConfig } from "@aladdin/service";
import {
  AlgorithmicExecutor,
  type ExecutionParams,
  type ExecutionSchedule,
  type ExecutionState,
  type VolumeProfile,
} from "./algorithmic-executor";
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
const DEFAULT_CONFIDENCE = 0.7;
const SENTIMENT_SHIFT_THRESHOLD = 0.5;
const HIGH_CONFIDENCE_SHIFT = 0.7;
const MILLISECONDS_TO_SECONDS = 1000;

export type ExecutorConfig = {
  mode: "PAPER" | "LIVE";
  maxOpenPositions: number;
  userId: string;
  portfolioId: string;
  exchangeCredentialsId: string;
  autoExecute: boolean;
  enableAlgorithmicExecution?: boolean;
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
  activeAlgorithmicExecutions: number;
};

/**
 * Strategy Executor - main execution engine
 * Subscribes to trading signals and automatically executes orders
 * Supports algorithmic execution strategies (VWAP, TWAP, Iceberg)
 */
export class StrategyExecutor extends BaseService {
  private signalProcessor: SignalProcessor;
  private orderManager: OrderManager;
  private algorithmicExecutor: AlgorithmicExecutor;
  private config: ExecutorConfig;
  private stats: ExecutorStats;
  private pendingSignals: ProcessedSignal[] = [];
  private activeExecutions: Map<string, ExecutionState> = new Map();

  constructor(deps: BaseServiceConfig, config?: Partial<ExecutorConfig>) {
    super(deps);

    this.config = {
      mode: config?.mode || "PAPER",
      maxOpenPositions: config?.maxOpenPositions || DEFAULT_MAX_OPEN_POSITIONS,
      userId: config?.userId || "",
      portfolioId: config?.portfolioId || "",
      exchangeCredentialsId: config?.exchangeCredentialsId || "",
      autoExecute: config?.autoExecute ?? true,
      enableAlgorithmicExecution: config?.enableAlgorithmicExecution ?? true,
    };

    this.signalProcessor = new SignalProcessor(this.logger);
    this.orderManager = new OrderManager(this.logger, this.config.mode);
    this.algorithmicExecutor = new AlgorithmicExecutor(this.logger);

    this.stats = {
      totalSignalsReceived: 0,
      totalSignalsProcessed: 0,
      totalOrdersExecuted: 0,
      totalOrdersSuccessful: 0,
      totalOrdersFailed: 0,
      mode: this.config.mode,
      autoExecute: this.config.autoExecute,
      currentOpenPositions: 0,
      activeAlgorithmicExecutions: 0,
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
  private handleScreenerSignal(data: string): void {
    try {
      const event = JSON.parse(data);
      const signal: TradingSignal = {
        symbol: event.data.symbol,
        recommendation: event.data.recommendation,
        confidence: event.data.confidence || DEFAULT_CONFIDENCE,
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
  private handleSentimentAnalysis(data: string): void {
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
  private handleSentimentShift(data: string): void {
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
      intervalSeconds: SIGNAL_PROCESSING_INTERVAL_MS / MILLISECONDS_TO_SECONDS,
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

    // Get effective credentials ID
    let credentialsId: string;
    try {
      credentialsId = await this.getEffectiveCredentialsId();
    } catch (error) {
      this.logger.error("Failed to get credentials for signal execution", {
        error: error instanceof Error ? error.message : String(error),
      });
      this.pendingSignals = [];
      return;
    }

    // Execute orders for filtered signals
    const results: OrderResult[] = [];

    for (const signal of filtered) {
      const result = await this.orderManager.executeOrder(
        signal,
        this.config.userId,
        this.config.portfolioId,
        credentialsId
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
   * Get effective credentials ID (from config or user's active key)
   */
  private async getEffectiveCredentialsId(): Promise<string> {
    // If exchangeCredentialsId is set in config, use it
    if (this.config.exchangeCredentialsId) {
      return this.config.exchangeCredentialsId;
    }

    // Otherwise, get user's active exchange credentials
    if (!this.config.userId) {
      throw new Error("No userId configured for executor");
    }

    if (!this.prisma) {
      throw new Error("Prisma client not available");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: this.config.userId },
      select: { activeExchangeCredentialsId: true },
    });

    if (!user?.activeExchangeCredentialsId) {
      throw new Error(
        "No active exchange credentials set for user. Please select an active API key in settings."
      );
    }

    return user.activeExchangeCredentialsId;
  }

  /**
   * Manually execute a specific signal (for testing)
   */
  async manualExecute(signal: ProcessedSignal): Promise<OrderResult> {
    this.logger.info("Manual execution requested", { signal });

    const credentialsId = await this.getEffectiveCredentialsId();

    const result = await this.orderManager.executeOrder(
      signal,
      this.config.userId,
      this.config.portfolioId,
      credentialsId
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

  /**
   * Execute order using algorithmic strategy (VWAP, TWAP, or Iceberg)
   */
  async executeAlgorithmic(
    params: ExecutionParams,
    volumeProfile?: VolumeProfile
  ): Promise<{
    executionId: string;
    schedule: ExecutionSchedule;
  }> {
    if (!this.config.enableAlgorithmicExecution) {
      throw new Error("Algorithmic execution is disabled");
    }

    this.logger.info("Creating algorithmic execution", {
      symbol: params.symbol,
      strategy: params.strategy,
      quantity: params.totalQuantity,
    });

    // Calculate schedule based on strategy
    let schedule: ExecutionSchedule;

    switch (params.strategy) {
      case "VWAP": {
        schedule = this.algorithmicExecutor.calculateVWAPSchedule(
          params,
          volumeProfile || []
        );
        break;
      }
      case "TWAP": {
        schedule = this.algorithmicExecutor.calculateTWAPSchedule(params);
        break;
      }
      case "ICEBERG": {
        schedule = this.algorithmicExecutor.calculateIcebergSchedule(params);
        break;
      }
      default: {
        throw new Error(`Unknown strategy: ${params.strategy}`);
      }
    }

    // Create execution state
    const execution = this.algorithmicExecutor.createExecution(schedule);
    const executionId = `${params.symbol}-${Date.now()}`;

    this.activeExecutions.set(executionId, execution);
    this.stats.activeAlgorithmicExecutions = this.activeExecutions.size;

    // Publish execution created event
    await this.natsClient?.publish(
      "trading.execution.created",
      JSON.stringify({
        type: "trading.execution.created",
        data: {
          executionId,
          symbol: params.symbol,
          strategy: params.strategy,
          totalQuantity: params.totalQuantity,
          slices: schedule.slices.length,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        timestamp: new Date().toISOString(),
      })
    );

    this.logger.info("Algorithmic execution created", {
      executionId,
      slices: schedule.slices.length,
    });

    return { executionId, schedule };
  }

  /**
   * Update execution progress (called as slices are filled)
   */
  async updateExecutionProgress(
    executionId: string,
    update: {
      sliceIndex: number;
      filled: number;
      price?: number;
    }
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    this.algorithmicExecutor.updateExecutionProgress(execution, update);

    // Publish progress event
    await this.natsClient?.publish(
      "trading.execution.progress",
      JSON.stringify({
        type: "trading.execution.progress",
        data: {
          executionId,
          status: execution.status,
          filled: execution.filled,
          remaining: execution.remaining,
          completion: execution.filled / execution.schedule.totalQuantity,
        },
        timestamp: new Date().toISOString(),
      })
    );

    // If completed, clean up
    if (execution.status === "COMPLETED" || execution.status === "FAILED") {
      this.activeExecutions.delete(executionId);
      this.stats.activeAlgorithmicExecutions = this.activeExecutions.size;

      await this.natsClient?.publish(
        "trading.execution.completed",
        JSON.stringify({
          type: "trading.execution.completed",
          data: {
            executionId,
            status: execution.status,
            filled: execution.filled,
            failedSlices: execution.failedSlices.length,
          },
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  /**
   * Get execution state
   */
  getExecution(executionId: string): ExecutionState | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): Map<string, ExecutionState> {
    return new Map(this.activeExecutions);
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.status = "FAILED";
    this.activeExecutions.delete(executionId);
    this.stats.activeAlgorithmicExecutions = this.activeExecutions.size;

    await this.natsClient?.publish(
      "trading.execution.cancelled",
      JSON.stringify({
        type: "trading.execution.cancelled",
        data: {
          executionId,
          filled: execution.filled,
          remaining: execution.remaining,
        },
        timestamp: new Date().toISOString(),
      })
    );

    this.logger.info("Execution cancelled", { executionId });
  }
}
