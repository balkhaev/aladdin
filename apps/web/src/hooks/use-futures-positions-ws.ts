/**
 * Futures Positions WebSocket Hook
 * Real-time updates for exchange futures positions
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { FuturesPosition } from "./use-futures-positions";
import { useWebSocketSubscription } from "./use-websocket";

type FuturesPositionEvent = {
  type: "futures-position";
  event:
    | "trading.position.opened"
    | "trading.position.updated"
    | "trading.position.closed";
  data: {
    exchange: string;
    position: FuturesPosition;
  };
  timestamp: number;
};

/**
 * Hook для real-time обновлений futures позиций через WebSocket
 *
 * @param userId - ID пользователя для фильтрации позиций
 * @param exchange - Биржа для фильтрации (опционально)
 * @param enabled - Включить подписку на обновления
 *
 * @example
 * ```tsx
 * const { isConnected } = useFuturesPositionsWebSocket("user123", "bybit", true);
 * ```
 */
export function useFuturesPositionsWebSocket(
  userId: string | undefined,
  exchange?: string,
  enabled = true
) {
  const queryClient = useQueryClient();

  const { status, data, error, isConnected } =
    useWebSocketSubscription<FuturesPositionEvent>(
      "futures-positions",
      userId && enabled ? { userId } : undefined
    );

  // Обработка событий futures позиций
  useEffect(() => {
    if (!data || data.type !== "futures-position") {
      return;
    }

    logger.debug("Futures Positions WS", "Received event", {
      event: data.event,
      symbol: data.data.position.symbol,
      exchange: data.data.exchange,
    });

    // Если фильтр по бирже задан и это не та биржа - пропускаем
    if (exchange && data.data.exchange !== exchange) {
      return;
    }

    // Обновляем кеш React Query
    switch (data.event) {
      case "trading.position.opened":
      case "trading.position.updated":
        // Инвалидируем список позиций для обновления
        queryClient.invalidateQueries({
          queryKey: ["futures-positions", { exchange: data.data.exchange }],
        });
        // Также инвалидируем общий список без фильтра
        queryClient.invalidateQueries({
          queryKey: ["futures-positions", {}],
        });
        break;

      case "trading.position.closed":
        // Инвалидируем список позиций
        queryClient.invalidateQueries({
          queryKey: ["futures-positions", { exchange: data.data.exchange }],
        });
        queryClient.invalidateQueries({
          queryKey: ["futures-positions", {}],
        });
        break;

      default:
        // Неизвестное событие, игнорируем
        break;
    }
  }, [data, queryClient, exchange]);

  return {
    status,
    error,
    isConnected: isConnected && enabled,
  };
}
