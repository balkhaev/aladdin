import type { Position } from "@aladdin/shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocketSubscription } from "./use-websocket";

type PositionEvent = {
  type: "position";
  event:
    | "portfolio.position.created"
    | "portfolio.position.updated"
    | "portfolio.position.deleted";
  data: {
    portfolioId: string;
    position: Position;
  };
  timestamp: number;
};

type PortfolioEvent = {
  type: "portfolio";
  event: "portfolio.updated";
  data: {
    portfolioId: string;
    totalValue: number;
    pnl: number;
  };
  timestamp: number;
};

/**
 * Hook для real-time обновлений позиций через WebSocket
 *
 * @param userId - ID пользователя для фильтрации позиций
 * @param portfolioId - ID портфеля для фильтрации (опционально)
 * @param enabled - Включить подписку на обновления
 *
 * @example
 * ```tsx
 * const { isConnected, error } = usePositionsWebSocket("user123", "portfolio456", true);
 * ```
 */
export function usePositionsWebSocket(
  userId: string | undefined,
  portfolioId?: string,
  enabled = true
) {
  const queryClient = useQueryClient();

  const { status, data, error, isConnected } = useWebSocketSubscription<
    PositionEvent | PortfolioEvent
  >("positions", userId && enabled ? { userId, portfolioId } : undefined);

  // Обработка событий позиций и портфелей
  useEffect(() => {
    if (!data) {
      return;
    }

    // Ignore messages that are not position or portfolio events
    if (data.type !== "position" && data.type !== "portfolio") {
      return;
    }

    console.log("[Positions WS] Received event:", data.type, data.event);

    if (data.type === "position") {
      const positionData = data.data;

      // Обновляем кеш React Query
      switch (data.event) {
        case "portfolio.position.created":
        case "portfolio.position.updated":
          // Обновляем конкретную позицию в кеше
          queryClient.setQueryData(
            ["positions", positionData.position.id],
            positionData.position
          );
          // Инвалидируем список позиций портфеля
          queryClient.invalidateQueries({
            queryKey: ["portfolios", positionData.portfolioId, "positions"],
          });
          break;

        case "portfolio.position.deleted":
          // Удаляем позицию из кеша
          queryClient.removeQueries({
            queryKey: ["positions", positionData.position.id],
          });
          // Инвалидируем список позиций портфеля
          queryClient.invalidateQueries({
            queryKey: ["portfolios", positionData.portfolioId, "positions"],
          });
          break;

        default:
          // Неизвестное событие, игнорируем
          break;
      }

      // Всегда инвалидируем данные портфеля при изменении позиций
      queryClient.invalidateQueries({
        queryKey: ["portfolios", positionData.portfolioId],
      });
    } else if (data.type === "portfolio") {
      // Обновляем данные портфеля
      queryClient.invalidateQueries({
        queryKey: ["portfolios", data.data.portfolioId],
      });
    }
  }, [data, queryClient]);

  return {
    status,
    error,
    isConnected: isConnected && enabled,
  };
}
