import { BaseService } from "@aladdin/shared/base-service";
import { decrypt } from "@aladdin/shared/crypto";
import { NotFoundError } from "@aladdin/shared/errors";
import type {
  Order,
  OrderSide,
  OrderStatus,
  OrderType,
} from "@aladdin/shared/types";
import { BinanceConnector } from "../connectors/binance";
import { BybitConnector } from "../connectors/bybit";
import type { ExchangeConnector } from "../connectors/types";
import {
  MarketImpactModel,
  type MarketImpactParams,
  type MarketImpactResult,
  type OrderSplittingStrategy,
} from "./market-impact";
import {
  type ExchangeQuote,
  type PriceComparison,
  type RouteRecommendation,
  SmartOrderRouter,
  type SmartRouteParams,
} from "./smart-order-router";

export type CreateOrderParams = {
  userId: string;
  portfolioId?: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
};

type CachedConnector = {
  connector: ExchangeConnector;
  createdAt: number;
};

type CachedBalance = {
  balances: Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
  }>;
  cachedAt: number;
};

const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const MS_IN_SECOND = 1000;
const MINUTES_CLEANUP = 10;
const BALANCE_CACHE_TTL_SECONDS = 30;
const CACHE_TTL_MS = MINUTES_IN_HOUR * SECONDS_IN_MINUTE * MS_IN_SECOND; // 1 hour
const BALANCE_CACHE_TTL_MS = BALANCE_CACHE_TTL_SECONDS * MS_IN_SECOND; // 30 seconds for balance cache
const MAX_CACHE_SIZE = 1000; // Maximum 1000 connectors
const CACHE_CLEANUP_INTERVAL_MS =
  MINUTES_CLEANUP * SECONDS_IN_MINUTE * MS_IN_SECOND; // 10 minutes
const DEFAULT_ORDERS_LIMIT = 50;

/**
 * Trading Service - управление ордерами и позициями
 */
export class TradingService extends BaseService {
  private connectorCache: Map<string, CachedConnector> = new Map();
  private balanceCache: Map<string, CachedBalance> = new Map();
  private cleanupInterval?: Timer;
  private marketImpactModel: MarketImpactModel;
  private smartOrderRouter: SmartOrderRouter;

  getServiceName(): string {
    return "trading";
  }

