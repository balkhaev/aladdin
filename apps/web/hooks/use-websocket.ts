import { useCallback, useEffect, useMemo, useState } from "react";
import type { WebSocketMessage } from "@/lib/websocket-manager";
import { getWebSocketManager } from "@/lib/websocket-manager";

type WebSocketStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * React hook для работы с WebSocket
 *
 * @example
 * ```tsx
 * const { status, data, subscribe } = useWebSocket<Tick>();
 *
 * useEffect(() => {
 *   if (status === "connected") {
 *     subscribe("tick", ["BTCUSDT"]);
 *   }
 * }, [status, subscribe]);
 * ```
 */
export function useWebSocket<T = WebSocketMessage>() {
  const [status, setStatus] = useState<WebSocketStatus>("disconnected");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Мемоизируем WebSocket manager чтобы избежать реинициализации
  const ws = useMemo(() => getWebSocketManager(), []);

  // Подключение при монтировании
  useEffect(() => {
    // Проверяем текущее состояние WebSocket
    if (ws.isConnected()) {
      setStatus("connected");
    } else {
      setStatus("connecting");
      ws.connect();
    }

    const unsubscribeOpen = ws.onOpen(() => {
      setStatus("connected");
      setError(null);
    });

    const unsubscribeClose = ws.onClose(() => {
      setStatus("disconnected");
    });

    const unsubscribeError = ws.onError(() => {
      setStatus("error");
      setError(new Error("WebSocket connection error"));
    });

    const unsubscribeMessage = ws.onMessage((message) => {
      setData(message as T);
    });

    // Cleanup при размонтировании
    return () => {
      unsubscribeOpen();
      unsubscribeClose();
      unsubscribeError();
      unsubscribeMessage();
    };
  }, [ws]);

  // Методы для подписки/отписки
  const subscribe = useCallback(
    (
      channel: string,
      options?: {
        symbols?: string[];
        userId?: string;
        portfolioId?: string;
      }
    ) => {
      ws.subscribe(channel, options);
    },
    [ws]
  );

  const unsubscribe = useCallback(
    (
      channel: string,
      options?: {
        symbols?: string[];
        portfolioId?: string;
      }
    ) => {
      ws.unsubscribe(channel, options);
    },
    [ws]
  );

  const send = useCallback(
    (message: WebSocketMessage) => {
      ws.send(message);
    },
    [ws]
  );

  return {
    status,
    data,
    error,
    subscribe,
    unsubscribe,
    send,
    isConnected: status === "connected",
  };
}

/**
 * Hook для подписки на конкретный тип данных с символами
 */
export function useWebSocketSubscription<T = WebSocketMessage>(
  type: string,
  options?: {
    symbols?: string[];
    userId?: string;
    portfolioId?: string;
  }
) {
  const { status, data, error, subscribe, unsubscribe, isConnected } =
    useWebSocket<T>();

  useEffect(() => {
    if (isConnected && options) {
      subscribe(type, options);

      return () => {
        unsubscribe(type, {
          symbols: options.symbols,
          portfolioId: options.portfolioId,
        });
      };
    }
  }, [isConnected, type, options, subscribe, unsubscribe]);

  return {
    status,
    data,
    error,
    isConnected,
  };
}
