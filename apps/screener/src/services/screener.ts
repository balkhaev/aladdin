import {
  BaseService,
  type BaseServiceConfig,
} from "@aladdin/shared/base-service";
import { ScreenerQueue } from "../queue/screener-queue";

// Constants
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_IN_MINUTE * MS_IN_SECOND;
const SCREENING_INTERVAL_MINUTES = 15;
const DEFAULT_TIMEFRAME = "15m";

type ScreenerServiceConfig = BaseServiceConfig & { redisUrl: string };

/**
 * Screener Service - автоматический скрининг криптовалют
 */
export class ScreenerService extends BaseService {
  private screenerQueue?: ScreenerQueue;
  private screeningInterval?: Timer;
  private readonly redisUrl: string;
  private readonly intervalMs: number;

  constructor(config: ScreenerServiceConfig) {
    super(config);
    this.redisUrl = config.redisUrl;
    this.intervalMs = SCREENING_INTERVAL_MINUTES * MINUTES_TO_MS;
  }

  getServiceName(): string {
    return "screener";
  }

  /**
   * Initialize service and start automatic screening
   */
  protected onInitialize(): Promise<void> {
    // Create queue and worker
    this.screenerQueue = new ScreenerQueue(this.logger, this.redisUrl);
    this.logger.info("Screener queue initialized");

    // Start automatic screening
    this.startAutoScreening();
    return Promise.resolve();
  }

  /**
   * Stop service and cleanup
   */
  protected async onStop(): Promise<void> {
    // Stop interval
    if (this.screeningInterval) {
      clearInterval(this.screeningInterval);
      this.screeningInterval = undefined;
    }

    // Close queue
    if (this.screenerQueue) {
      await this.screenerQueue.close();
      this.screenerQueue = undefined;
    }
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      queue: this.screenerQueue !== undefined,
      autoScreening: this.screeningInterval !== undefined,
    });
  }

  /**
   * Start automatic screening
   */
  private startAutoScreening(): void {
    if (!this.screenerQueue) {
      throw new Error("Screener queue not initialized");
    }

    this.logger.info("Starting automatic screening", {
      intervalMinutes: SCREENING_INTERVAL_MINUTES,
    });

    // Run immediately on start
    this.screenerQueue
      .runFullScreening(DEFAULT_TIMEFRAME)
      .then((result) => {
        this.logger.info("Initial screening started", result);
      })
      .catch((error) => {
        this.logger.error("Failed to start initial screening", error);
      });

    // Then every 15 minutes
    this.screeningInterval = setInterval(() => {
      this.logger.info("Running scheduled screening");
      this.screenerQueue
        ?.runFullScreening(DEFAULT_TIMEFRAME)
        .then((result) => {
          this.logger.info("Scheduled screening started", result);
        })
        .catch((error) => {
          this.logger.error("Failed to start scheduled screening", error);
        });
    }, this.intervalMs);
  }

  /**
   * Run screening manually
   */
  async runScreening(timeframe: string = DEFAULT_TIMEFRAME) {
    if (!this.screenerQueue) {
      throw new Error("Screener queue not initialized");
    }

    return await this.screenerQueue.runFullScreening(timeframe);
  }

  /**
   * Get screening results
   */
  getResults(limit: number) {
    if (!this.screenerQueue) {
      throw new Error("Screener queue not initialized");
    }

    return this.screenerQueue.getResults(limit);
  }

  /**
   * Get top signals by recommendation
   */
  getTopSignals(
    recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL",
    limit: number
  ) {
    if (!this.screenerQueue) {
      throw new Error("Screener queue not initialized");
    }

    return this.screenerQueue.getTopSignals(recommendation, limit);
  }

  /**
   * Get queue statistics
   */
  getStats() {
    if (!this.screenerQueue) {
      throw new Error("Screener queue not initialized");
    }

    return this.screenerQueue.getStats();
  }

  /**
   * Clear queue
   */
  clearQueue() {
    if (!this.screenerQueue) {
      throw new Error("Screener queue not initialized");
    }

    return this.screenerQueue.clear();
  }
}
