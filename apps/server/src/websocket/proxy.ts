import { createLogger } from "@aladdin/shared/logger";
import type { ServerWebSocket } from "bun";
import {
  handleWhaleAlertSubscription,
  unsubscribeAllNatsTopics,
} from "./nats-bridge";

const logger = createLogger({ service: "gateway-websocket" });

const BAD_REQUEST_CODE = 400;

type WebSocketData = {
  clientId: string;
  userId?: string;
  connections: {
    marketData?: WebSocket;
    trading?: WebSocket;
    portfolio?: WebSocket;
    risk?: WebSocket;
  };
};

const MARKET_DATA_WS_URL =
  process.env.MARKET_DATA_URL?.replace("http", "ws") || "ws://localhost:3010";
const TRADING_WS_URL =
  process.env.TRADING_URL?.replace("http", "ws") || "ws://localhost:3011";
const PORTFOLIO_WS_URL =
  process.env.PORTFOLIO_URL?.replace("http", "ws") || "ws://localhost:3012";
const RISK_WS_URL =
  process.env.RISK_URL?.replace("http", "ws") || "ws://localhost:3013";

/**
 * Обработка ping сообщения
 */
function handlePingMessage(ws: ServerWebSocket<WebSocketData>): void {
  ws.send(
    JSON.stringify({
      type: "pong",
      timestamp: Date.now(),
    })
  );
}

/**
 * Обработка подписки/отписки на каналы
 */
async function handleChannelSubscription(
  ws: ServerWebSocket<WebSocketData>,
  data: { channels: string[]; type: "subscribe" | "unsubscribe" },
  messageStr: string
): Promise<void> {
  const { channels, type } = data;

  for (const channel of channels) {
    await routeChannelToService(ws, channel, messageStr, type);
  }
}

/**
 * Роутинг канала к соответствующему сервису
 */
async function routeChannelToService(
  ws: ServerWebSocket<WebSocketData>,
  channel: string,
  messageStr: string,
  action: "subscribe" | "unsubscribe"
): Promise<void> {
  // Whale alert channels (NATS-based)
  if (channel.startsWith("whale.alert.")) {
    await handleWhaleAlertSubscription(ws, channel, action);
  }
  // Market data channels
  else if (
    channel === "tick" ||
    channel === "candle" ||
    channel === "orderbook" ||
    channel === "trade"
  ) {
    handleServiceConnection(
      ws,
      "marketData",
      `${MARKET_DATA_WS_URL}/ws/market-data`,
      messageStr
    );
  }
  // Trading channels
  else if (channel === "orders") {
    handleServiceConnection(ws, "trading", `${TRADING_WS_URL}`, messageStr);
  }
  // Portfolio channels
  else if (channel === "positions") {
    handleServiceConnection(ws, "portfolio", `${PORTFOLIO_WS_URL}`, messageStr);
  }
  // Risk channels
  else if (channel === "risk-metrics") {
    handleServiceConnection(ws, "risk", `${RISK_WS_URL}`, messageStr);
  }
}

/**
 * Управление подключением к сервису
 */
function handleServiceConnection(
  ws: ServerWebSocket<WebSocketData>,
  serviceName: keyof WebSocketData["connections"],
  serviceUrl: string,
  message: string
): void {
  const { clientId, connections } = ws.data;

  // Если подключение уже существует, используем его
  if (connections[serviceName]?.readyState === WebSocket.OPEN) {
    connections[serviceName]?.send(message);
    return;
  }

  // Создаем новое подключение
  try {
    logger.info(`Connecting to ${serviceName} service`, { clientId });

    const serviceWs = new WebSocket(serviceUrl);

    serviceWs.onopen = () => {
      logger.info(`Connected to ${serviceName} service`, { clientId });

      // Отправляем сообщение
      serviceWs.send(message);
    };

    serviceWs.onmessage = (event) => {
      // Проксируем сообщения от сервиса к клиенту
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      } catch (error) {
        logger.error(`Error forwarding message from ${serviceName}`, {
          clientId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    serviceWs.onerror = (error) => {
      logger.error(`${serviceName} WebSocket error`, {
        clientId,
        error: String(error),
      });

      ws.send(
        JSON.stringify({
          type: "error",
          message: `Connection to ${serviceName} failed`,
          timestamp: Date.now(),
        })
      );
    };

    serviceWs.onclose = () => {
      logger.info(`${serviceName} WebSocket closed`, { clientId });
      delete connections[serviceName];
    };

    connections[serviceName] = serviceWs;
  } catch (error) {
    logger.error(`Failed to connect to ${serviceName} service`, {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });

    ws.send(
      JSON.stringify({
        type: "error",
        message: `Failed to connect to ${serviceName} service`,
        timestamp: Date.now(),
      })
    );
  }
}

/**
 * Обработчик WebSocket подключения
 */
export function handleWebSocketUpgrade(
  req: Request,
  server: {
    upgrade: (req: Request, options: { data: WebSocketData }) => boolean;
  }
): Response | null {
  const url = new URL(req.url);

  // Проверяем, что это WebSocket запрос
  if (url.pathname === "/ws") {
    const clientId = crypto.randomUUID();

    // Upgrade к WebSocket
    const success = server.upgrade(req, {
      data: {
        clientId,
      } as WebSocketData,
    });

    if (success) {
      logger.info("WebSocket upgrade successful", { clientId });
      return null; // Upgrade успешен
    }

    logger.warn("WebSocket upgrade failed", { clientId });
    return new Response("WebSocket upgrade failed", {
      status: BAD_REQUEST_CODE,
    });
  }

  return null;
}

/**
 * Обработчики WebSocket событий
 */
export const websocketHandlers = {
  /**
   * Вызывается при открытии WebSocket соединения
   */
  open(ws: ServerWebSocket<WebSocketData>) {
    const { clientId } = ws.data;

    logger.info("Client connected", { clientId });

    // Initialize connections object
    ws.data.connections = {};

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to gateway",
        timestamp: Date.now(),
      })
    );
  },

  /**
   * Вызывается при получении сообщения от клиента
   */
  message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    const { clientId } = ws.data;

    try {
      const messageStr =
        typeof message === "string" ? message : message.toString();
      const data = JSON.parse(messageStr);

      logger.info("Received message from client", {
        clientId,
        type: data.type,
        channels: data.channels,
      });

      if (data.type === "ping") {
        handlePingMessage(ws);
      } else if (data.type === "subscribe" || data.type === "unsubscribe") {
        handleChannelSubscription(ws, data, messageStr);
      }
    } catch (error) {
      logger.error("Error processing message", {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  /**
   * Вызывается при закрытии WebSocket соединения
   */
  async close(ws: ServerWebSocket<WebSocketData>) {
    const { clientId, connections } = ws.data;

    logger.info("Client disconnected", { clientId });

    // Unsubscribe from all NATS topics
    await unsubscribeAllNatsTopics(ws);

    // Закрываем все соединения с сервисами
    for (const [serviceName, serviceWs] of Object.entries(connections)) {
      if (serviceWs) {
        try {
          serviceWs.close();
          logger.info(`Closed ${serviceName} WebSocket`, { clientId });
        } catch (error) {
          logger.error(`Error closing ${serviceName} WebSocket`, {
            clientId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  },

  /**
   * Вызывается при ошибке WebSocket
   */
  error(ws: ServerWebSocket<WebSocketData>, error: Error) {
    const { clientId } = ws.data;

    logger.error("WebSocket error", {
      clientId,
      error: error.message,
    });
  },
};
