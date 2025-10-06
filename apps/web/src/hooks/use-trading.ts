/**
 * Trading React Hooks
 * Custom hooks for trading operations using TanStack Query with WebSocket real-time updates
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateOrderRequest, OrderStatus } from "../lib/api/trading";
import {
  cancelOrder,
  createOrder,
  getActiveOrders,
  getOrderById,
  getOrderHistory,
  getOrders,
  syncOrder,
} from "../lib/api/trading";

/**
 * Hook to fetch all orders with filters
 * Real-time updates handled by useOrdersWebSocket - cache is kept fresh via WebSocket
 */
export function useOrders(params?: {
  status?: OrderStatus;
  symbol?: string;
  exchange?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: () => getOrders(params),
    // WebSocket keeps cache fresh - no polling needed
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Hook to fetch active orders
 * Real-time updates handled by useOrdersWebSocket - cache is kept fresh via WebSocket
 */
export function useActiveOrders(symbol?: string) {
  return useQuery({
    queryKey: ["orders", "active", symbol],
    queryFn: () => getActiveOrders(symbol),
    // WebSocket keeps cache fresh - no polling needed
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Hook to fetch order history
 * Real-time updates handled by useOrdersWebSocket
 */
export function useOrderHistory(params?: {
  symbol?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["orders", "history", params],
    queryFn: () => getOrderHistory(params),
    staleTime: 60_000, // История обновляется реже, кешируем на 1 минуту
  });
}

/**
 * Hook to fetch a single order by ID
 * Real-time updates handled by useOrdersWebSocket - cache is kept fresh via WebSocket
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => getOrderById(orderId),
    enabled: Boolean(orderId),
    // WebSocket keeps cache fresh - no polling needed
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * Hook to create a new order
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => createOrder(data),
    onSuccess: (order) => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      toast.success("Ордер создан успешно", {
        description: `${order.side} ${order.quantity} ${order.symbol} @ ${order.type}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка создания ордера", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to cancel an order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: (order) => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      toast.success("Ордер отменен", {
        description: `${order.symbol} - ${order.id}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка отмены ордера", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to sync order with exchange
 */
export function useSyncOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => syncOrder(orderId),
    onSuccess: (order) => {
      // Invalidate and refetch orders
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      toast.success("Ордер синхронизирован", {
        description: `${order.symbol} - ${order.status}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка синхронизации ордера", {
        description: error.message,
      });
    },
  });
}
