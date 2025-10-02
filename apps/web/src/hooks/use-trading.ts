/**
 * Trading React Hooks
 * Custom hooks for trading operations using TanStack Query
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
 * Uses polling since WebSocket updates are not yet fully implemented
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
    refetchInterval: 3000, // Poll every 3 seconds until WebSocket is fully implemented
    staleTime: 2000,
  });
}

/**
 * Hook to fetch active orders
 * Uses polling since WebSocket updates are not yet fully implemented
 */
export function useActiveOrders(symbol?: string) {
  return useQuery({
    queryKey: ["orders", "active", symbol],
    queryFn: () => getActiveOrders(symbol),
    refetchInterval: 3000, // Poll every 3 seconds until WebSocket is fully implemented
    staleTime: 2000,
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
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: 60_000, // История обновляется реже, кешируем на 1 минуту
  });
}

/**
 * Hook to fetch a single order by ID
 * Uses polling since WebSocket updates are not yet fully implemented
 */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => getOrderById(orderId),
    enabled: Boolean(orderId),
    refetchInterval: 3000, // Poll every 3 seconds until WebSocket is fully implemented
    staleTime: 2000,
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
