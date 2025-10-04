import { NotFoundError } from "@aladdin/shared/errors";
import type { Logger } from "@aladdin/shared/logger";
import type { NATSClient } from "@aladdin/shared/nats";
import type { PrismaClient } from "@prisma/client";

type MonitoringConfig = {
  positionId: string;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopPercent?: number;
  autoCloseEnabled: boolean;
};

const PERCENT_MULTIPLIER = 100;

/**
 * Position Monitor - Real-time monitoring of open positions
 * Automatically closes positions when stop-loss, take-profit, or trailing stop is hit
 */
export class PositionMonitor {
  private monitoredPositions = new Map<string, MonitoringConfig>();
  private priceSubscriptions = new Map<string, Set<string>>(); // symbol -> positionIds
  private peakPrices = new Map<string, number>(); // positionId -> peak price for trailing stop

  constructor(
    private prisma: PrismaClient,
    private natsClient: NATSClient,
    private logger: Logger
  ) {}

  /**
   * Start monitoring a position
   */
  async startMonitoring(config: MonitoringConfig): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: { id: config.positionId },
    });

    if (!position) {
      throw new NotFoundError("Position", config.positionId);
    }

    // Store monitoring config
    this.monitoredPositions.set(config.positionId, config);

    // Initialize peak price for trailing stop
    if (config.trailingStopPercent) {
      this.peakPrices.set(config.positionId, Number(position.currentPrice));
    }

    // Subscribe to price updates for this symbol
    const symbol = position.symbol;
    if (!this.priceSubscriptions.has(symbol)) {
      this.priceSubscriptions.set(symbol, new Set());
      await this.subscribeToPriceUpdates(symbol);
    }
    this.priceSubscriptions.get(symbol)?.add(config.positionId);

    this.logger.info("Started monitoring position", {
      positionId: config.positionId,
      symbol,
      stopLoss: config.stopLoss,
      takeProfit: config.takeProfit,
      trailingStop: config.trailingStopPercent,
    });
  }

  /**
   * Stop monitoring a position
   */
  async stopMonitoring(positionId: string): Promise<void> {
    const config = this.monitoredPositions.get(positionId);
    if (!config) {
      return;
    }

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (position) {
      const symbol = position.symbol;
      const symbolPositions = this.priceSubscriptions.get(symbol);
      if (symbolPositions) {
        symbolPositions.delete(positionId);
        // If no more positions for this symbol, unsubscribe
        if (symbolPositions.size === 0) {
          this.priceSubscriptions.delete(symbol);
          await this.unsubscribeFromPriceUpdates(symbol);
        }
      }
    }

    this.monitoredPositions.delete(positionId);
    this.peakPrices.delete(positionId);

    this.logger.info("Stopped monitoring position", { positionId });
  }

  /**
   * Subscribe to price updates for a symbol via NATS
   */
  private async subscribeToPriceUpdates(symbol: string): Promise<void> {
    await this.natsClient.subscribe(
      `market.tick.${symbol}`,
      this.handlePriceUpdate.bind(this)
    );

    this.logger.debug("Subscribed to price updates", { symbol });
  }

  /**
   * Unsubscribe from price updates
   */
  private unsubscribeFromPriceUpdates(symbol: string): void {
    // NATS client should handle unsubscribe
    this.logger.debug("Unsubscribed from price updates", { symbol });
  }

  /**
   * Handle price update from NATS
   */
  private async handlePriceUpdate(data: string): Promise<void> {
    try {
      const tick = JSON.parse(data);
      const { symbol, price } = tick;

      // Get all positions monitoring this symbol
      const positionIds = this.priceSubscriptions.get(symbol);
      if (!positionIds || positionIds.size === 0) {
        return;
      }

      // Check each position
      for (const positionId of positionIds) {
        await this.checkPosition(positionId, price);
      }
    } catch (error) {
      this.logger.error("Failed to handle price update", error);
    }
  }

  /**
   * Check position against stop-loss, take-profit, and trailing stop
   */
  private async checkPosition(
    positionId: string,
    currentPrice: number
  ): Promise<void> {
    const config = this.monitoredPositions.get(positionId);
    if (!(config && config.autoCloseEnabled)) {
      return;
    }

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
    });

    if (!position) {
      await this.stopMonitoring(positionId);
      return;
    }

    const quantity = Number(position.quantity);
    const isLong = quantity > 0;

    const closeDecision = this.determineCloseAction(
      config,
      currentPrice,
      isLong,
      positionId
    );

    const shouldClose = closeDecision.shouldClose;
    const reason = closeDecision.reason;

    // Close position if any condition is met
    if (shouldClose) {
      await this.closePosition(positionId, currentPrice, reason);
    }
  }

  /**
   * Determine if position should be closed
   */
  private determineCloseAction(
    config: MonitoringConfig,
    currentPrice: number,
    isLong: boolean,
    positionId: string
  ): { shouldClose: boolean; reason: string } {
    // Check stop-loss
    if (config.stopLoss) {
      const stopLossHit = isLong
        ? currentPrice <= config.stopLoss
        : currentPrice >= config.stopLoss;

      if (stopLossHit) {
        return { shouldClose: true, reason: "Stop-loss triggered" };
      }
    }

    // Check take-profit
    if (config.takeProfit) {
      const takeProfitHit = isLong
        ? currentPrice >= config.takeProfit
        : currentPrice <= config.takeProfit;

      if (takeProfitHit) {
        return { shouldClose: true, reason: "Take-profit triggered" };
      }
    }

    // Check trailing stop
    if (config.trailingStopPercent) {
      const trailingStop = this.checkTrailingStop(
        positionId,
        currentPrice,
        config.trailingStopPercent,
        isLong
      );
      if (trailingStop.shouldClose) {
        return { shouldClose: true, reason: trailingStop.reason };
      }
    }

    return { shouldClose: false, reason: "" };
  }

  /**
   * Check trailing stop condition
   */
  private checkTrailingStop(
    positionId: string,
    currentPrice: number,
    trailingStopPercent: number,
    isLong: boolean
  ): Promise<{ shouldClose: boolean; reason: string }> {
    let peakPrice = this.peakPrices.get(positionId) ?? currentPrice;

    // Update peak price
    if (isLong && currentPrice > peakPrice) {
      peakPrice = currentPrice;
      this.peakPrices.set(positionId, peakPrice);
    } else if (!isLong && currentPrice < peakPrice) {
      peakPrice = currentPrice;
      this.peakPrices.set(positionId, peakPrice);
    }

    // Calculate trailing stop price
    const stopDistance = peakPrice * (trailingStopPercent / PERCENT_MULTIPLIER);
    const trailingStopPrice = isLong
      ? peakPrice - stopDistance
      : peakPrice + stopDistance;

    // Check if trailing stop is hit
    if (isLong && currentPrice <= trailingStopPrice) {
      return {
        shouldClose: true,
        reason: `Trailing stop triggered (${trailingStopPercent}% from peak $${peakPrice.toFixed(2)})`,
      };
    }
    if (!isLong && currentPrice >= trailingStopPrice) {
      return {
        shouldClose: true,
        reason: `Trailing stop triggered (${trailingStopPercent}% from peak $${peakPrice.toFixed(2)})`,
      };
    }

    return { shouldClose: false, reason: "" };
  }

  /**
   * Close position automatically
   */
  private async closePosition(
    positionId: string,
    price: number,
    reason: string
  ): Promise<void> {
    this.logger.info("Auto-closing position", { positionId, price, reason });

    try {
      const position = await this.prisma.position.findUnique({
        where: { id: positionId },
        include: { portfolio: true },
      });

      if (!position) {
        return;
      }

      // Publish event to trading service to create close order
      await this.natsClient.publish(
        "risk.position.auto-close",
        JSON.stringify({
          type: "risk.position.auto-close",
          data: {
            positionId,
            portfolioId: position.portfolioId,
            userId: position.portfolio.userId,
            symbol: position.symbol,
            quantity: Math.abs(Number(position.quantity)),
            price,
            reason,
          },
          timestamp: new Date(),
        })
      );

      // Stop monitoring this position
      await this.stopMonitoring(positionId);

      this.logger.info("Position auto-closed successfully", {
        positionId,
        reason,
      });
    } catch (error) {
      this.logger.error("Failed to auto-close position", {
        positionId,
        error,
      });
    }
  }

  /**
   * Update monitoring config for a position
   */
  async updateMonitoring(
    positionId: string,
    updates: Partial<MonitoringConfig>
  ): Promise<void> {
    const config = this.monitoredPositions.get(positionId);
    if (!config) {
      throw new NotFoundError("Monitoring config", positionId);
    }

    const updatedConfig = { ...config, ...updates };
    this.monitoredPositions.set(positionId, updatedConfig);

    // Reset peak price if trailing stop changed
    if (updates.trailingStopPercent !== undefined) {
      const position = await this.prisma.position.findUnique({
        where: { id: positionId },
      });
      if (position) {
        this.peakPrices.set(positionId, Number(position.currentPrice));
      }
    }

    this.logger.info("Updated monitoring config", { positionId, updates });
  }

  /**
   * Get monitoring status for a position
   */
  getMonitoringStatus(positionId: string): {
    isMonitored: boolean;
    config?: MonitoringConfig;
    peakPrice?: number;
  } {
    const config = this.monitoredPositions.get(positionId);
    if (!config) {
      return { isMonitored: false };
    }

    return {
      isMonitored: true,
      config,
      peakPrice: this.peakPrices.get(positionId),
    };
  }

  /**
   * Get all monitored positions
   */
  getAllMonitored(): Array<{
    positionId: string;
    config: MonitoringConfig;
    peakPrice?: number;
  }> {
    return Array.from(this.monitoredPositions.entries()).map(
      ([positionId, config]) => ({
        positionId,
        config,
        peakPrice: this.peakPrices.get(positionId),
      })
    );
  }

  /**
   * Stop monitoring all positions
   */
  async stopAll(): Promise<void> {
    const positionIds = Array.from(this.monitoredPositions.keys());
    for (const positionId of positionIds) {
      await this.stopMonitoring(positionId);
    }
    this.logger.info("Stopped monitoring all positions");
  }
}
