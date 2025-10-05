import type { Order } from "@aladdin/shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { useWebSocketSubscription } from "./use-websocket";

type OrderEvent = {
  type: "order";
  event:
    | "trading.order.created"
    | "trading.order.updated"
    | "trading.order.cancelled"
    | "trading.order.filled";
  data: Order;
  timestamp: number;
};

/**
 * Hook для real-time обновлений ордеров через WebSocket
 *
 * @param userId - ID пользователя для фильтрации ордеров
 * @param enabled - Включить подписку на обновления
 *
 * @example
 * ```tsx
 * const { isConnected, error } = useOrdersWebSocket("user123", true);
 * ```
 */
export function useOrdersWebSocket(userId: string | undefined, enabled = true) {
  const queryClient = useQueryClient();

  const { status, data, error, isConnected } =
    useWebSocketSubscription<OrderEvent>(
      "orders",
      userId && enabled ? { userId } : undefined
    );

  // Обработка событий ордеров
  useEffect(() => {
    if (!data) {
      return;
    }

    // Only process order events
    if (data.type !== "order") {
      return;
    }

    logger.debug("Orders WS", "Received event", {
      event: data.event,
      orderId: data.data.id,
    });

    // Обновляем кеш React Query
    switch (data.event) {
      case "trading.order.created":
        // Инвалидируем список ордеров чтобы он обновился
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        break;

      case "trading.order.updated":
      case "trading.order.filled":
      case "trading.order.cancelled":
        // Обновляем конкретный ордер в кеше
        queryClient.setQueryData(["orders", data.data.id], data.data);
        // Также инвалидируем список
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        break;

      default:
        // Неизвестное событие, игнорируем
        break;
    }
  }, [data, queryClient]);

  return {
    status,
    error,
    isConnected: isConnected && enabled,
  };
}