  protected onInitialize(): Promise<void> {
    if (!this.natsClient) {
      throw new Error("NATS client is required for Trading Service");
    }
    if (!this.prisma) {
      throw new Error("Prisma client is required for Trading Service");
    }

    // Initialize market impact model
    this.marketImpactModel = new MarketImpactModel(this.logger);

    // Initialize smart order router
    this.smartOrderRouter = new SmartOrderRouter(this.logger);

    // Start periodic cleanup of connector cache
    this.cleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, CACHE_CLEANUP_INTERVAL_MS);
    return Promise.resolve();
  }

  protected onStop(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    // Clear caches
    this.connectorCache.clear();
    this.balanceCache.clear();
    return Promise.resolve();
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      connectorCache: this.connectorCache.size < MAX_CACHE_SIZE,
      balanceCache: this.balanceCache.size < MAX_CACHE_SIZE,
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let removedConnectors = 0;
    let removedBalances = 0;

    // Cleanup connector cache
    for (const [key, cached] of this.connectorCache.entries()) {
      if (now - cached.createdAt > CACHE_TTL_MS) {
        this.connectorCache.delete(key);
        removedConnectors++;
      }
    }

    // If still too large, remove oldest entries
    if (this.connectorCache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(this.connectorCache.entries());
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);

      const toRemove = this.connectorCache.size - MAX_CACHE_SIZE;
      for (let i = 0; i < toRemove; i++) {
        this.connectorCache.delete(entries[i][0]);
        removedConnectors++;
      }
    }

    // Cleanup balance cache
    for (const [key, cached] of this.balanceCache.entries()) {
      if (now - cached.cachedAt > BALANCE_CACHE_TTL_MS) {
        this.balanceCache.delete(key);
        removedBalances++;
      }
    }

    if (removedConnectors > 0 || removedBalances > 0) {
      this.logger.info("Cleaned up caches", {
        connectors: removedConnectors,
        balances: removedBalances,
      });
    }
  }

  /**
   * Create exchange connector instance
   * Factory method for creating connectors
   */
  private createConnector(
    exchange: string,
    credentials: {
      apiKey: string;
      apiSecret: string;
      testnet: boolean;
      category?: string | null;
    }
  ): ExchangeConnector {
    switch (exchange.toLowerCase()) {
      case "binance":
        return new BinanceConnector({
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          apiUrl: credentials.testnet
            ? "https://testnet.binance.vision"
            : "https://api.binance.com",
          testnet: credentials.testnet,
          logger: this.logger,
        });
      case "bybit":
        return new BybitConnector({
          apiKey: credentials.apiKey,
          apiSecret: credentials.apiSecret,
          apiUrl: credentials.testnet
            ? "https://api-testnet.bybit.com"
            : "https://api.bybit.com",
          testnet: credentials.testnet,
          category:
            (credentials.category as "spot" | "linear" | "inverse") || "spot", // Используем category из credentials (spot, linear, inverse)
          logger: this.logger,
        });
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  /**
   * Get exchange connector for user
   */
  async getExchangeConnector(
    userId: string,
    exchange: string
  ): Promise<ExchangeConnector> {
    const cacheKey = `${userId}:${exchange}`;

    // Check cache
    const cached = this.connectorCache.get(cacheKey);
    if (cached) {
      // Check if not expired
      if (Date.now() - cached.createdAt < CACHE_TTL_MS) {
        return cached.connector;
      }
      // Remove expired entry
      this.connectorCache.delete(cacheKey);
    }

    if (!this.prisma) {
      throw new Error("Prisma client not initialized");
    }

    // Get credentials from database
    const credentials = await this.prisma.exchangeCredentials.findFirst({
      where: {
        userId,
        exchange: exchange.toLowerCase(),
        isActive: true,
      },
    });

    if (!credentials) {
      throw new NotFoundError(
        `Exchange credentials not found for ${exchange}. Please connect your ${exchange} account in the settings to enable trading.`
      );
    }

    // Decrypt API secret
    const apiSecret = decrypt(
      credentials.apiSecret,
      credentials.apiSecretIv,
      credentials.apiSecretAuthTag
    );

    // Create connector using factory method
    const connector = this.createConnector(exchange, {
      apiKey: credentials.apiKey,
      apiSecret,
      testnet: credentials.testnet,
      category: credentials.category,
    });

    // Cache connector with timestamp
    this.connectorCache.set(cacheKey, {
      connector,
      createdAt: Date.now(),
    });

    return connector;
  }

  /**
   * Create a new order
   * TODO: Add rate limiting per user/exchange to prevent API abuse
   * TODO: Add idempotency key support to prevent duplicate orders
   * TODO: Implement retry logic with exponential backoff for transient failures
   */
  async createOrder(
    params: CreateOrderParams & { exchange: string }
  ): Promise<Order> {
    this.logger.info("Creating order", {
      symbol: params.symbol,
      type: params.type,
      side: params.side,
      quantity: params.quantity,
      exchange: params.exchange,
    });

    if (!this.prisma) {
      throw new Error("Prisma client not initialized");
    }
    if (!this.natsClient) {
      throw new Error("NATS client not initialized");
    }

    // TODO: Wrap balance check and order creation in a database transaction
    // TODO: Add risk checks (position limits, leverage limits, max order size)
    // 1. Check portfolio balance if portfolioId is provided
    if (params.portfolioId && params.side === "BUY") {
      const portfolio = await this.prisma.portfolio.findUnique({
        where: { id: params.portfolioId },
      });

      if (!portfolio) {
        throw new NotFoundError(`Portfolio ${params.portfolioId} not found`);
      }

      const balance = Number(portfolio.balance);
      const orderValue = params.quantity * (params.price ?? 0);

      // TODO: For market orders, fetch current market price from market-data service
      // For market orders, we need a price estimate
      if (params.type === "MARKET" && !params.price) {
        this.logger.warn(
          "Cannot check balance for MARKET order without price estimate",
          { portfolioId: params.portfolioId }
        );
      } else if (orderValue > balance) {
        throw new Error(
          `Insufficient balance. Required: ${orderValue} ${portfolio.currency}, Available: ${balance} ${portfolio.currency}`
        );
      }
    }

    // Get exchange connector for user
    const connector = await this.getExchangeConnector(
      params.userId,
      params.exchange
    );

    // TODO: Add pre-order validation (min/max order size, price filters, lot size)
    // Create order on exchange
    const exchangeOrder = await connector.createOrder({
      symbol: params.symbol,
      type: params.type,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
    });

    // TODO: If exchange order fails, we should handle partial state (order not created in DB)
    // Save to database
    const order = await this.prisma.order.create({
      data: {
        userId: params.userId,
        portfolioId: params.portfolioId,
        symbol: params.symbol,
        type: params.type,
        side: params.side,
        quantity: params.quantity.toString(),
        price: params.price?.toString(),
        stopPrice: params.stopPrice?.toString(),
        status: this.convertStatus(exchangeOrder.status),
        filledQty: exchangeOrder.filledQty.toString(),
        avgPrice: exchangeOrder.avgPrice?.toString(),
        exchange: params.exchange.toLowerCase(),
        exchangeOrderId: exchangeOrder.orderId,
      },
    });

    // TODO: Store order in ClickHouse for analytics
    // Publish event to NATS
    await this.natsClient.publish(
      "trading.order.created",
      JSON.stringify({
        type: "trading.order.created",
        data: this.formatOrder(order),
      })
    );

    this.logger.info("Order created successfully", {
      orderId: order.id,
    });

    return this.formatOrder(order);
  }

  /**
   * Cancel an order
   * TODO: Add batch cancel support for multiple orders
   * TODO: Add ability to cancel all orders for a symbol/portfolio
   */
  async cancelOrder(orderId: string, userId: string): Promise<Order> {
    this.logger.info("Cancelling order", { orderId, userId });

    if (!this.prisma) {
      throw new Error("Prisma client not initialized");
    }
    if (!this.natsClient) {
      throw new Error("NATS client not initialized");
    }

    // Get order from database
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.status === "FILLED" || order.status === "CANCELLED") {
      throw new Error(`Order already ${order.status.toLowerCase()}`);
    }

    // Cancel on exchange
    if (order.exchangeOrderId) {
      const connector = await this.getExchangeConnector(userId, order.exchange);
      // TODO: Handle case where order was already filled on exchange but DB is stale
      await connector.cancelOrder(order.exchangeOrderId, order.symbol);
    }

    // Update in database
    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
    });

    // Publish event to NATS
    await this.natsClient.publish(
      "trading.order.cancelled",
      JSON.stringify({
        type: "trading.order.cancelled",
        data: this.formatOrder(updatedOrder),
      })
    );

    this.logger.info("Order cancelled successfully", { orderId });

    return this.formatOrder(updatedOrder);
  }

  /**
   * Get user orders from exchange and sync with database
   * TODO: Add caching for recently fetched orders to reduce exchange API calls
   * TODO: Add pagination support for large order lists
   * TODO: Add date range filters (createdAfter, createdBefore)
   */
  async getOrders(params: {
    userId: string;
    portfolioId?: string;
    symbol?: string;
    status?: OrderStatus;
    exchange: string;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: Order[]; total: number }> {
    const {
      userId,
      portfolioId,
      symbol,
      status,
      exchange,
      limit = DEFAULT_ORDERS_LIMIT,
      offset = 0,
    } = params;

    // Get orders from exchange
    // If specific status requested, get from exchange
    if (
      status === "OPEN" ||
      status === "PENDING" ||
      status === "FILLED" ||
      status === "PARTIALLY_FILLED"
    ) {
      try {
        const connector = await this.getExchangeConnector(userId, exchange);

        // Get both open orders and recent history
        const openOrders = await connector.getOpenOrders(symbol);

        // Also get order history if available
        let historyOrders: typeof openOrders = [];
        if (
          "getOrderHistory" in connector &&
          typeof connector.getOrderHistory === "function"
        ) {
          const getHistoryFn = connector.getOrderHistory as (opts: {
            symbol?: string;
            limit?: number;
          }) => Promise<typeof openOrders>;
          historyOrders = await getHistoryFn({
            symbol,
            limit: DEFAULT_ORDERS_LIMIT,
          });
        }

        const exchangeOrders = [...openOrders, ...historyOrders];

        this.logger.info("Fetched orders from exchange", {
          exchange,
          count: exchangeOrders.length,
          openCount: openOrders.length,
          historyCount: historyOrders.length,
        });

        // TODO: Batch database operations instead of individual queries
        // Sync with database
        for (const exchangeOrder of exchangeOrders) {
          const existingOrder = this.prisma
            ? await this.prisma.order.findFirst({
                where: {
                  userId,
                  exchangeOrderId: exchangeOrder.orderId,
                  exchange: exchange.toLowerCase(),
                },
              })
            : null;

          if (existingOrder) {
            // Update existing order
            this.prisma &&
              (await this.prisma.order.update({
                where: { id: existingOrder.id },
                data: {
                  status: this.convertStatus(exchangeOrder.status),
                  filledQty: exchangeOrder.filledQty.toString(),
                  avgPrice: exchangeOrder.avgPrice?.toString(),
                },
              }));
          } else {
            // Create new order in database
            this.prisma &&
              (await this.prisma.order.create({
                data: {
                  userId,
                  portfolioId: portfolioId ?? null,
                  symbol: exchangeOrder.symbol,
                  type: exchangeOrder.type,
                  side: exchangeOrder.side,
                  quantity: exchangeOrder.quantity.toString(),
                  price: exchangeOrder.price?.toString(),
                  status: this.convertStatus(exchangeOrder.status),
                  filledQty: exchangeOrder.filledQty.toString(),
                  avgPrice: exchangeOrder.avgPrice?.toString(),
                  exchange: exchange.toLowerCase(),
                  exchangeOrderId: exchangeOrder.orderId,
                },
              }));
          }
        }
      } catch (error) {
        this.logger.error("Failed to fetch orders from exchange", error);
        // Continue with database query even if exchange fails
      }
    }

    // Query from database
    const where = {
      userId,
      exchange: exchange.toLowerCase(),
      ...(portfolioId && { portfolioId }),
      ...(symbol && { symbol }),
      ...(status && { status }),
    };

    const [orders, total] = this.prisma
      ? await Promise.all([
          this.prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
          }),
          this.prisma.order.count({ where }),
        ])
      : [[], 0];

    return {
      orders: orders.map((o) => this.formatOrder(o)),
      total,
    };
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, userId: string): Promise<Order | null> {
    if (!this.prisma) {
      return null;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      return null;
    }

    return this.formatOrder(order);
  }

  /**
   * Sync order status with exchange
   * TODO: Add background job to periodically sync all active orders
   * TODO: Implement webhook support from exchanges for real-time updates
   */
  async syncOrderStatus(orderId: string): Promise<Order> {
    if (!this.prisma) {
      throw new Error("Prisma client not initialized");
    }
    if (!this.natsClient) {
      throw new Error("NATS client not initialized");
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order?.exchangeOrderId) {
      throw new NotFoundError("Order");
    }

    const connector = await this.getExchangeConnector(
      order.userId,
      order.exchange
    );
    const exchangeOrder = await connector.getOrder(
      order.exchangeOrderId,
      order.symbol
    );

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: this.convertStatus(exchangeOrder.status),
        filledQty: exchangeOrder.filledQty.toString(),
        avgPrice: exchangeOrder.avgPrice?.toString(),
      },
    });

    // Publish event based on status
    if (updatedOrder.status === "FILLED") {
      await this.natsClient.publish(
        "trading.order.filled",
        JSON.stringify({
          type: "trading.order.filled",
          data: {
            order: this.formatOrder(updatedOrder),
            trades: [],
          },
        })
      );
    } else {
      // Publish update event for other status changes
      await this.natsClient.publish(
        "trading.order.updated",
        JSON.stringify({
          type: "trading.order.updated",
          data: this.formatOrder(updatedOrder),
        })
      );
    }

    return this.formatOrder(updatedOrder);
  }

  /**
   * Convert exchange status to our status
   */
  private convertStatus(
    status:
      | "NEW"
      | "PARTIALLY_FILLED"
      | "FILLED"
      | "CANCELED"
      | "REJECTED"
      | "EXPIRED"
  ): OrderStatus {
    switch (status) {
      case "NEW":
        return "PENDING";
      case "PARTIALLY_FILLED":
        return "PARTIALLY_FILLED";
      case "FILLED":
        return "FILLED";
      case "CANCELED":
        return "CANCELLED";
      case "REJECTED":
        return "REJECTED";
      case "EXPIRED":
        return "EXPIRED";
      default:
        return "PENDING";
    }
  }

  /**
   * Get exchange balances (spot assets) for user
   * TODO: Support futures account balances separately
   * TODO: Calculate USD value of balances using current market prices
   */
  async getExchangeBalances(
    exchangeCredentialsId: string,
    userId: string
  ): Promise<
    Array<{
      asset: string;
      free: number;
      locked: number;
      total: number;
    }>
  > {
    // Check cache first
    const cacheKey = `${userId}:${exchangeCredentialsId}`;
    const cached = this.balanceCache.get(cacheKey);

    if (cached) {
      const age = Date.now() - cached.cachedAt;
      if (age < BALANCE_CACHE_TTL_MS) {
        this.logger.debug("Returning cached balances", {
          exchangeCredentialsId,
          userId,
          cacheAge: age,
        });
        return cached.balances;
      }
      // Remove expired cache
      this.balanceCache.delete(cacheKey);
    }

    this.logger.info("Fetching exchange balances", {
      exchangeCredentialsId,
      userId,
    });

    try {
      if (!this.prisma) {
        throw new Error("Prisma client not initialized");
      }

      // Get credentials from database
      const credentials = await this.prisma.exchangeCredentials.findFirst({
        where: {
          id: exchangeCredentialsId,
          userId,
          isActive: true,
        },
      });

      if (!credentials) {
        throw new NotFoundError("Exchange credentials");
      }

      // Decrypt API secret
      const apiSecret = decrypt(
        credentials.apiSecret,
        credentials.apiSecretIv,
        credentials.apiSecretAuthTag
      );

      // Use factory method to create connector
      const connector = this.createConnector(credentials.exchange, {
        apiKey: credentials.apiKey,
        apiSecret,
        testnet: credentials.testnet,
        category: credentials.category,
      });

      // Get balances from exchange
      const balances = await connector.getBalance();

      // Filter out zero balances
      const nonZeroBalances = balances.filter((b) => b.total > 0);

      this.logger.info("Retrieved exchange balances", {
        exchange: credentials.exchange,
        count: nonZeroBalances.length,
      });

      // Cache the result
      this.balanceCache.set(cacheKey, {
        balances: nonZeroBalances,
        cachedAt: Date.now(),
      });

      return nonZeroBalances;
    } catch (error) {
      this.logger.error("Failed to get exchange balances", error);
      throw error;
    }
  }

  /**
   * Format order for API response
   */
  private formatOrder(order: {
    id: string;
    userId: string;
    portfolioId: string | null;
    symbol: string;
    type: string;
    side: string;
    quantity: unknown;
    price: unknown;
    stopPrice: unknown;
    status: string;
    filledQty: unknown;
    avgPrice: unknown;
    exchange: string;
    exchangeOrderId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Order {
    return {
      id: order.id,
      userId: order.userId,
      portfolioId: order.portfolioId ?? undefined,
      symbol: order.symbol,
      type: order.type as OrderType,
      side: order.side as OrderSide,
      quantity: Number(order.quantity),
      price: order.price ? Number(order.price) : undefined,
      stopPrice: order.stopPrice ? Number(order.stopPrice) : undefined,
      status: order.status as OrderStatus,
      filledQty: Number(order.filledQty),
      avgPrice: order.avgPrice ? Number(order.avgPrice) : undefined,
      exchange: order.exchange,
      exchangeOrderId: order.exchangeOrderId ?? undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  /**
   * Calculate market impact for an order
   */
  calculateMarketImpact(params: MarketImpactParams): MarketImpactResult {
    return this.marketImpactModel.calculateImpact(params);
  }

  /**
   * Generate order splitting strategy
   */
  generateSplittingStrategy(params: {
    impact: MarketImpactResult;
    orderSize: number;
    volatility?: number;
  }): OrderSplittingStrategy {
    return this.marketImpactModel.generateSplittingStrategy(params);
  }

  /**
   * Calculate implementation shortfall
   */
  calculateImplementationShortfall(params: {
    decisionPrice: number;
    actualFillPrice: number;
    orderSize: number;
    side: "BUY" | "SELL";
  }): {
    shortfall: number;
    shortfallBps: number;
    cost: number;
  } {
    return this.marketImpactModel.calculateImplementationShortfall(params);
  }

  /**
   * Find optimal route for order execution
   */
  findOptimalRoute(
    params: SmartRouteParams,
    quotes: ExchangeQuote[]
  ): RouteRecommendation {
    return this.smartOrderRouter.findOptimalRoute(params, quotes);
  }

  /**
   * Compare prices across exchanges
   */
  comparePrices(
    symbol: string,
    side: "BUY" | "SELL",
    quotes: ExchangeQuote[]
  ): PriceComparison {
    return this.smartOrderRouter.comparePrices(symbol, side, quotes);
  }
}
