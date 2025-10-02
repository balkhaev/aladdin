import type { Logger } from "@aladdin/shared/logger"
import type { OrderBookService } from "./order-book-service"

// Constants
const DEFAULT_INTERVAL_MS = 5_000
const CONFIDENCE_THRESHOLD = 0.7
const LOW_LIQUIDITY_THRESHOLD = 30
const MS_PER_MINUTE = 60_000

export class OrderBookCollector {
  private running = false
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private orderBookService: OrderBookService,
    private logger: Logger
  ) {}

  /**
   * Start collecting order books
   */
  start(symbols: string[], exchanges: string[], intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.running) {
      this.logger.warn("Order book collector already running")
      return
    }

    this.running = true
    this.logger.info("Starting order book collector", {
      symbols,
      exchanges,
      intervalMs,
      collectionsPerMinute: Math.floor(MS_PER_MINUTE / intervalMs),
    })

    for (const symbol of symbols) {
      for (const exchange of exchanges) {
        const key = `${symbol}-${exchange}`

        const interval = setInterval(async () => {
          try {
            const snapshot = await this.orderBookService.getOrderBook(
              symbol,
              exchange
            )
            await this.orderBookService.saveSnapshot(snapshot)

            // Analyze and log significant signals
            const analysis = this.orderBookService.analyzeSnapshot(snapshot)
            
            if (analysis.signal !== "NEUTRAL" && analysis.confidence > CONFIDENCE_THRESHOLD) {
              this.logger.info("📊 Order book signal detected", {
                symbol,
                exchange,
                signal: analysis.signal,
                reason: analysis.reason,
                confidence: analysis.confidence.toFixed(2),
                spreadQuality: analysis.details.spreadQuality,
                liquidityScore: analysis.details.liquidityScore.toFixed(0),
                hasWalls: analysis.details.hasLargeWalls,
              })
            }

            // Log poor liquidity conditions
            if (analysis.details.liquidityScore < LOW_LIQUIDITY_THRESHOLD) {
              this.logger.warn("⚠️ Low liquidity detected", {
                symbol,
                exchange,
                liquidityScore: analysis.details.liquidityScore.toFixed(0),
                spreadQuality: analysis.details.spreadQuality,
              })
            }
          } catch (error) {
            this.logger.error("Failed to collect order book", {
              symbol,
              exchange,
              error: error.message,
            })
          }
        }, intervalMs)

        this.intervals.set(key, interval)
      }
    }

    this.logger.info("Order book collector started successfully", {
      totalCollectors: this.intervals.size,
    })
  }

  /**
   * Stop collecting
   */
  stop(): void {
    this.logger.info("Stopping order book collector")

    for (const [key, interval] of this.intervals) {
      clearInterval(interval)
      this.logger.debug("Cleared interval", { key })
    }

    this.intervals.clear()
    this.running = false

    this.logger.info("Order book collector stopped")
  }

  /**
   * Get collector status
   */
  getStatus(): {
    running: boolean
    activeCollectors: number
    collectors: string[]
  } {
    return {
      running: this.running,
      activeCollectors: this.intervals.size,
      collectors: Array.from(this.intervals.keys()),
    }
  }

  /**
   * Add a new symbol-exchange pair
   */
  addCollector(symbol: string, exchange: string, intervalMs = DEFAULT_INTERVAL_MS): void {
    const key = `${symbol}-${exchange}`

    if (this.intervals.has(key)) {
      this.logger.warn("Collector already exists", { key })
      return
    }

    const interval = setInterval(async () => {
      try {
        const snapshot = await this.orderBookService.getOrderBook(
          symbol,
          exchange
        )
        await this.orderBookService.saveSnapshot(snapshot)

        const analysis = this.orderBookService.analyzeSnapshot(snapshot)
        if (analysis.signal !== "NEUTRAL" && analysis.confidence > CONFIDENCE_THRESHOLD) {
          this.logger.info("📊 Order book signal", {
            symbol,
            exchange,
            signal: analysis.signal,
          })
        }
      } catch (error) {
        this.logger.error("Failed to collect order book", {
          symbol,
          exchange,
          error: error.message,
        })
      }
    }, intervalMs)

    this.intervals.set(key, interval)
    this.logger.info("Added order book collector", { key })
  }

  /**
   * Remove a symbol-exchange pair
   */
  removeCollector(symbol: string, exchange: string): void {
    const key = `${symbol}-${exchange}`
    const interval = this.intervals.get(key)

    if (interval) {
      clearInterval(interval)
      this.intervals.delete(key)
      this.logger.info("Removed order book collector", { key })
    } else {
      this.logger.warn("Collector not found", { key })
    }
  }
}

