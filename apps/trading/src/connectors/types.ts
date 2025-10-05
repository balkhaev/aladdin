import type { Order, OrderSide, OrderType, Trade } from "@aladdin/core";

/**
 * Interface for exchange connectors
 */
export interface ExchangeConnector {
  name: string;

  /**
   * Create a new order on the exchange
   */
  createOrder(params: CreateOrderParams): Promise<ExchangeOrder>;

  /**
   * Cancel an existing order
   */
  cancelOrder(orderId: string, symbol: string): Promise<void>;

  /**
   * Get order status from exchange
   */
  getOrder(orderId: string, symbol: string): Promise<ExchangeOrder>;

  /**
   * Get all open orders for a symbol
   */
  getOpenOrders(symbol?: string): Promise<ExchangeOrder[]>;

  /**
   * Get order history (completed orders) - optional
   */
  getOrderHistory?(params?: {
    symbol?: string;
    limit?: number;
  }): Promise<ExchangeOrder[]>;

  /**
   * Get account balance
   */
  getBalance(): Promise<Balance[]>;
}

export interface CreateOrderParams {
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface ExchangeOrder {
  orderId: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;
  price?: number;
  stopPrice?: number;
  status:
    | "NEW"
    | "PARTIALLY_FILLED"
    | "FILLED"
    | "CANCELED"
    | "REJECTED"
    | "EXPIRED";
  filledQty: number;
  avgPrice?: number;
  timestamp: number;
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}
