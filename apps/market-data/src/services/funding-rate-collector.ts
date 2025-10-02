import type { Logger } from "@aladdin/shared/logger";
import type { FundingRateService } from "./funding-rate-service";

// Constants
const DEFAULT_INTERVAL_MS = 3_600_000; // 1 hour
const MS_PER_MINUTE = 60_000;
const EXTREME_THRESHOLD = 0.001; // 0.1%
const HUNDRED = 100;
const FUNDING_RATE_PRECISION = 4;

export class FundingRateCollector {
  private running = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private fundingRateService: FundingRateService,
    private logger: Logger
  ) {}

  /**
   * Start collecting funding rates
   */
  start(
    symbols: string[],
    exchanges: string[],
    intervalMs = DEFAULT_INTERVAL_MS
  ): void {
    if (this.running) {
      this.logger.warn("Funding rate collector already running");
      return;
    }

    this.running = true;
    this.logger.info("Starting funding rate collector", {
      symbols,
      exchanges,
      intervalMs,
      collectionsPerHour: Math.floor((MS_PER_MINUTE * 60) / intervalMs),
    });

    for (const symbol of symbols) {
      for (const exchange of exchanges) {
        const key = `${symbol}-${exchange}`;

        // Collect data immediately on start
        const collectData = async () => {
          try {
            const data = await this.fundingRateService.getFundingRate(
              symbol,
              exchange
            );
            await this.fundingRateService.saveFundingRate(data);

            // Log significant funding rates
            if (Math.abs(data.fundingRate) > EXTREME_THRESHOLD) {
              this.logger.info("💰 Extreme funding rate detected", {
                symbol,
                exchange,
                rate: `${(data.fundingRate * HUNDRED).toFixed(FUNDING_RATE_PRECISION)}%`,
                sentiment: data.sentiment,
                signal: data.signal,
              });
            }

            // Log sentiment changes
            if (data.sentiment !== "NEUTRAL") {
              this.logger.debug("Funding rate signal", {
                symbol,
                exchange,
                rate: `${(data.fundingRate * HUNDRED).toFixed(FUNDING_RATE_PRECISION)}%`,
                sentiment: data.sentiment,
              });
            }
          } catch (error) {
            this.logger.error("Failed to collect funding rate", {
              symbol,
              exchange,
              error: error.message,
            });
          }
        };

        // Execute immediately
        collectData();

        // Then schedule periodic collection
        const interval = setInterval(collectData, intervalMs);

        this.intervals.set(key, interval);
      }
    }

    this.logger.info("Funding rate collector started successfully", {
      totalCollectors: this.intervals.size,
    });
  }

  /**
   * Stop collecting
   */
  stop(): void {
    this.logger.info("Stopping funding rate collector");

    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      this.logger.debug("Cleared interval", { key });
    }

    this.intervals.clear();
    this.running = false;

    this.logger.info("Funding rate collector stopped");
  }

  /**
   * Get collector status
   */
  getStatus(): {
    running: boolean;
    activeCollectors: number;
    collectors: string[];
  } {
    return {
      running: this.running,
      activeCollectors: this.intervals.size,
      collectors: Array.from(this.intervals.keys()),
    };
  }
}
