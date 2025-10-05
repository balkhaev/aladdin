import crypto from "node:crypto";
import type { Logger } from "@aladdin/logger";
import type { OrderSide, OrderType } from "@aladdin/core";
import { retryWithBackoff } from "../utils/retry";
import type {
  Balance,
  CreateOrderParams,
  ExchangeConnector,
  ExchangeOrder,
} from "./types";

type BybitConfig = {
  apiKey: string;
  apiSecret: string;
  apiUrl: string;
  testnet: boolean;
  category: "spot" | "linear" | "inverse"; // spot, linear (USDT futures), inverse (Coin futures)
  logger: Logger;
};

/**
 * Bybit exchange connector
 * TODO: Add support for conditional orders (TP/SL)
 * TODO: Add WebSocket support for real-time order and position updates
 * TODO: Add support for position management (set leverage, margin mode)
 * TODO: Implement trailing stop orders
 */
export class BybitConnector implements ExchangeConnector {
  name = "bybit";
  private config: BybitConfig;

  constructor(config: BybitConfig) {
    this.config = config;
  }

  /**
   * Create HMAC signature for Bybit API
   */
  private sign(timestamp: number, params: string): string {
    const message = `${timestamp}${this.config.apiKey}5000${params}`;
    return crypto
      .createHmac("sha256", this.config.apiSecret)
      .update(message)
      .digest("hex");
  }

