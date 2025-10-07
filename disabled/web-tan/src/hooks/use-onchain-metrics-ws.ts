/**
 * React Hook for Real-Time On-Chain Metrics via WebSocket
 * Auto-updates UI when new on-chain data arrives
 */

import type { OnChainMetrics } from "@aladdin/core";
import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "./use-websocket";

type MetricsMessage = {
  type: "onchain_metrics";
  data: OnChainMetrics;
};

type UseOnChainMetricsWSOptions = {
  blockchain: "BTC" | "ETH";
  enabled?: boolean;
};

/**
 * Hook for real-time on-chain metrics updates
 *
 * @example
 * ```tsx
 * const { metrics, lastUpdate } = useOnChainMetricsWS({
 *   blockchain: "BTC",
 * });
 * ```
 */
export function useOnChainMetricsWS(options: UseOnChainMetricsWSOptions) {
  const { blockchain, enabled = true } = options;

  const [metrics, setMetrics] = useState<OnChainMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [updateCount, setUpdateCount] = useState(0);

  const { status, data, subscribe, unsubscribe, isConnected } =
    useWebSocket<MetricsMessage>();

  // Subscribe to blockchain-specific metrics channel
  useEffect(() => {
    if (!(isConnected && enabled)) {
      return;
    }

    const channel = `onchain.metrics.${blockchain.toLowerCase()}`;
    subscribe(channel);

    return () => {
      unsubscribe(channel);
    };
  }, [isConnected, enabled, blockchain, subscribe, unsubscribe]);

  // Handle incoming metrics updates
  useEffect(() => {
    if (!data || data.type !== "onchain_metrics") {
      return;
    }

    const newMetrics = data.data;

    // Only update if it's for our blockchain
    if (newMetrics.blockchain === blockchain) {
      setMetrics(newMetrics);
      setLastUpdate(Date.now());
      setUpdateCount((prev) => prev + 1);
    }
  }, [data, blockchain]);

  // Get time since last update
  const getTimeSinceUpdate = useCallback(() => {
    if (lastUpdate === 0) return null;
    return Date.now() - lastUpdate;
  }, [lastUpdate]);

  // Check if data is stale (>10 minutes)
  const isStale = useCallback(() => {
    const timeSince = getTimeSinceUpdate();
    if (timeSince === null) return false;
    return timeSince > 10 * 60 * 1000; // 10 minutes
  }, [getTimeSinceUpdate]);

  return {
    metrics,
    lastUpdate,
    updateCount,
    isStale: isStale(),
    getTimeSinceUpdate,
    status,
    isConnected,
  };
}
