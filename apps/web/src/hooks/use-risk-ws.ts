import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocketSubscription } from "./use-websocket";

type RiskMetricsEvent = {
  type: "risk-metrics";
  event: "risk.metrics.updated";
  data: {
    portfolioId: string;
    metrics: {
      var95: number;
      var99: number;
      exposure: {
        long: number;
        short: number;
        net: number;
        leverage: number;
      };
      limits: {
        maxLeverage?: number;
        maxPositionSize?: number;
        maxDailyLoss?: number;
        minMargin?: number;
      };
      breachedLimits: string[];
    };
  };
  timestamp: number;
};

/**
 * Hook для real-time обновлений риск-метрик через WebSocket
 *
 * @param userId - ID пользователя для фильтрации метрик
 * @param portfolioId - ID портфеля для фильтрации (опционально)
 * @param enabled - Включить подписку на обновления
 *
 * @example
 * ```tsx
 * const { isConnected, error, metrics } = useRiskWebSocket("user123", "portfolio456", true);
 * ```
 */
export function useRiskWebSocket(
  userId: string | undefined,
  portfolioId?: string,
  enabled = true
) {
  const queryClient = useQueryClient();

  const { status, data, error, isConnected } =
    useWebSocketSubscription<RiskMetricsEvent>(
      "risk-metrics",
      userId && enabled ? { userId, portfolioId } : undefined
    );

  // Обработка событий риск-метрик
  useEffect(() => {
    if (!data || data.type !== "risk-metrics") {
      return;
    }

    console.log("[Risk WS] Received metrics:", data.data);

    // Обновляем кеш React Query
    queryClient.setQueryData(
      ["risk", data.data.portfolioId, "metrics"],
      data.data.metrics
    );

    // Инвалидируем связанные запросы
    queryClient.invalidateQueries({
      queryKey: ["risk", data.data.portfolioId],
    });

    // Если есть нарушенные лимиты, показываем уведомление
    if (data.data.metrics.breachedLimits.length > 0) {
      console.warn(
        "[Risk WS] Risk limits breached:",
        data.data.metrics.breachedLimits
      );
      // TODO: Показать toast уведомление пользователю
    }
  }, [data, queryClient]);

  return {
    status,
    error,
    isConnected: isConnected && enabled,
    metrics: data?.data.metrics,
  };
}

