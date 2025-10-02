import type { WhaleAlert } from "@aladdin/shared/types";
import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "./use-websocket";

type WhaleAlertMessage = {
  type: "whale_alert";
  data: WhaleAlert | WhaleAlert[];
};

const MAX_ALERTS = 100;
const DECIMAL_PRECISION = 4;

/**
 * Hook для получения real-time whale алертов через WebSocket
 *
 * @param blockchain - фильтр по блокчейну (BTC/ETH) или undefined для всех
 * @param enabled - включить подписку
 *
 * @example
 * ```tsx
 * const { alerts, unreadCount, markAsRead, clearAll } = useWhaleAlerts("BTC");
 * ```
 */
export function useWhaleAlerts(blockchain?: "BTC" | "ETH", enabled = true) {
  const [alerts, setAlerts] = useState<WhaleAlert[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const { data, subscribe, unsubscribe, isConnected } =
    useWebSocket<WhaleAlertMessage>();

  // Подписка на whale алерты
  useEffect(() => {
    if (isConnected && enabled) {
      const channel = blockchain
        ? `whale.alert.${blockchain.toLowerCase()}`
        : "whale.alert.*";

      console.log(`[Whale Alerts] Subscribing to ${channel}`);
      subscribe(channel);

      return () => {
        console.log(`[Whale Alerts] Unsubscribing from ${channel}`);
        unsubscribe(channel);
      };
    }
  }, [isConnected, blockchain, enabled, subscribe, unsubscribe]);

  // Обработка входящих алертов
  useEffect(() => {
    if (data && data.type === "whale_alert") {
      const newAlerts = Array.isArray(data.data) ? data.data : [data.data];

      setAlerts((prev) => {
        // Добавляем новые алерты в начало списка
        const combined = [...newAlerts, ...prev];

        // Ограничиваем количество алертов
        return combined.slice(0, MAX_ALERTS);
      });

      // Отмечаем новые алерты как непрочитанные
      setUnreadIds((prev) => {
        const updated = new Set(prev);
        for (const alert of newAlerts) {
          const alertId = `${alert.blockchain}-${alert.transactionHash}`;
          updated.add(alertId);
        }
        return updated;
      });

      // Показываем уведомление (если браузер поддерживает)
      if ("Notification" in window && Notification.permission === "granted") {
        for (const alert of newAlerts) {
          const title = getAlertTitle(alert);
          const body = `${alert.value.toFixed(DECIMAL_PRECISION)} ${alert.blockchain} - ${alert.alertType}`;

          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: alert.transactionHash,
          });
        }
      }
    }
  }, [data]);

  // Отметить алерты как прочитанные
  const markAsRead = useCallback((alertIds: string[]) => {
    setUnreadIds((prev) => {
      const updated = new Set(prev);
      for (const id of alertIds) {
        updated.delete(id);
      }
      return updated;
    });
  }, []);

  // Отметить все как прочитанные
  const markAllAsRead = useCallback(() => {
    setUnreadIds(new Set());
  }, []);

  // Очистить все алерты
  const clearAll = useCallback(() => {
    setAlerts([]);
    setUnreadIds(new Set());
  }, []);

  const unreadCount = unreadIds.size;

  return {
    alerts,
    unreadCount,
    unreadIds,
    markAsRead,
    markAllAsRead,
    clearAll,
    isConnected,
  };
}

/**
 * Получить заголовок для алерта
 */
function getAlertTitle(alert: WhaleAlert): string {
  switch (alert.alertType) {
    case "whale_tx":
      return "🐋 Whale Transaction";
    case "exchange_inflow":
      return `📥 Exchange Inflow ${alert.exchange ? `(${alert.exchange})` : ""}`;
    case "exchange_outflow":
      return `📤 Exchange Outflow ${alert.exchange ? `(${alert.exchange})` : ""}`;
    case "large_transfer":
      return "💰 Large Transfer";
    default:
      return "🔔 Whale Alert";
  }
}

/**
 * Хук для запроса разрешения на уведомления
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  const requestPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    }
    return permission;
  }, [permission]);

  return {
    permission,
    requestPermission,
    isGranted: permission === "granted",
    isDenied: permission === "denied",
  };
}
