import type { Logger } from "@aladdin/shared/logger";
import type { OpenInterestService } from "./open-interest-service";

// Constants
const DEFAULT_INTERVAL_MS = 3_600_000; // 1 hour
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const OI_EXTREME_CHANGE_THRESHOLD = 15; // 15% change
const VOLUME_OI_RATIO_HIGH = 3; // Volume/OI > 3 is high turnover
const MILLION_DIVIDER = 1_000_000;

export class OpenInterestCollector {
  private running = false;
  private intervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private openInterestService: OpenInterestService,
    private logger: Logger
  ) {}

  /**
   * Collect and process open interest data
   */
  private async collectAndProcess(
    symbol: string,
    exchange: string
  ): Promise<void> {
    const data = await this.openInterestService.getOpenInterest(
      symbol,
      exchange
    );
    await this.openInterestService.saveOpenInterest(data);

    // Log significant changes
    if (data.signal !== "NEUTRAL") {
      this.logger.info("📊 Open Interest signal detected", {
        symbol,
        exchange,
        signal: data.signal,
        explanation: data.explanation,
        oiChange: `${data.openInterestChangePct >= 0 ? "+" : ""}${data.openInterestChangePct.toFixed(1)}%`,
        priceChange: `${data.priceChange24h >= 0 ? "+" : ""}${data.priceChange24h.toFixed(1)}%`,
        totalOI: `$${(data.openInterest / MILLION_DIVIDER).toFixed(1)}M`,
      });
    }

    // Alert on extreme OI changes
    if (Math.abs(data.openInterestChangePct) > OI_EXTREME_CHANGE_THRESHOLD) {
      this.logger.warn("⚠️ EXTREME OI change detected", {
        symbol,
        exchange,
        change: `${data.openInterestChangePct >= 0 ? "+" : ""}${data.openInterestChangePct.toFixed(1)}%`,
        signal: data.signal,
        explanation: data.explanation,
      });
    }

    // Alert on high volume/OI ratio (high turnover = volatile)
    const volumeOIRatio = data.volume24h / data.openInterest;
    if (volumeOIRatio > VOLUME_OI_RATIO_HIGH) {
      this.logger.warn("⚠️ High volume/OI ratio detected", {
        symbol,
        exchange,
        ratio: volumeOIRatio.toFixed(2),
        message: "High turnover - potential volatility",
      });
    }
  }

  /**
   * Start collecting open interest
   */
  start(
    symbols: string[],
    exchanges: string[],
    intervalMs = DEFAULT_INTERVAL_MS
  ): void {
    if (this.running) {
      this.logger.warn("Open interest collector already running");
      return;
    }

    this.running = true;
    this.logger.info("Starting open interest collector", {
      symbols,
      exchanges,
      intervalMs,
      collectionsPerHour: Math.floor(
        (MS_PER_MINUTE * MINUTES_PER_HOUR) / intervalMs
      ),
    });

    for (const symbol of symbols) {
      for (const exchange of exchanges) {
        const key = `${symbol}-${exchange}`;

        // Collect data immediately on start
        const collectData = async () => {
          try {
            await this.collectAndProcess(symbol, exchange);
          } catch (error: unknown) {
            const errorAny = error as { message?: string };
            this.logger.error("Failed to collect open interest", {
              symbol,
              exchange,
              error: errorAny.message,
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
  }

  /**
   * Stop collector
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.logger.info("Stopping open interest collector");

    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }

    this.intervals.clear();
    this.running = false;
  }

  /**
   * Get collector status
   */
  getStatus(): {
    running: boolean;
    activeCollectors: number;
    symbols: string[];
  } {
    const symbols = Array.from(this.intervals.keys());

    return {
      running: this.running,
      activeCollectors: symbols.length,
      symbols,
    };
  }

  /**
   * Add new collector dynamically
   */
  addCollector(
    symbol: string,
    exchange: string,
    intervalMs = DEFAULT_INTERVAL_MS
  ): void {
    const key = `${symbol}-${exchange}`;

    if (this.intervals.has(key)) {
      this.logger.warn("Collector already exists", { symbol, exchange });
      return;
    }

    const collectData = async () => {
      try {
        await this.collectAndProcess(symbol, exchange);
      } catch (error: unknown) {
        const errorAny = error as { message?: string };
        this.logger.error("Failed to collect open interest", {
          symbol,
          exchange,
          error: errorAny.message,
        });
      }
    };

    // Execute immediately
    collectData();

    // Then schedule periodic collection
    const interval = setInterval(collectData, intervalMs);

    this.intervals.set(key, interval);
    this.logger.info("Added new OI collector", { symbol, exchange });
  }
}
