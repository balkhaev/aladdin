/**
 * React Hook for On-Chain Alerts via WebSocket
 * Subscribes to MVRV, NUPL, Reserve Risk, and other on-chain metric alerts
 */

import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "./use-websocket";

type OnChainAlert = {
  id: string;
  timestamp: number;
  blockchain: string;
  alertType:
    | "mvrv"
    | "nupl"
    | "reserve_risk"
    | "accumulation"
    | "hodl_wave"
    | "cdd";
  severity: "info" | "warning" | "critical";
  message: string;
  value?: number;
  threshold?: number;
  signal?: "bullish" | "bearish" | "neutral";
  metadata?: Record<string, unknown>;
};

type AlertMessage = {
  type: "onchain_alert";
  data: OnChainAlert;
};

type UseOnChainAlertsOptions = {
  blockchain?: "BTC" | "ETH" | "all";
  alertTypes?: OnChainAlert["alertType"][];
  severities?: OnChainAlert["severity"][];
  enabled?: boolean;
  maxAlerts?: number;
};

/**
 * Hook for real-time on-chain alerts via WebSocket
 *
 * @example
 * ```tsx
 * const { alerts, clearAlerts } = useOnChainAlerts({
 *   blockchain: "BTC",
 *   severities: ["critical", "warning"],
 * });
 * ```
 */
export function useOnChainAlerts(options: UseOnChainAlertsOptions = {}) {
  const {
    blockchain = "all",
    alertTypes,
    severities,
    enabled = true,
    maxAlerts = 50,
  } = options;

  const [alerts, setAlerts] = useState<OnChainAlert[]>([]);
  const { status, data, subscribe, unsubscribe, isConnected } =
    useWebSocket<AlertMessage>();

  // Subscribe to alert channels
  useEffect(() => {
    if (!(isConnected && enabled)) {
      return;
    }

    // Subscribe to appropriate channels based on blockchain
    const channels: string[] = [];

    if (blockchain === "all") {
      channels.push("onchain.alert.>");
    } else {
      channels.push(`onchain.alert.${blockchain.toLowerCase()}.>`);
    }

    // Subscribe to specific alert types if provided
    if (alertTypes && alertTypes.length > 0) {
      for (const alertType of alertTypes) {
        if (blockchain === "all") {
          channels.push(`onchain.alert.${alertType}`);
        } else {
          channels.push(
            `onchain.alert.${blockchain.toLowerCase()}.${alertType}`
          );
        }
      }
    }

    // Subscribe to all channels
    for (const channel of channels) {
      subscribe(channel);
    }

    return () => {
      for (const channel of channels) {
        unsubscribe(channel);
      }
    };
  }, [isConnected, enabled, blockchain, alertTypes, subscribe, unsubscribe]);

  // Handle incoming alert messages
  useEffect(() => {
    if (!data || data.type !== "onchain_alert") {
      return;
    }

    const alert = data.data;

    // Filter by severity if specified
    if (
      severities &&
      severities.length > 0 &&
      !severities.includes(alert.severity)
    ) {
      return;
    }

    // Filter by alert type if specified
    if (
      alertTypes &&
      alertTypes.length > 0 &&
      !alertTypes.includes(alert.alertType)
    ) {
      return;
    }

    // Add alert to list (newest first)
    setAlerts((prev) => {
      const updated = [alert, ...prev];
      // Limit to maxAlerts
      return updated.slice(0, maxAlerts);
    });
  }, [data, severities, alertTypes, maxAlerts]);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Remove specific alert
  const removeAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  // Get alerts by severity
  const getAlertsBySeverity = useCallback(
    (severity: OnChainAlert["severity"]) =>
      alerts.filter((a) => a.severity === severity),
    [alerts]
  );

  // Get alerts by type
  const getAlertsByType = useCallback(
    (alertType: OnChainAlert["alertType"]) =>
      alerts.filter((a) => a.alertType === alertType),
    [alerts]
  );

  // Get alerts by signal
  const getAlertsBySignal = useCallback(
    (signal: OnChainAlert["signal"]) =>
      alerts.filter((a) => a.signal === signal),
    [alerts]
  );

  const criticalAlerts = getAlertsBySeverity("critical");
  const warningAlerts = getAlertsBySeverity("warning");
  const infoAlerts = getAlertsBySeverity("info");

  return {
    alerts,
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    clearAlerts,
    removeAlert,
    getAlertsBySeverity,
    getAlertsByType,
    getAlertsBySignal,
    status,
    isConnected,
  };
}
