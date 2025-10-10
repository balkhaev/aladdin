import { getLogger } from "@aladdin/logger";
import {
  getNatsClient,
  initNatsClient,
  type NatsClient,
} from "@aladdin/messaging";
import type { ServerWebSocket } from "bun";
import type { Subscription } from "nats";

type WebSocketData = {
  clientId: string;
  natsSubscriptions?: Map<string, Subscription>;
};

const logger = getLogger("nats-websocket-bridge");
const NATS_URL = process.env.NATS_URL ?? "nats://localhost:4222";

let natsClientInitPromise: Promise<NatsClient> | null = null;

function ensureNatsClient(): Promise<NatsClient> {
  if (!natsClientInitPromise) {
    natsClientInitPromise = initNatsClient({
      servers: NATS_URL,
      logger,
    }).catch((error) => {
      natsClientInitPromise = null;
      throw error;
    });
  }

  return natsClientInitPromise;
}

/**
 * Subscribe to NATS topic and forward messages to WebSocket client
 */
export async function subscribeToNatsTopic(
  ws: ServerWebSocket<WebSocketData>,
  topic: string
): Promise<void> {
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

    const natsClient = await ensureNatsClient().then(() => getNatsClient());

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
export function unsubscribeFromNatsTopic(
  ws: ServerWebSocket<WebSocketData>,
  topic: string
): void {
  const { clientId, natsSubscriptions } = ws.data;

  if (!natsSubscriptions) {
    logger.debug(`No subscriptions found for ${topic}`, { clientId });
    return;
  }

  const hasSubscription = natsSubscriptions?.has(topic);

  if (!hasSubscription) {
    logger.debug(`Not subscribed to ${topic}`, { clientId });
    return;
  }

  try {
    const subscription = natsSubscriptions?.get(topic);
    if (!subscription) {
      logger.debug(`Subscription for ${topic} not found`, { clientId });
      return;
    }

    if (typeof subscription.unsubscribe !== "function") {
      logger.warn(
        `Subscription for ${topic} has no unsubscribe method, removing from map`,
        { clientId }
      );
      natsSubscriptions.delete(topic);
      return;
    }

    subscription.unsubscribe();

    natsSubscriptions.delete(topic);
    logger.info(`Unsubscribed from NATS topic: ${topic}`, { clientId });
  } catch (error) {
    logger.error(`Failed to unsubscribe from NATS topic: ${topic}`, {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Remove from map anyway to prevent stuck subscriptions
    natsSubscriptions.delete(topic);
  }
}

/**
 * Unsubscribe from all NATS topics for this client
 */
export function unsubscribeAllNatsTopics(
  ws: ServerWebSocket<WebSocketData>
): void {
  const { clientId, natsSubscriptions } = ws.data;

  if (!natsSubscriptions || natsSubscriptions.size === 0) {
    return;
  }

  logger.info("Unsubscribing from all NATS topics", {
    clientId,
    count: natsSubscriptions.size,
  });

  for (const [topic, subscription] of natsSubscriptions.entries()) {
    // Skip if subscription is undefined/null
    if (!subscription) {
      logger.warn(`Subscription for ${topic} is undefined, skipping`, {
        clientId,
      });
      natsSubscriptions.delete(topic);
      continue;
    }

    // Check if unsubscribe method exists and is a function
    if (typeof subscription.unsubscribe !== "function") {
      logger.warn(
        `Subscription for ${topic} has no unsubscribe method, skipping`,
        {
          clientId,
        }
      );
      natsSubscriptions.delete(topic);
      continue;
    }

    try {
      subscription.unsubscribe();
    } catch (error) {
      logger.error(`Error calling unsubscribe for ${topic}`, {
        clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
    await subscribeToNatsTopic(ws, natsTopic);
  } else {
    await unsubscribeFromNatsTopic(ws, natsTopic);
  }
}
