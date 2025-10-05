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

type BinanceConfig = {
  apiKey: string;
  apiSecret: string;
  apiUrl: string;
  testnet: boolean;
  logger: Logger;
};

/**
 * Binance exchange connector
 * TODO: Add support for Binance Futures API
 * TODO: Add WebSocket support for real-time order updates
 * TODO: Add support for OCO (One-Cancels-Other) orders
 * TODO: Implement order modification (edit price/quantity)
 */
export class BinanceConnector implements ExchangeConnector {
  name = "binance";
  private config: BinanceConfig;

  constructor(config: BinanceConfig) {
    this.config = config;
  }

  /**
   * Create HMAC signature for Binance API
   */
  private sign(queryString: string): string {
    return crypto
      .createHmac("sha256", this.config.apiSecret)
      .update(queryString)
      .digest("hex");
  }

  /**
   * Make authenticated request to Binance API with retry logic
   * TODO: Add rate limiting based on Binance API weight limits
   * TODO: Parse and handle specific Binance error codes
   */
  private request<T>(
    endpoint: string,
    method: "GET" | "POST" | "DELETE" = "GET",
    params: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    return retryWithBackoff(
      async () => {
        const timestamp = Date.now();
        const queryParams = new URLSearchParams({
          ...params,
          timestamp: timestamp.toString(),
        } as Record<string, string>);

        const signature = this.sign(queryParams.toString());
        queryParams.append("signature", signature);

        const url = `${this.config.apiUrl}${endpoint}?${queryParams.toString()}`;

        const response = await fetch(url, {
          method,
          headers: {
            "X-MBX-APIKEY": this.config.apiKey,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const error = await response.text();
          this.config.logger.error("Binance API error", {
            status: response.status,
            error,
            endpoint,
          });

          const errorMessage = `Binance API error (${response.status}): ${error}`;

          const RATE_LIMIT_STATUS = 429;
          const SERVER_ERROR_STATUS = 500;

          // Check if error is retryable
          if (
            response.status === RATE_LIMIT_STATUS ||
            response.status >= SERVER_ERROR_STATUS
          ) {
            throw new Error(errorMessage);
          }

          throw new Error(errorMessage);
        }

        return response.json();
      },
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10_000,
        retryableErrors: [
          "429",
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
   * Convert order type to Binance format
   */
  private convertOrderType(type: OrderType): string {
    switch (type) {
      case "MARKET":
        return "MARKET";
      case "LIMIT":
        return "LIMIT";
      case "STOP_LOSS":
        return "STOP_LOSS";
      case "TAKE_PROFIT":
        return "TAKE_PROFIT";
      case "STOP_LOSS_LIMIT":
        return "STOP_LOSS_LIMIT";
      case "TAKE_PROFIT_LIMIT":
        return "TAKE_PROFIT_LIMIT";
      default:
        throw new Error(`Unknown order type: ${type}`);
    }
  }

  /**
   * Create order on Binance
   */
  async createOrder(params: CreateOrderParams): Promise<ExchangeOrder> {
    this.config.logger.info("Creating order on Binance", params);

    const orderParams: Record<string, string | number> = {
      symbol: params.symbol,
      side: params.side,
      type: this.convertOrderType(params.type),
      quantity: params.quantity,
    };

    // Add price for LIMIT orders
    if (params.type === "LIMIT" || params.type.includes("LIMIT")) {
      if (!params.price) {
        throw new Error("Price is required for LIMIT orders");
      }
      orderParams.price = params.price;
      orderParams.timeInForce = params.timeInForce ?? "GTC";
    }

    // Add stop price for STOP orders
    if (params.type.includes("STOP")) {
      if (!params.stopPrice) {
        throw new Error("Stop price is required for STOP orders");
      }
      orderParams.stopPrice = params.stopPrice;
    }

    const response = await this.request<{
      orderId: number;
      symbol: string;
      status: string;
      type: string;
      side: string;
      origQty: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      price: string;
      stopPrice?: string;
      transactTime: number;
    }>("/api/v3/order", "POST", orderParams);

    return {
      orderId: response.orderId.toString(),
      symbol: response.symbol,
      type: params.type,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      status: this.convertStatus(response.status),
      filledQty: Number.parseFloat(response.executedQty),
      avgPrice:
        Number.parseFloat(response.cummulativeQuoteQty) /
          Number.parseFloat(response.executedQty) || undefined,
      timestamp: response.transactTime,
    };
  }

  /**
   * Cancel order on Binance
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    this.config.logger.info("Cancelling order on Binance", { orderId, symbol });

    await this.request("/api/v3/order", "DELETE", {
      symbol,
      orderId: Number.parseInt(orderId, 10),
    });
  }

  /**
   * Get order from Binance
   */
  async getOrder(orderId: string, symbol: string): Promise<ExchangeOrder> {
    const response = await this.request<{
      orderId: number;
      symbol: string;
      status: string;
      type: string;
      side: string;
      origQty: string;
      executedQty: string;
      cummulativeQuoteQty: string;
      price: string;
      stopPrice?: string;
      time: number;
    }>("/api/v3/order", "GET", {
      symbol,
      orderId: Number.parseInt(orderId, 10),
    });

    return {
      orderId: response.orderId.toString(),
      symbol: response.symbol,
      type: response.type as OrderType,
      side: response.side as OrderSide,
      quantity: Number.parseFloat(response.origQty),
      price: Number.parseFloat(response.price) || undefined,
      stopPrice: response.stopPrice
        ? Number.parseFloat(response.stopPrice)
        : undefined,
      status: this.convertStatus(response.status),
      filledQty: Number.parseFloat(response.executedQty),
      avgPrice:
        Number.parseFloat(response.cummulativeQuoteQty) /
          Number.parseFloat(response.executedQty) || undefined,
      timestamp: response.time,
    };
  }

  /**
   * Get open orders from Binance
   */
  async getOpenOrders(symbol?: string): Promise<ExchangeOrder[]> {
    const params: Record<string, string> = {};
    if (symbol) {
      params.symbol = symbol;
    }

    const response = await this.request<
      Array<{
        orderId: number;
        symbol: string;
        status: string;
        type: string;
        side: string;
        origQty: string;
        executedQty: string;
        cummulativeQuoteQty: string;
        price: string;
        stopPrice?: string;
        time: number;
      }>
    >("/api/v3/openOrders", "GET", params);

    return response.map((order) => ({
      orderId: order.orderId.toString(),
      symbol: order.symbol,
      type: order.type as OrderType,
      side: order.side as OrderSide,
      quantity: Number.parseFloat(order.origQty),
      price: Number.parseFloat(order.price) || undefined,
      stopPrice: order.stopPrice
        ? Number.parseFloat(order.stopPrice)
        : undefined,
      status: this.convertStatus(order.status),
      filledQty: Number.parseFloat(order.executedQty),
      avgPrice:
        Number.parseFloat(order.cummulativeQuoteQty) /
          Number.parseFloat(order.executedQty) || undefined,
      timestamp: order.time,
    }));
  }

  /**
   * Get account balance from Binance
   * TODO: Add support for margin account balances
   * TODO: Add support for futures account balances
   */
  async getBalance(): Promise<Balance[]> {
    const response = await this.request<{
      balances: Array<{
        asset: string;
        free: string;
        locked: string;
      }>;
    }>("/api/v3/account", "GET");

    return response.balances
      .filter(
        (b) => Number.parseFloat(b.free) > 0 || Number.parseFloat(b.locked) > 0
      )
      .map((b) => ({
        asset: b.asset,
        free: Number.parseFloat(b.free),
        locked: Number.parseFloat(b.locked),
        total: Number.parseFloat(b.free) + Number.parseFloat(b.locked),
      }));
  }

  /**
   * Convert Binance status to our status
   */
  private convertStatus(status: string): ExchangeOrder["status"] {
    switch (status) {
      case "NEW":
        return "NEW";
      case "PARTIALLY_FILLED":
        return "PARTIALLY_FILLED";
      case "FILLED":
        return "FILLED";
      case "CANCELED":
        return "CANCELED";
      case "REJECTED":
        return "REJECTED";
      case "EXPIRED":
        return "EXPIRED";
      default:
        return "NEW";
    }
  }
}
