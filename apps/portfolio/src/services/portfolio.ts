import { BaseService } from "@aladdin/shared/base-service";
import type { Portfolio, Position } from "@aladdin/shared/types";
import { PortfolioQueue } from "../queue/portfolio-queue";
import {
  type AssetStatistics,
  type OptimizationConstraints,
  type OptimizedPortfolio,
  PortfolioOptimizer,
} from "./optimization";
import {
  type RebalancingConfig,
  RebalancingEngine,
  type RebalancingPlan,
  type Position as RebalancingPosition,
} from "./rebalancing";

// Constants
const PAD_LENGTH = 2;
const PAD_CHAR = "0";
const DEFAULT_DAYS = 30;
const DEFAULT_TRANSACTIONS_LIMIT = 100;
const PERCENT_MULTIPLIER = 100;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;
const MS_IN_SECOND = 1000;
const MS_IN_DAY =
  HOURS_IN_DAY * MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SECOND;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 100;
const MAX_LOG_MESSAGE_LENGTH = 100;
const AUTO_UPDATE_INTERVAL_MINUTES = 10;
const MINUTES_TO_MS = MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SECOND;

/**
 * Format date to ClickHouse DateTime format (YYYY-MM-DD HH:MM:SS)
 */
function formatDateForClickHouse(date: Date): string {
  const pad = (n: number) => n.toString().padStart(PAD_LENGTH, PAD_CHAR);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export type CreatePortfolioParams = {
  userId: string;
  name: string;
  currency?: string;
  initialBalance?: number;
};

/**
 * Portfolio Service - управление портфелями пользователей
 */
export class PortfolioService extends BaseService {
  private tickBuffer = new Map<
    string,
    { symbol: string; price: number; timestamp: number }
  >();
  private flushTimer?: Timer;
  private readonly FLUSH_INTERVAL_MS = 1000; // Flush every 1 second

  private portfolioQueue?: PortfolioQueue;
  private autoUpdateInterval?: Timer;

  getServiceName(): string {
    return "portfolio";
  }

  /**
   * Initialize service and subscribe to NATS events
   */
  protected async onInitialize(): Promise<void> {
    if (!this.natsClient) {
      throw new Error("NATS client is required for Portfolio Service");
    }

    // Subscribe to trading events
    await this.natsClient.subscribe(
      "trading.order.filled",
      this.handleOrderFilled.bind(this)
    );

    await this.natsClient.subscribe(
      "market.tick.*",
      this.handleMarketTick.bind(this)
    );

    // Initialize portfolio queue for async price updates
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
    this.portfolioQueue = new PortfolioQueue(this.logger, this, redisUrl);
    this.logger.info("Portfolio queue initialized");

    // Start automatic price updates every 10 minutes
    this.startAutomaticPriceUpdates();
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      // Custom health checks if needed
    });
  }

  /**
   * Stop service and cleanup
   */
  protected async onStop(): Promise<void> {
    // Stop automatic updates
    if (this.autoUpdateInterval) {
      clearInterval(this.autoUpdateInterval);
      this.autoUpdateInterval = undefined;
    }

    // Cleanup queue
    if (this.portfolioQueue) {
      await this.portfolioQueue.cleanup();
    }

    this.logger.info("Portfolio service stopped");
  }

  /**
   * Create a new portfolio
   */
  async createPortfolio(params: CreatePortfolioParams): Promise<Portfolio> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }
    if (!this.natsClient) {
      throw new Error("NATS not available");
    }

    this.logger.info("Creating portfolio", {
      name: params.name,
      currency: params.currency,
    });

    // Check if user has at least one API key
    const apiKeysCount = await this.prisma.exchangeCredentials.count({
      where: {
        userId: params.userId,
        isActive: true,
      },
    });

    if (apiKeysCount === 0) {
      const error = new Error(
        "Для создания портфеля необходимо добавить хотя бы один API ключ биржи. Перейдите в настройки и добавьте API ключ."
      );
      this.logger.warn("Portfolio creation blocked - no API keys", {
        userId: params.userId,
      });
      throw error;
    }

    const initialBalance = params.initialBalance ?? 0;

    const portfolio = await this.prisma.portfolio.create({
      data: {
        userId: params.userId,
        name: params.name,
        balance: initialBalance.toString(),
        initialBalance: initialBalance.toString(),
        currency: params.currency ?? "USDT",
      },
      include: {
        positions: true,
      },
    });

    // Publish event
    await this.natsClient.publish(
      "portfolio.created",
      JSON.stringify({
        type: "portfolio.created",
        data: this.formatPortfolio(portfolio),
      })
    );

    return this.formatPortfolio(portfolio);
  }

  /**
   * Get user portfolios
   */
  async getPortfolios(userId: string): Promise<Portfolio[]> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      include: {
        positions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return portfolios.map((p) => this.formatPortfolio(p));
  }

  /**
   * Get portfolio by ID
   */
  async getPortfolio(
    portfolioId: string,
    userId: string
  ): Promise<Portfolio | null> {
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      include: {
        positions: true,
      },
    });

    if (!portfolio) {
      return null;
    }

    return this.formatPortfolio(portfolio);
  }

  /**
   * Get portfolio performance
   */
  async getPerformance(
    portfolioId: string,
    userId: string,
    days = DEFAULT_DAYS
  ): Promise<{
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    dailyPnl: number;
    dailyPnlPercent: number;
    weeklyPnl: number;
    weeklyPnlPercent: number;
    monthlyPnl: number;
    monthlyPnlPercent: number;
    snapshots: Array<{ timestamp: Date; totalValue: number; pnl: number }>;
  }> {
    // Get portfolio
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Calculate current value
    const totalValue =
      Number(portfolio.balance) +
      portfolio.positions.reduce(
        (sum, pos) => sum + Number(pos.quantity) * Number(pos.currentPrice),
        0
      );

    const totalPnl = portfolio.positions.reduce(
      (sum, pos) => sum + Number(pos.pnl),
      0
    );

    // Get snapshots from ClickHouse for different periods
    const startDate = new Date(Date.now() - days * MS_IN_DAY);
    const oneDayAgo = new Date(Date.now() - MS_IN_DAY);
    const oneWeekAgo = new Date(Date.now() - DAYS_IN_WEEK * MS_IN_DAY);
    const oneMonthAgo = new Date(Date.now() - DAYS_IN_MONTH * MS_IN_DAY);

    const query =
      "SELECT timestamp, totalValue, dailyPnl FROM aladdin.portfolio_snapshots WHERE portfolioId = {portfolioId:String} AND timestamp >= {startDate:DateTime} ORDER BY timestamp ASC";

    const snapshotData = await this.clickhouse.query<{
      timestamp: string;
      totalValue: string;
      dailyPnl: string;
    }>(query, {
      portfolioId,
      startDate: formatDateForClickHouse(startDate),
    });

    // Calculate period performance
    const getValueAtDate = (targetDate: Date): number => {
      const snapshot = snapshotData
        .filter((s) => new Date(s.timestamp) <= targetDate)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
      return snapshot
        ? Number.parseFloat(snapshot.totalValue)
        : Number(portfolio.initialBalance ?? 0);
    };

    const valueDayAgo = getValueAtDate(oneDayAgo);
    const valueWeekAgo = getValueAtDate(oneWeekAgo);
    const valueMonthAgo = getValueAtDate(oneMonthAgo);
    const initialValue = Number(portfolio.initialBalance ?? 0);

    const dailyPnl = totalValue - valueDayAgo;
    const weeklyPnl = totalValue - valueWeekAgo;
    const monthlyPnl = totalValue - valueMonthAgo;

    const dailyPnlPercent =
      valueDayAgo > 0 ? (dailyPnl / valueDayAgo) * PERCENT_MULTIPLIER : 0;
    const weeklyPnlPercent =
      valueWeekAgo > 0 ? (weeklyPnl / valueWeekAgo) * PERCENT_MULTIPLIER : 0;
    const monthlyPnlPercent =
      valueMonthAgo > 0 ? (monthlyPnl / valueMonthAgo) * PERCENT_MULTIPLIER : 0;
    const totalPnlPercent =
      initialValue > 0 ? (totalPnl / initialValue) * PERCENT_MULTIPLIER : 0;

    return {
      totalValue,
      totalPnl,
      totalPnlPercent,
      dailyPnl,
      dailyPnlPercent,
      weeklyPnl,
      weeklyPnlPercent,
      monthlyPnl,
      monthlyPnlPercent,
      snapshots: snapshotData.map((s) => ({
        timestamp: new Date(s.timestamp),
        totalValue: Number.parseFloat(s.totalValue),
        pnl: Number.parseFloat(s.dailyPnl),
      })),
    };
  }

  /**
   * Handle order filled event
   */
  private async handleOrderFilled(msg: string): Promise<void> {
    try {
      const event = JSON.parse(msg) as {
        type: "trading.order.filled";
        data: {
          order: {
            id: string;
            userId: string;
            portfolioId?: string;
            symbol: string;
            side: string;
            quantity: number;
            avgPrice: number;
          };
        };
      };

      const { order } = event.data;

      if (!order.portfolioId) {
        return;
      }

      this.logger.info("Processing filled order", { orderId: order.id });

      // Update or create position
      await this.updatePosition({
        portfolioId: order.portfolioId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity,
        price: order.avgPrice,
      });

      // Save snapshot to ClickHouse
      await this.saveSnapshot(order.portfolioId);

      this.logger.info("Position updated", {
        portfolioId: order.portfolioId,
      });
    } catch (error) {
      this.logger.error("Failed to handle order filled event", error);
    }
  }

  /**
   * Handle market tick event
   */
  private handleMarketTick(msg: string): void {
    try {
      const event = JSON.parse(msg) as {
        type: "market.tick";
        data: {
          symbol: string;
          price: number;
        };
      };

      const { symbol, price } = event.data;

      // Buffer the update instead of immediate DB write
      this.tickBuffer.set(symbol, { symbol, price, timestamp: Date.now() });

      // Schedule flush if not already scheduled
      if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTickBuffer().catch((error) => {
            this.logger.error("Failed to flush tick buffer", { error });
          });
        }, this.FLUSH_INTERVAL_MS);
      }
    } catch (error) {
      this.logger.debug("Failed to handle market tick", {
        error,
        message:
          typeof msg === "string"
            ? msg.substring(0, MAX_LOG_MESSAGE_LENGTH)
            : "N/A",
      });
    }
  }

  /**
   * Flush buffered market ticks to database
   */
  private async flushTickBuffer(): Promise<void> {
    if (!this.prisma) {
      return;
    }

    const updates = Array.from(this.tickBuffer.values());
    this.tickBuffer.clear();
    this.flushTimer = undefined;

    if (updates.length === 0) {
      return;
    }

    try {
      // Batch update using raw SQL for better performance
      await this.prisma.$executeRawUnsafe(`
        UPDATE positions AS p
        SET 
          current_price = c.price::decimal,
          pnl = ((c.price::decimal - p.entry_price) * p.quantity),
          pnl_percent = (((c.price::decimal - p.entry_price) / p.entry_price) * 100),
          updated_at = NOW()
        FROM (VALUES ${updates.map((u) => `('${u.symbol}', ${u.price})`).join(", ")}) 
        AS c(symbol, price)
        WHERE p.symbol = c.symbol
      `);

      this.logger.debug("Flushed tick buffer", { count: updates.length });
    } catch (error) {
      this.logger.error("Failed to flush tick buffer to database", {
        error,
        updatesCount: updates.length,
      });
    }
  }

  /**
   * Update or create position
   */
  private async updatePosition(params: {
    portfolioId: string;
    symbol: string;
    side: string;
    quantity: number;
    price: number;
  }): Promise<void> {
    // Use transaction to prevent race conditions
    await this.prisma.$transaction(async (tx) => {
      const existingPosition = await tx.position.findFirst({
        where: {
          portfolioId: params.portfolioId,
          symbol: params.symbol,
        },
      });

      if (existingPosition) {
        // Update existing position
        const currentQty = Number(existingPosition.quantity);
        const currentEntry = Number(existingPosition.entryPrice);

        let newQty: number;
        let newEntry: number;

        if (params.side === "BUY") {
          newQty = currentQty + params.quantity;
          newEntry =
            (currentEntry * currentQty + params.price * params.quantity) /
            newQty;
        } else {
          // Check sufficiency for SELL
          if (currentQty < params.quantity) {
            throw new Error(
              `Insufficient position. Cannot sell ${params.quantity} ${params.symbol}. Only ${currentQty} available.`
            );
          }

          newQty = currentQty - params.quantity;
          newEntry = currentEntry; // Keep same entry price for SELL
        }

        if (newQty <= 0) {
          // Close position
          await tx.position.delete({
            where: { id: existingPosition.id },
          });

          // Publish position deleted event
          await this.natsClient.publish(
            "portfolio.position.deleted",
            JSON.stringify({
              type: "portfolio.position.deleted",
              data: {
                portfolioId: params.portfolioId,
                position: this.formatPosition(existingPosition),
              },
            })
          );
        } else {
          const updatedPosition = await tx.position.update({
            where: { id: existingPosition.id },
            data: {
              quantity: newQty.toString(),
              entryPrice: newEntry.toString(),
            },
          });

          // Publish position updated event
          await this.natsClient.publish(
            "portfolio.position.updated",
            JSON.stringify({
              type: "portfolio.position.updated",
              data: {
                portfolioId: params.portfolioId,
                position: this.formatPosition(updatedPosition),
              },
            })
          );
        }
      } else if (params.side === "BUY") {
        // Create new position
        const newPosition = await tx.position.create({
          data: {
            portfolioId: params.portfolioId,
            symbol: params.symbol,
            quantity: params.quantity.toString(),
            entryPrice: params.price.toString(),
            currentPrice: params.price.toString(),
            side: "LONG",
          },
        });

        // Publish position created event
        await this.natsClient.publish(
          "portfolio.position.created",
          JSON.stringify({
            type: "portfolio.position.created",
            data: {
              portfolioId: params.portfolioId,
              position: this.formatPosition(newPosition),
            },
          })
        );
      } else {
        // SELL without existing position - not allowed
        throw new Error(
          `Cannot sell ${params.symbol}. No position found in portfolio.`
        );
      }
    });
  }

  /**
   * Save portfolio snapshot to ClickHouse
   */
  private async saveSnapshot(portfolioId: string): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio) {
      return;
    }

    const totalValue =
      Number(portfolio.balance) +
      portfolio.positions.reduce(
        (sum, pos) => sum + Number(pos.quantity) * Number(pos.currentPrice),
        0
      );

    const totalPnl = portfolio.positions.reduce(
      (sum, pos) => sum + Number(pos.pnl),
      0
    );

    await this.clickhouse.insert("aladdin.portfolio_snapshots", [
      {
        timestamp: formatDateForClickHouse(new Date()),
        portfolioId: portfolio.id,
        userId: portfolio.userId,
        totalValue: totalValue.toString(),
        totalPnl: totalPnl.toString(),
        dailyPnl: totalPnl.toString(),
        positions: JSON.stringify(portfolio.positions),
        balances: JSON.stringify({
          [portfolio.currency]: portfolio.balance.toString(),
        }),
      },
    ]);
  }

  /**
   * Format portfolio for API response
   */
  private formatPortfolio(portfolio: {
    id: string;
    userId: string;
    name: string;
    balance: unknown;
    initialBalance: unknown;
    currency: string;
    positions: Array<{
      id: string;
      portfolioId: string;
      symbol: string;
      quantity: unknown;
      entryPrice: unknown;
      currentPrice: unknown;
      pnl: unknown;
      pnlPercent: unknown;
      side: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }): Portfolio {
    const positions: Position[] = portfolio.positions.map((p) => {
      const quantity = Number(p.quantity);
      const entryPrice = Number(p.entryPrice);
      const currentPrice = Number(p.currentPrice);
      const value = quantity * currentPrice;

      return {
        id: p.id,
        portfolioId: p.portfolioId,
        symbol: p.symbol,
        quantity,
        entryPrice,
        averagePrice: entryPrice, // averagePrice is the same as entryPrice
        currentPrice,
        value,
        pnl: Number(p.pnl),
        pnlPercent: Number(p.pnlPercent),
        side: p.side as "LONG" | "SHORT",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    const totalValue =
      Number(portfolio.balance) +
      positions.reduce((sum, pos) => sum + pos.value, 0);

    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);

    // Calculate P&L percent from initial balance (not current value)
    const initialBalance = Number(portfolio.initialBalance);
    const totalPnlPercent =
      initialBalance > 0 ? (totalPnl / initialBalance) * PERCENT_MULTIPLIER : 0;

    return {
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      balance: Number(portfolio.balance),
      initialBalance,
      currency: portfolio.currency,
      totalValue,
      totalPnl,
      totalPnlPercent,
      positions,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }

  /**
   * Update positions prices from market data
   */
  async updatePositionsPrices(
    portfolioId: string,
    userId: string
  ): Promise<number> {
    this.logger.info("Updating positions prices", { portfolioId });

    // Verify portfolio belongs to user
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
      include: { positions: true },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    if (portfolio.positions.length === 0) {
      return 0;
    }

    // Get unique symbols
    const symbols = [...new Set(portfolio.positions.map((p) => p.symbol))];

    // Subscribe to all symbols in market-data service (single request)
    const marketDataUrl =
      process.env.MARKET_DATA_URL || "http://localhost:3010";

    try {
      const response = await fetch(
        `${marketDataUrl}/api/market-data/subscribe`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to subscribe: ${response.statusText}`);
      }

      this.logger.info("Subscribed to all symbols", {
        count: symbols.length,
        symbols,
      });
    } catch (error) {
      this.logger.error("Failed to subscribe to symbols", { error });
      throw error;
    }

    // Poll ClickHouse for market data instead of blocking
    this.logger.info("Polling for market data...");

    const pricesQuery = `
      SELECT symbol, argMax(price, timestamp) as price
      FROM aladdin.ticks
      WHERE symbol IN {symbols:Array(String)}
        AND timestamp >= now() - INTERVAL 1 HOUR
      GROUP BY symbol
    `;

    let pricesData: Array<{ symbol: string; price: string }> = [];

    // Poll with exponential backoff
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      pricesData = await this.clickhouse.query<{
        symbol: string;
        price: string;
      }>(pricesQuery, { symbols });

      // Check if we have all prices
      if (pricesData.length === symbols.length) {
        this.logger.info("All prices fetched", {
          attempt: attempt + 1,
          symbols: pricesData.length,
        });
        break;
      }

      // Wait before next attempt (with exponential backoff)
      if (attempt < MAX_POLL_ATTEMPTS - 1) {
        const backoff = POLL_INTERVAL_MS * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    // Log if we didn't get all prices
    if (pricesData.length < symbols.length) {
      this.logger.warn("Could not fetch all prices after polling", {
        expected: symbols.length,
        received: pricesData.length,
        attempts: MAX_POLL_ATTEMPTS,
      });
    }

    const pricesMap = new Map(
      pricesData.map((p) => [p.symbol, Number.parseFloat(p.price)])
    );

    // Update each position
    let updated = 0;
    for (const position of portfolio.positions) {
      const currentPrice = pricesMap.get(position.symbol);
      if (!currentPrice || currentPrice === 0) {
        this.logger.warn("No price found for symbol", {
          symbol: position.symbol,
        });
        continue;
      }

      const entryPrice = Number(position.entryPrice);
      const quantity = Number(position.quantity);
      const pnl = (currentPrice - entryPrice) * quantity;
      const pnlPercent =
        entryPrice > 0
          ? (pnl / (entryPrice * quantity)) * PERCENT_MULTIPLIER
          : 0;

      await this.prisma.position.update({
        where: { id: position.id },
        data: {
          currentPrice: currentPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnlPercent.toString(),
        },
      });

      updated++;
    }

    this.logger.info("Positions prices updated", {
      portfolioId,
      updated,
      total: portfolio.positions.length,
    });

    // Save snapshot after updating prices
    await this.saveSnapshot(portfolioId);

    return updated;
  }

  /**
   * Import positions from exchange balances to portfolio
   */
  async importPositions(params: {
    portfolioId: string;
    userId: string;
    assets: Array<{ symbol: string; quantity: number; currentPrice: number }>;
    exchange?: string;
    exchangeCredentialsId?: string;
  }): Promise<
    Array<{
      id: string;
      symbol: string;
      quantity: number;
      entryPrice: number;
      currentPrice: number;
    }>
  > {
    const { portfolioId, userId, assets, exchange, exchangeCredentialsId } =
      params;

    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Importing positions to portfolio", {
      portfolioId,
      assetsCount: assets.length,
      exchange,
      exchangeCredentialsId,
    });

    // Verify portfolio belongs to user
    await this.verifyPortfolioAccess(portfolioId, userId);

    const importedPositions: Array<{
      id: string;
      symbol: string;
      quantity: number;
      entryPrice: number;
      currentPrice: number;
    }> = [];

    for (const asset of assets) {
      const position = await this.importSinglePosition({
        portfolioId,
        asset,
        exchange,
        exchangeCredentialsId,
      });
      importedPositions.push(position);
    }

    this.logger.info("Positions imported successfully", {
      portfolioId,
      imported: importedPositions.length,
    });

    // If all imported positions have zero price, update prices from market data
    const allPricesZero = importedPositions.every((p) => p.currentPrice === 0);
    if (allPricesZero && importedPositions.length > 0) {
      this.logger.info("Updating prices for imported positions", {
        portfolioId,
      });

      try {
        await this.updatePositionsPrices(portfolioId, userId);

        // Fetch updated positions to return correct prices
        const updatedPortfolio = await this.getPortfolio(portfolioId, userId);
        if (updatedPortfolio?.positions) {
          return updatedPortfolio.positions.map((p) => ({
            id: p.id,
            symbol: p.symbol,
            quantity: p.quantity,
            entryPrice: p.entryPrice,
            currentPrice: p.currentPrice,
          }));
        }
      } catch (error) {
        this.logger.warn("Failed to update prices after import", {
          portfolioId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't fail the import if price update fails
      }
    }

    return importedPositions;
  }

  /**
   * Get all unique symbols from all positions across all portfolios
   * Returns array of objects with symbol and exchange
   */
  async getAllSymbols(): Promise<Array<{ symbol: string; exchange: string }>> {
    const positions = await this.prisma.position.findMany({
      select: {
        symbol: true,
        exchange: true,
      },
    });

    // Group by symbol-exchange pair to avoid duplicates
    const symbolsMap = new Map<string, { symbol: string; exchange: string }>();
    for (const position of positions) {
      const key = `${position.symbol}:${position.exchange}`;
      if (!symbolsMap.has(key)) {
        symbolsMap.set(key, {
          symbol: position.symbol,
          exchange: position.exchange,
        });
      }
    }

    const uniqueSymbols = Array.from(symbolsMap.values());

    this.logger.info("Retrieved all unique symbols", {
      count: uniqueSymbols.length,
      symbols: uniqueSymbols,
    });

    return uniqueSymbols;
  }

  /**
   * Get portfolios that contain a specific symbol
   */
  async getPortfoliosBySymbol(
    symbol: string,
    userId?: string
  ): Promise<Portfolio[]> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const portfolios = await this.prisma.portfolio.findMany({
      where: {
        ...(userId && { userId }),
        positions: {
          some: {
            symbol,
          },
        },
      },
      include: {
        positions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    this.logger.info("Retrieved portfolios by symbol", {
      symbol,
      userId,
      count: portfolios.length,
    });

    return portfolios.map((p) => this.formatPortfolio(p));
  }

  /**
   * Update portfolio
   */
  async updatePortfolio(
    portfolioId: string,
    data: { name?: string; currency?: string }
  ): Promise<Portfolio> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }
    if (!this.natsClient) {
      throw new Error("NATS not available");
    }

    this.logger.info("Updating portfolio", { portfolioId, data });

    const portfolio = await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data,
      include: {
        positions: true,
      },
    });

    // Publish event
    await this.natsClient.publish(
      "portfolio.updated",
      JSON.stringify({
        type: "portfolio.updated",
        data: this.formatPortfolio(portfolio),
      })
    );

    return this.formatPortfolio(portfolio);
  }

  /**
   * Delete portfolio
   */
  async deletePortfolio(portfolioId: string, userId: string): Promise<void> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }
    if (!this.natsClient) {
      throw new Error("NATS not available");
    }

    this.logger.info("Deleting portfolio", { portfolioId, userId });

    // Verify ownership
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Delete all positions first (cascade should handle this, but explicit is better)
    await this.prisma.position.deleteMany({
      where: { portfolioId },
    });

    // Delete portfolio
    await this.prisma.portfolio.delete({
      where: { id: portfolioId },
    });

    // Publish event
    await this.natsClient.publish(
      "portfolio.deleted",
      JSON.stringify({
        type: "portfolio.deleted",
        data: { portfolioId, userId },
      })
    );

    this.logger.info("Portfolio deleted", { portfolioId });
  }

  /**
   * Take a snapshot of portfolio state (public method for manual snapshots)
   */
  async takeSnapshot(portfolioId: string, userId: string): Promise<void> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Taking manual portfolio snapshot", {
      portfolioId,
      userId,
    });

    // Verify ownership
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    await this.saveSnapshot(portfolioId);
  }

  /**
   * Start automatic price updates every 10 minutes
   */
  private startAutomaticPriceUpdates(): void {
    const intervalMs = AUTO_UPDATE_INTERVAL_MINUTES * MINUTES_TO_MS;

    this.logger.info("Starting automatic price updates", {
      intervalMinutes: AUTO_UPDATE_INTERVAL_MINUTES,
    });

    // Update immediately on startup
    Promise.resolve().then(() => this.scheduleAllPortfolioUpdates());

    // Then schedule updates every 10 minutes
    this.autoUpdateInterval = setInterval(() => {
      Promise.resolve().then(() => this.scheduleAllPortfolioUpdates());
    }, intervalMs);
  }

  /**
   * Schedule price updates for all portfolios
   */
  private async scheduleAllPortfolioUpdates(): Promise<void> {
    if (!this.prisma) {
      return;
    }
    if (!this.portfolioQueue) {
      return;
    }

    try {
      this.logger.info("Scheduling price updates for all portfolios");

      // Get all portfolios with positions
      const portfolios = await this.prisma.portfolio.findMany({
        include: {
          positions: true,
        },
      });

      let scheduled = 0;
      for (const portfolio of portfolios) {
        // Skip portfolios without positions
        if (portfolio.positions.length === 0) {
          continue;
        }

        // Add job to queue
        await this.portfolioQueue.addPriceUpdateJob(
          portfolio.id,
          portfolio.userId
        );
        scheduled++;
      }

      this.logger.info("Scheduled price updates", {
        total: portfolios.length,
        scheduled,
      });
    } catch (error) {
      this.logger.error("Failed to schedule price updates", { error });
    }
  }

  /**
   * Queue price update for a specific portfolio (async)
   */
  queuePriceUpdate(portfolioId: string, userId: string): Promise<string> {
    if (!this.portfolioQueue) {
      throw new Error("Portfolio queue not initialized");
    }

    return this.portfolioQueue.addPriceUpdateJob(portfolioId, userId);
  }

  /**
   * Get price update job status
   */
  getPriceUpdateStatus(jobId: string): Promise<{
    state: string;
    progress: number;
    result?: {
      portfolioId: string;
      updated: number;
      total: number;
      success: boolean;
      error?: string;
    };
    failedReason?: string;
  } | null> {
    if (!this.portfolioQueue) {
      throw new Error("Portfolio queue not initialized");
    }

    return this.portfolioQueue.getJobStatus(jobId);
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.portfolioQueue) {
      throw new Error("Portfolio queue not initialized");
    }

    return this.portfolioQueue.getQueueStats();
  }

  private formatPosition(position: {
    id: string;
    portfolioId: string;
    symbol: string;
    quantity: unknown;
    entryPrice: unknown;
    currentPrice: unknown;
    pnl: unknown;
    pnlPercent: unknown;
    side: string;
    createdAt: Date;
    updatedAt: Date;
  }): Position {
    return {
      id: position.id,
      portfolioId: position.portfolioId,
      symbol: position.symbol,
      quantity: Number(position.quantity),
      entryPrice: Number(position.entryPrice),
      averagePrice: Number(position.entryPrice),
      currentPrice: Number(position.currentPrice),
      value: Number(position.quantity) * Number(position.currentPrice),
      pnl: Number(position.pnl),
      pnlPercent: Number(position.pnlPercent),
      side: position.side as "LONG" | "SHORT",
      createdAt: position.createdAt,
      updatedAt: position.updatedAt,
    };
  }

  /**
   * Get transactions for a portfolio
   */
  async getTransactions(
    portfolioId: string,
    userId: string,
    options: { from?: Date; to?: Date; limit?: number } = {}
  ): Promise<
    Array<{
      id: string;
      timestamp: Date;
      symbol: string;
      side: string;
      quantity: number;
      price: number;
      value: number;
      pnl: number;
    }>
  > {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    // Verify portfolio belongs to user
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Set default date range (last 30 days)
    const defaultFrom = new Date(Date.now() - DEFAULT_DAYS * MS_IN_DAY);
    const fromDate = options.from ?? defaultFrom;
    const toDate = options.to ?? new Date();
    const limit = options.limit ?? DEFAULT_TRANSACTIONS_LIMIT;

    this.logger.info("Fetching transactions", {
      portfolioId,
      from: fromDate,
      to: toDate,
      limit,
    });

    // Query ClickHouse for trades
    const query = `
      SELECT 
        id,
        timestamp,
        symbol,
        side,
        quantity,
        price,
        quantity * price as value,
        pnl
      FROM aladdin.trades
      WHERE portfolioId = {portfolioId:String}
        AND timestamp >= {from:DateTime}
        AND timestamp <= {to:DateTime}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32}
    `;

    const tradesData = await this.clickhouse.query<{
      id: string;
      timestamp: string;
      symbol: string;
      side: string;
      quantity: string;
      price: string;
      value: string;
      pnl: string;
    }>(query, {
      portfolioId,
      from: formatDateForClickHouse(fromDate),
      to: formatDateForClickHouse(toDate),
      limit,
    });

    return tradesData.map((trade) => ({
      id: trade.id,
      timestamp: new Date(trade.timestamp),
      symbol: trade.symbol,
      side: trade.side,
      quantity: Number.parseFloat(trade.quantity),
      price: Number.parseFloat(trade.price),
      value: Number.parseFloat(trade.value),
      pnl: Number.parseFloat(trade.pnl || "0"),
    }));
  }

  /**
   * Create position manually
   */
  async createPosition(params: {
    portfolioId: string;
    userId: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    side: "LONG" | "SHORT";
  }): Promise<Position> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    // Verify portfolio belongs to user
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: params.portfolioId, userId: params.userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    this.logger.info("Creating position manually", {
      portfolioId: params.portfolioId,
      symbol: params.symbol,
    });

    // Check if position already exists
    const existingPosition = await this.prisma.position.findFirst({
      where: {
        portfolioId: params.portfolioId,
        symbol: params.symbol,
      },
    });

    if (existingPosition) {
      throw new Error(
        `Position for ${params.symbol} already exists. Use update instead.`
      );
    }

    // Create new position
    const position = await this.prisma.position.create({
      data: {
        portfolioId: params.portfolioId,
        symbol: params.symbol,
        quantity: params.quantity.toString(),
        entryPrice: params.entryPrice.toString(),
        currentPrice: params.entryPrice.toString(),
        pnl: "0",
        pnlPercent: "0",
        side: params.side,
      },
    });

    // Publish event
    await this.natsClient.publish(
      "portfolio.position.created",
      JSON.stringify({
        type: "portfolio.position.created",
        data: {
          portfolioId: params.portfolioId,
          position: this.formatPosition(position),
        },
      })
    );

    this.logger.info("Position created successfully", {
      portfolioId: params.portfolioId,
      positionId: position.id,
    });

    return this.formatPosition(position);
  }

  /**
   * Update position manually
   */
  async updatePositionManual(
    positionId: string,
    portfolioId: string,
    userId: string,
    data: { quantity?: number; entryPrice?: number }
  ): Promise<Position> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    // Verify portfolio belongs to user
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Get position
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, portfolioId },
    });

    if (!position) {
      throw new Error("Position not found");
    }

    this.logger.info("Updating position manually", {
      portfolioId,
      positionId,
      data,
    });

    // Calculate new P&L if prices changed
    const newQuantity = data.quantity ?? Number(position.quantity);
    const newEntryPrice = data.entryPrice ?? Number(position.entryPrice);
    const currentPrice = Number(position.currentPrice);

    const pnl = (currentPrice - newEntryPrice) * newQuantity;
    const pnlPercent =
      newEntryPrice > 0
        ? (pnl / (newEntryPrice * newQuantity)) * PERCENT_MULTIPLIER
        : 0;

    // Update position
    const updated = await this.prisma.position.update({
      where: { id: positionId },
      data: {
        ...(data.quantity && { quantity: data.quantity.toString() }),
        ...(data.entryPrice && { entryPrice: data.entryPrice.toString() }),
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toString(),
      },
    });

    // Publish event
    await this.natsClient.publish(
      "portfolio.position.updated",
      JSON.stringify({
        type: "portfolio.position.updated",
        data: {
          portfolioId,
          position: this.formatPosition(updated),
        },
      })
    );

    this.logger.info("Position updated successfully", {
      portfolioId,
      positionId,
    });

    return this.formatPosition(updated);
  }

  /**
   * Delete position
   */
  async deletePosition(
    positionId: string,
    portfolioId: string,
    userId: string
  ): Promise<void> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    // Verify portfolio belongs to user
    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Get position
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, portfolioId },
    });

    if (!position) {
      throw new Error("Position not found");
    }

    this.logger.info("Deleting position", {
      portfolioId,
      positionId,
      symbol: position.symbol,
    });

    // Delete position
    await this.prisma.position.delete({
      where: { id: positionId },
    });

    // Publish event
    await this.natsClient.publish(
      "portfolio.position.deleted",
      JSON.stringify({
        type: "portfolio.position.deleted",
        data: {
          portfolioId,
          position: this.formatPosition(position),
        },
      })
    );

    this.logger.info("Position deleted successfully", {
      portfolioId,
      positionId,
    });
  }

  /**
   * Verify portfolio access for a user (helper method)
   */
  private async verifyPortfolioAccess(
    portfolioId: string,
    userId: string
  ): Promise<{ id: string; userId: string }> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const portfolio = await this.prisma.portfolio.findFirst({
      where: { id: portfolioId, userId },
    });

    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    return portfolio;
  }

  /**
   * Import a single position (helper method)
   */
  private async importSinglePosition(params: {
    portfolioId: string;
    asset: { symbol: string; quantity: number; currentPrice: number };
    exchange?: string;
    exchangeCredentialsId?: string;
  }): Promise<{
    id: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
  }> {
    const { portfolioId, asset, exchange, exchangeCredentialsId } = params;

    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const existingPosition = await this.prisma.position.findFirst({
      where: {
        portfolioId,
        symbol: asset.symbol,
      },
    });

    if (existingPosition) {
      return this.updateExistingPosition({
        existingPosition,
        asset,
        portfolioId,
        exchange,
        exchangeCredentialsId,
      });
    }

    return this.createNewPosition({
      portfolioId,
      asset,
      exchange,
      exchangeCredentialsId,
    });
  }

  /**
   * Update an existing position (helper method)
   */
  private async updateExistingPosition(params: {
    existingPosition: {
      id: string;
      entryPrice: unknown;
      exchange: string;
      exchangeCredentialsId: string | null;
    };
    asset: { symbol: string; quantity: number; currentPrice: number };
    portfolioId: string;
    exchange?: string;
    exchangeCredentialsId?: string;
  }): Promise<{
    id: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
  }> {
    const {
      existingPosition,
      asset,
      portfolioId,
      exchange,
      exchangeCredentialsId,
    } = params;

    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const entryPrice = Number(existingPosition.entryPrice);
    const priceDiff = asset.currentPrice - entryPrice;

    const pnl = entryPrice === 0 ? 0 : priceDiff * asset.quantity;
    const pnlPercent =
      entryPrice === 0 ? 0 : (priceDiff / entryPrice) * PERCENT_MULTIPLIER;

    const updated = await this.prisma.position.update({
      where: { id: existingPosition.id },
      data: {
        quantity: asset.quantity.toString(),
        currentPrice: asset.currentPrice.toString(),
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toString(),
        exchange: exchange ?? existingPosition.exchange,
        exchangeCredentialsId:
          exchangeCredentialsId ?? existingPosition.exchangeCredentialsId,
      },
    });

    await this.natsClient.publish(
      "portfolio.position.updated",
      JSON.stringify({
        type: "portfolio.position.updated",
        data: {
          portfolioId,
          position: this.formatPosition(updated),
        },
      })
    );

    return {
      id: updated.id,
      symbol: updated.symbol,
      quantity: Number(updated.quantity),
      entryPrice: Number(updated.entryPrice),
      currentPrice: Number(updated.currentPrice),
    };
  }

  /**
   * Create a new position (helper method)
   */
  private async createNewPosition(params: {
    portfolioId: string;
    asset: { symbol: string; quantity: number; currentPrice: number };
    exchange?: string;
    exchangeCredentialsId?: string;
  }): Promise<{
    id: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    currentPrice: number;
  }> {
    const { portfolioId, asset, exchange, exchangeCredentialsId } = params;

    if (!this.prisma) {
      throw new Error("Database not available");
    }

    const created = await this.prisma.position.create({
      data: {
        portfolioId,
        symbol: asset.symbol,
        quantity: asset.quantity.toString(),
        entryPrice: asset.currentPrice.toString(),
        currentPrice: asset.currentPrice.toString(),
        side: "LONG",
        pnl: "0",
        pnlPercent: "0",
        exchange: exchange ?? "binance",
        exchangeCredentialsId,
      },
    });

    await this.natsClient.publish(
      "portfolio.position.created",
      JSON.stringify({
        type: "portfolio.position.created",
        data: {
          portfolioId,
          position: this.formatPosition(created),
        },
      })
    );

    return {
      id: created.id,
      symbol: created.symbol,
      quantity: Number(created.quantity),
      entryPrice: Number(created.entryPrice),
      currentPrice: Number(created.currentPrice),
    };
  }

  /**
   * Optimize portfolio weights using Mean-Variance Optimization
   */
  async optimizePortfolio(params: {
    portfolioId: string;
    userId: string;
    assets: string[];
    days?: number;
    constraints?: OptimizationConstraints;
  }): Promise<OptimizedPortfolio> {
    if (!this.clickhouse) {
      throw new Error("ClickHouse not available");
    }

    this.logger.info("Optimizing portfolio", {
      portfolioId: params.portfolioId,
    });

    const { assets, days = DEFAULT_DAYS, constraints } = params;

    // Get historical returns for each asset
    const statistics: Record<string, AssetStatistics> = {};

    for (const asset of assets) {
      const returns = await this.getAssetReturns(asset, days);
      statistics[asset] = PortfolioOptimizer.calculateAssetStatistics(returns);
    }

    // Run optimization
    const optimizer = new PortfolioOptimizer(this.logger);
    return optimizer.optimizePortfolio({
      assets,
      statistics,
      constraints,
    });
  }

  /**
   * Get historical returns for an asset
   */
  private async getAssetReturns(
    symbol: string,
    days: number
  ): Promise<number[]> {
    if (!this.clickhouse) {
      throw new Error("ClickHouse not available");
    }

    const startDate = new Date(Date.now() - days * MS_IN_DAY);
    const TIMEFRAME_1D = "1d";

    const query = `
      WITH daily_prices AS (
        SELECT
          toDate(timestamp) as date,
          argMax(close, timestamp) as close
        FROM aladdin.candles
        WHERE symbol = {symbol:String}
          AND timestamp >= {startDate:DateTime}
          AND timeframe = {timeframe:String}
        GROUP BY date
        ORDER BY date
      )
      SELECT
        date,
        close,
        (close - lag(close) OVER (ORDER BY date)) / nullIf(lag(close) OVER (ORDER BY date), 0) as return
      FROM daily_prices
      WHERE return IS NOT NULL
      ORDER BY date
    `;

    const data = await this.clickhouse.query<{
      date: string;
      close: string;
      return: string;
    }>(query, {
      symbol,
      startDate: formatDateForClickHouse(startDate),
      timeframe: TIMEFRAME_1D,
    });

    return data.map((row) => Number.parseFloat(row.return));
  }

  /**
   * Analyze portfolio rebalancing
   */
  async analyzeRebalancing(params: {
    portfolioId: string;
    userId: string;
    targetWeights: Record<string, number>;
    config: RebalancingConfig;
  }): Promise<RebalancingPlan> {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Analyzing rebalancing", {
      portfolioId: params.portfolioId,
    });

    // Get portfolio
    const portfolio = await this.getPortfolio(
      params.portfolioId,
      params.userId
    );

    if (!portfolio.positions || portfolio.positions.length === 0) {
      throw new Error("Portfolio has no positions");
    }

    // Convert positions to rebalancing format
    const positions: RebalancingPosition[] = portfolio.positions.map((pos) => ({
      symbol: pos.symbol,
      quantity: pos.quantity,
      currentPrice: pos.currentPrice,
      value: pos.quantity * pos.currentPrice,
    }));

    // Get last rebalance date from database
    const lastRebalance = await this.prisma.portfolioRebalance.findFirst({
      where: { portfolioId: params.portfolioId },
      orderBy: { createdAt: "desc" },
    });

    // Run rebalancing analysis
    const engine = new RebalancingEngine(this.logger);
    return engine.analyzeRebalancing({
      positions,
      targetWeights: params.targetWeights,
      config: params.config,
      lastRebalanceDate: lastRebalance?.createdAt,
    });
  }

  /**
   * Execute rebalancing (generate orders)
   */
  async executeRebalancing(params: {
    portfolioId: string;
    userId: string;
    plan: RebalancingPlan;
    dryRun?: boolean;
  }): Promise<
    Array<{
      symbol: string;
      side: "BUY" | "SELL";
      quantity: number;
      type: "LIMIT" | "MARKET";
      price?: number;
    }>
  > {
    if (!this.prisma) {
      throw new Error("Database not available");
    }

    this.logger.info("Executing rebalancing", {
      portfolioId: params.portfolioId,
      dryRun: params.dryRun,
    });

    // Verify portfolio ownership
    await this.getPortfolio(params.portfolioId, params.userId);

    const engine = new RebalancingEngine(this.logger);
    const orders = engine.executeRebalancing({
      plan: params.plan,
      dryRun: params.dryRun,
    });

    // Record rebalancing in database (if not dry-run)
    if (!params.dryRun && orders.length > 0) {
      await this.prisma.portfolioRebalance.create({
        data: {
          portfolioId: params.portfolioId,
          reason: params.plan.reason,
          totalCost: params.plan.totalTransactionCost.toString(),
          netBenefit: params.plan.netBenefit.toString(),
          priority: params.plan.priority,
          actions: JSON.stringify(params.plan.actions),
        },
      });

      // Publish event
      await this.natsClient.publish(
        "portfolio.rebalanced",
        JSON.stringify({
          type: "portfolio.rebalanced",
          data: {
            portfolioId: params.portfolioId,
            ordersCount: orders.length,
            totalCost: params.plan.totalTransactionCost,
          },
        })
      );
    }

    return orders;
  }
}
