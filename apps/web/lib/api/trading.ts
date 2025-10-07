/**
 * Trading API module
 * Provides functions to interact with Trading Service via API Gateway
 */

import { apiClient } from "./client";

// Types
export type OrderSide = "BUY" | "SELL";
export type OrderType =
  | "MARKET"
  | "LIMIT"
  | "STOP_LOSS"
  | "TAKE_PROFIT"
  | "STOP_LOSS_LIMIT"
  | "TAKE_PROFIT_LIMIT";
export type OrderStatus =
  | "PENDING"
  | "OPEN"
  | "FILLED"
  | "PARTIALLY_FILLED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED";

export type Order = {
  id: string;
  userId: string;
  exchangeCredentialsId: string;
  exchange: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filledQuantity: number;
  averagePrice?: number;
  exchangeOrderId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderRequest = {
  exchangeCredentialsId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
};

export type OrdersListResponse = {
  orders: Order[];
  total: number;
};

/**
 * Get list of orders
 */
export function getOrders(params?: {
  status?: OrderStatus;
  symbol?: string;
  exchange?: string;
  limit?: number;
  offset?: number;
}): Promise<OrdersListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append("status", params.status);
  if (params?.symbol) queryParams.append("symbol", params.symbol);
  if (params?.exchange) queryParams.append("exchange", params.exchange);
  if (params?.limit) queryParams.append("limit", params.limit.toString());
  if (params?.offset) queryParams.append("offset", params.offset.toString());

  const url = `/api/trading/orders${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  return apiClient.get<OrdersListResponse>(url);
}

/**
 * Get order by ID
 */
export function getOrderById(orderId: string): Promise<Order> {
  return apiClient.get<Order>(`/api/trading/orders/${orderId}`);
}

/**
 * Create a new order
 */
export function createOrder(data: CreateOrderRequest): Promise<Order> {
  return apiClient.post<Order>("/api/trading/orders", data);
}

/**
 * Cancel an order
 */
export function cancelOrder(orderId: string): Promise<Order> {
  return apiClient.delete<Order>(`/api/trading/orders/${orderId}`);
}

/**
 * Sync order with exchange
 */
export function syncOrder(orderId: string): Promise<Order> {
  return apiClient.post<Order>(`/api/trading/orders/${orderId}/sync`);
}

/**
 * Get active orders (PENDING, OPEN, PARTIALLY_FILLED)
 * Fetches from all available exchanges
 */
export async function getActiveOrders(symbol?: string): Promise<Order[]> {
  // Import here to avoid circular dependency
  const { getExchangeCredentials } = await import("./exchange-credentials");

  try {
    // Get all active exchange credentials
    const credentials = await getExchangeCredentials();
    const activeCredentials = credentials.filter((c) => c.isActive);

    if (activeCredentials.length === 0) {
      return [];
    }

    // Fetch orders from each exchange
    const ordersPromises = activeCredentials.map(async (cred) => {
      try {
        // Получаем все ордера и фильтруем активные на клиенте
        const response = await getOrders({
          exchange: cred.exchange,
          limit: 100,
        });
        // Фильтруем активные: PENDING, OPEN, PARTIALLY_FILLED
        const activeOrders = response.orders.filter((order) =>
          ["PENDING", "OPEN", "PARTIALLY_FILLED"].includes(order.status)
        );
        // Фильтруем по symbol если нужно
        return symbol
          ? activeOrders.filter((o) => o.symbol === symbol)
          : activeOrders;
      } catch (error) {
        console.error(`Failed to fetch orders from ${cred.exchange}:`, error);
        return [];
      }
    });

    // Wait for all requests and flatten results
    const ordersArrays = await Promise.all(ordersPromises);
    return ordersArrays.flat();
  } catch (error) {
    console.error("Failed to fetch active orders:", error);
    return [];
  }
}

/**
 * Get order history (FILLED, CANCELLED, REJECTED)
 */
export async function getOrderHistory(params?: {
  symbol?: string;
  limit?: number;
  offset?: number;
}): Promise<OrdersListResponse> {
  // Import here to avoid circular dependency
  const { getExchangeCredentials } = await import("./exchange-credentials");

  try {
    // Get all active exchange credentials
    const credentials = await getExchangeCredentials();
    const activeCredentials = credentials.filter((c) => c.isActive);

    if (activeCredentials.length === 0) {
      return { orders: [], total: 0 };
    }

    // Fetch orders from each exchange
    const ordersPromises = activeCredentials.map(async (cred) => {
      try {
        const response = await getOrders({
          symbol: params?.symbol,
          exchange: cred.exchange,
          limit: params?.limit,
          offset: params?.offset,
        });
        // Filter on client side
        const historyOrders = response.orders.filter((order) =>
          ["FILLED", "CANCELLED", "REJECTED", "EXPIRED"].includes(order.status)
        );
        return historyOrders;
      } catch (error) {
        console.error(
          `Failed to fetch order history from ${cred.exchange}:`,
          error
        );
        return [];
      }
    });

    // Wait for all requests and flatten results
    const ordersArrays = await Promise.all(ordersPromises);
    const allOrders = ordersArrays.flat();

    return {
      orders: allOrders,
      total: allOrders.length,
    };
  } catch (error) {
    console.error("Failed to fetch order history:", error);
    return { orders: [], total: 0 };
  }
}

/**
 * Get exchange balances (spot assets)
 */
export function getExchangeBalances(exchangeCredentialsId: string): Promise<
  Array<{
    asset: string;
    free: number;
    locked: number;
    total: number;
  }>
> {
  return apiClient.get<
    Array<{
      asset: string;
      free: number;
      locked: number;
      total: number;
    }>
  >(`/api/trading/balances?exchangeCredentialsId=${exchangeCredentialsId}`);
}
