import { getLogger } from "@aladdin/shared/logger";
import { getNatsClient } from "@aladdin/shared/nats";
import type { ServerWebSocket } from "bun";
import type { Subscription } from "nats";

type WebSocketData = {
  clientId: string;
  natsSubscriptions?: Map<string, Subscription>;
};

const logger = getLogger("nats-websocket-bridge");

/**
 * Subscribe to NATS topic and forward messages to WebSocket client
 */
export function subscribeToNatsTopic(
  ws: ServerWebSocket<WebSocketData>,
  topic: string
): void {
  const { clientId } = ws.data;

  try {
    // Initialize subscriptions map if not exists
    if (!ws.data.natsSubscriptions) {
      ws.data.natsSubscriptions = new Map();
    }

    // Check if already subscribed
    if (ws.data.natsSubscriptions.has(topic)) {
      logger.debug(`Already subscribed to ${topic}`, { clientId });
      return;
    }

    const natsClient = getNatsClient();

    // Subscribe to NATS topic
    const subscription = natsClient.subscribe(topic, (data: unknown) => {
      // Forward message to WebSocket client
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(
            JSON.stringify({
              type: "whale_alert",
              data,
              timestamp: Date.now(),
            })
          );
        } catch (error) {
          logger.error("Error forwarding NATS message to WebSocket", {
            clientId,
            topic,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    // Store subscription
    ws.data.natsSubscriptions.set(topic, subscription);

    logger.info(`Subscribed to NATS topic: ${topic}`, { clientId });
  } catch (error) {
    logger.error(`Failed to subscribe to NATS topic: ${topic}`, {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Send error to client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: `Failed to subscribe to ${topic}`,
          timestamp: Date.now(),
        })
      );
    }
  }
}

/**
 * Unsubscribe from NATS topic
 */
export async function unsubscribeFromNatsTopic(
  ws: ServerWebSocket<WebSocketData>,
  topic: string
): Promise<void> {
  const { clientId, natsSubscriptions } = ws.data;

  const hasSubscription = natsSubscriptions?.has(topic);

  if (!hasSubscription) {
    logger.debug(`Not subscribed to ${topic}`, { clientId });
    return;
  }

  try {
    const subscription = natsSubscriptions.get(topic);
    if (subscription) {
      await subscription.unsubscribe();
      natsSubscriptions.delete(topic);
      logger.info(`Unsubscribed from NATS topic: ${topic}`, { clientId });
    }
  } catch (error) {
    logger.error(`Failed to unsubscribe from NATS topic: ${topic}`, {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Unsubscribe from all NATS topics for this client
 */
export async function unsubscribeAllNatsTopics(
  ws: ServerWebSocket<WebSocketData>
): Promise<void> {
  const { clientId, natsSubscriptions } = ws.data;

  if (!natsSubscriptions || natsSubscriptions.size === 0) {
    return;
  }

  logger.info("Unsubscribing from all NATS topics", {
    clientId,
    count: natsSubscriptions.size,
  });

  const unsubscribePromises: Promise<void>[] = [];

  for (const [topic, subscription] of natsSubscriptions.entries()) {
    unsubscribePromises.push(
      subscription.unsubscribe().catch((error) => {
        logger.error(`Failed to unsubscribe from ${topic}`, {
          clientId,
          error: error instanceof Error ? error.message : String(error),
        });
      })
    );
  }

  await Promise.all(unsubscribePromises);
  natsSubscriptions.clear();
}

/**
 * Handle whale alert channel subscriptions
 * Supports: whale.alert.btc, whale.alert.eth, whale.alert.*, whale.alert.exchange
 */
export async function handleWhaleAlertSubscription(
  ws: ServerWebSocket<WebSocketData>,
  channel: string,
  action: "subscribe" | "unsubscribe"
): Promise<void> {
  // Map channel to NATS topic
  let natsTopic: string;

  if (channel === "whale.alert.*") {
    // Subscribe to all whale alerts
    natsTopic = "whale.alert.>";
  } else if (channel.startsWith("whale.alert.")) {
    // Direct channel mapping
    natsTopic = channel;
  } else {
    logger.warn("Invalid whale alert channel", {
      clientId: ws.data.clientId,
      channel,
    });
    return;
  }

  if (action === "subscribe") {
    subscribeToNatsTopic(ws, natsTopic);
  } else {
    await unsubscribeFromNatsTopic(ws, natsTopic);
  }
}