  /**
   * Make authenticated request to Bybit API with retry logic
   * TODO: Add rate limiting based on Bybit API limits (10 req/s for spot, 5 req/s for futures)
   * TODO: Parse and handle specific Bybit error codes (retCode)
   */
  private request<T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    params: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    return retryWithBackoff(
      async () => {
        const timestamp = Date.now();
        const recvWindow = 5000;

        let url = `${this.config.apiUrl}${endpoint}`;
        let body = "";
        let signaturePayload = "";

        if (method === "GET") {
          const queryParams = new URLSearchParams(
            params as Record<string, string>
          );
          const queryString = queryParams.toString();
          if (queryString) {
            url += `?${queryString}`;
            signaturePayload = queryString;
          }
        } else {
          body = JSON.stringify(params);
          signaturePayload = body;
        }

        const signature = this.sign(timestamp, signaturePayload);

        const response = await fetch(url, {
          method,
          headers: {
            "X-BAPI-API-KEY": this.config.apiKey,
            "X-BAPI-SIGN": signature,
            "X-BAPI-TIMESTAMP": timestamp.toString(),
            "X-BAPI-RECV-WINDOW": recvWindow.toString(),
            "Content-Type": "application/json",
          },
          body: method === "POST" ? body : undefined,
        });

        if (!response.ok) {
          const error = await response.text();
          this.config.logger.error("Bybit API error", {
            status: response.status,
            error,
            endpoint,
          });
          throw new Error(`Bybit API error (${response.status}): ${error}`);
        }

        const data = (await response.json()) as {
          retCode: number;
          retMsg: string;
          result: T;
        };

        // Handle Bybit-specific error codes
        if (data.retCode !== 0) {
          const errorMessage = `Bybit API error (${data.retCode}): ${data.retMsg}`;

          // Rate limit error codes: 10006, 10018
          // Server error codes: 10001
          const BYBIT_SERVER_ERROR = 10_001;
          const BYBIT_RATE_LIMIT_ERROR_1 = 10_006;
          const BYBIT_RATE_LIMIT_ERROR_2 = 10_018;
          const retryableCodes = [
            BYBIT_SERVER_ERROR,
            BYBIT_RATE_LIMIT_ERROR_1,
            BYBIT_RATE_LIMIT_ERROR_2,
          ];

          if (retryableCodes.includes(data.retCode)) {
            throw new Error(errorMessage);
          }

          throw new Error(errorMessage);
        }

        return data.result;
      },
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10_000,
        retryableErrors: [
          "10001",
          "10006",
          "10018",
          "500",
          "502",
          "503",
          "504",
          "timeout",
          "ECONNRESET",
        ],
      }
    );
  }

  /**
   * Convert order type to Bybit format
   */
  private convertOrderType(type: OrderType): string {
    switch (type) {
      case "MARKET":
        return "Market";
      case "LIMIT":
        return "Limit";
      default:
        throw new Error(`Unsupported order type for Bybit: ${type}`);
    }
  }

  /**
   * Convert order side to Bybit format
   */
  private convertOrderSide(side: OrderSide): string {
    return side === "BUY" ? "Buy" : "Sell";
  }

  /**
   * Create a new order
   */
  async createOrder(params: CreateOrderParams): Promise<ExchangeOrder> {
    const { logger } = this.config;

    try {
      logger.info("Creating Bybit order", params);

      const orderParams: Record<string, string | number> = {
        category: this.config.category,
        symbol: params.symbol,
        side: this.convertOrderSide(params.side),
        orderType: this.convertOrderType(params.type),
        qty: params.quantity.toString(),
      };

      // Add price for limit orders
      if (params.type === "LIMIT" && params.price) {
        orderParams.price = params.price.toString();
      }

      const result = await this.request<{
        orderId: string;
        orderLinkId: string;
      }>("/v5/order/create", "POST", orderParams);

      logger.info("Bybit order created", { orderId: result.orderId });

      return {
        orderId: result.orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        price: params.price,
        status: "NEW",
        filledQty: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error("Failed to create Bybit order", error);
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    const { logger } = this.config;

    try {
      logger.info("Cancelling Bybit order", { orderId, symbol });

      await this.request("/v5/order/cancel", "POST", {
        category: this.config.category,
        symbol,
        orderId,
      });

      logger.info("Bybit order cancelled", { orderId });
    } catch (error) {
      logger.error("Failed to cancel Bybit order", error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string, symbol: string): Promise<ExchangeOrder> {
    const { logger } = this.config;

    try {
      const result = await this.request<{
        list: Array<{
          orderId: string;
          symbol: string;
          side: string;
          orderType: string;
          qty: string;
          price: string;
          orderStatus: string;
          cumExecQty: string;
          avgPrice: string;
          createdTime: string;
          updatedTime: string;
        }>;
      }>("/v5/order/realtime", "GET", {
        category: this.config.category,
        orderId,
        symbol,
      });

      if (!result.list || result.list.length === 0) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const order = result.list[0];

      return {
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side === "Buy" ? "BUY" : "SELL",
        type: order.orderType === "Market" ? "MARKET" : "LIMIT",
        quantity: Number.parseFloat(order.qty),
        price: Number.parseFloat(order.price),
        status: this.convertOrderStatus(order.orderStatus),
        filledQty: Number.parseFloat(order.cumExecQty),
        avgPrice: order.avgPrice
          ? Number.parseFloat(order.avgPrice)
          : undefined,
        timestamp: Number.parseInt(order.createdTime, 10),
      };
    } catch (error) {
      logger.error("Failed to get Bybit order", error);
      throw error;
    }
  }

  /**
   * Get order history (completed orders)
   */
  async getOrderHistory(params?: {
    symbol?: string;
    limit?: number;
  }): Promise<ExchangeOrder[]> {
    const { logger } = this.config;

    try {
      const requestParams: Record<string, string> = {
        category: this.config.category,
      };

      if (params?.symbol) {
        requestParams.symbol = params.symbol;
      } else if (this.config.category === "linear") {
        // Для фьючерсов без symbol нужен settleCoin
        requestParams.settleCoin = "USDT";
      }
      if (params?.limit) {
        requestParams.limit = params.limit.toString();
      }

      const result = await this.request<{
        list: Array<{
          orderId: string;
          symbol: string;
          side: string;
          orderType: string;
          qty: string;
          price: string;
          orderStatus: string;
          cumExecQty: string;
          avgPrice: string;
          createdTime: string;
          updatedTime: string;
        }>;
      }>("/v5/order/history", "GET", requestParams);

      logger.info("Bybit API response for order history", {
        count: result.list.length,
        params: requestParams,
      });

      return result.list.map((order) => ({
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side === "Buy" ? "BUY" : "SELL",
        type: order.orderType === "Market" ? "MARKET" : "LIMIT",
        quantity: Number.parseFloat(order.qty),
        price: Number.parseFloat(order.price),
        status: this.convertOrderStatus(order.orderStatus),
        filledQty: Number.parseFloat(order.cumExecQty),
        avgPrice: order.avgPrice
          ? Number.parseFloat(order.avgPrice)
          : undefined,
        timestamp: Number.parseInt(order.createdTime, 10),
      }));
    } catch (error) {
      logger.error("Failed to get Bybit order history", error);
      throw error;
    }
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<ExchangeOrder[]> {
    const { logger } = this.config;

    try {
      const params: Record<string, string> = {
        category: this.config.category,
      };

      if (symbol) {
        params.symbol = symbol;
      } else if (this.config.category === "linear") {
        // Для фьючерсов без symbol нужен settleCoin
        params.settleCoin = "USDT";
      }

      const result = await this.request<{
        list: Array<{
          orderId: string;
          symbol: string;
          side: string;
          orderType: string;
          qty: string;
          price: string;
          orderStatus: string;
          cumExecQty: string;
          avgPrice: string;
          createdTime: string;
          updatedTime: string;
        }>;
      }>("/v5/order/realtime", "GET", params);

      logger.info("Bybit API response for open orders", {
        count: result.list.length,
        params,
        orders: result.list,
      });

      return result.list.map((order) => ({
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side === "Buy" ? "BUY" : "SELL",
        type: order.orderType === "Market" ? "MARKET" : "LIMIT",
        quantity: Number.parseFloat(order.qty),
        price: Number.parseFloat(order.price),
        status: this.convertOrderStatus(order.orderStatus),
        filledQty: Number.parseFloat(order.cumExecQty),
        avgPrice: order.avgPrice
          ? Number.parseFloat(order.avgPrice)
          : undefined,
        timestamp: Number.parseInt(order.createdTime, 10),
      }));
    } catch (error) {
      logger.error("Failed to get Bybit orders", error);
      throw error;
    }
  }

  /**
   * Get positions (for futures only)
   * TODO: Add position risk metrics (liquidation price, margin ratio)
   * TODO: Support for multiple position modes (one-way, hedge mode)
   */
  async getPositions(params?: { symbol?: string }): Promise<
    Array<{
      symbol: string;
      side: "Buy" | "Sell";
      size: number;
      entryPrice: number;
      markPrice: number;
      unrealisedPnl: number;
      leverage: number;
    }>
  > {
    const { logger } = this.config;

    try {
      // Positions only available for futures
      if (this.config.category === "spot") {
        logger.warn("Positions not available for spot trading");
        return [];
      }

      const requestParams: Record<string, string> = {
        category: this.config.category,
        settleCoin: "USDT", // For linear contracts
      };

      if (params?.symbol) {
        requestParams.symbol = params.symbol;
      }

      const result = await this.request<{
        list: Array<{
          symbol: string;
          side: "Buy" | "Sell";
          size: string;
          positionValue: string;
          avgPrice: string;
          markPrice: string;
          unrealisedPnl: string;
          leverage: string;
        }>;
      }>("/v5/position/list", "GET", requestParams);

      logger.info("Bybit API response for positions", {
        count: result.list.length,
        params: requestParams,
      });

      return result.list
        .filter((pos) => Number.parseFloat(pos.size) !== 0) // Filter out empty positions
        .map((position) => ({
          symbol: position.symbol,
          side: position.side,
          size: Number.parseFloat(position.size),
          entryPrice: Number.parseFloat(position.avgPrice),
          markPrice: Number.parseFloat(position.markPrice),
          unrealisedPnl: Number.parseFloat(position.unrealisedPnl),
          leverage: Number.parseFloat(position.leverage),
        }));
    } catch (error) {
      logger.error("Failed to get Bybit positions", error);
      throw error;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<Balance[]> {
    const { logger } = this.config;

    try {
      const result = await this.request<{
        list: Array<{
          coin: Array<{
            coin: string;
            walletBalance: string;
            free: string;
            locked: string;
          }>;
        }>;
      }>("/v5/account/wallet-balance", "GET", {
        accountType: "UNIFIED", // Bybit v5 API requires UNIFIED account type
      });

      if (!result.list || result.list.length === 0) {
        return [];
      }

      const coins = result.list[0].coin;

      return coins.map((coin) => ({
        asset: coin.coin,
        free: Number.parseFloat(coin.free),
        locked: Number.parseFloat(coin.locked),
        total: Number.parseFloat(coin.walletBalance),
      }));
    } catch (error) {
      logger.error("Failed to get Bybit balance", error);
      throw error;
    }
  }

  /**
   * Test connection to Bybit
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getBalance();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert Bybit order status to internal format
   */
  private convertOrderStatus(
    status: string
  ):
    | "NEW"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELED"
    | "REJECTED"
    | "EXPIRED" {
    switch (status) {
      case "New":
      case "Untriggered": // Условные ордера (Stop Loss, Take Profit)
        return "NEW";
      case "PartiallyFilled":
        return "PARTIALLY_FILLED";
      case "Filled":
        return "FILLED";
      case "Cancelled":
        return "CANCELED";
      case "Rejected":
        return "REJECTED";
      case "Expired":
        return "EXPIRED";
      default:
        return "NEW";
    }
  }
}
