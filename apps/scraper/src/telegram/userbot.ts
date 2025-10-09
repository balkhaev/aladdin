import { getLogger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import dotenv from "dotenv";
import { Api } from "telegram";
import type { NewMessageEvent } from "telegram/events";
import { NewMessage } from "telegram/events";
import type { ChannelSubscription } from "./channel-subscriptions";
import { getConnectionInfo, getTelegramClient } from "./telegram";

dotenv.config();

const logger = getLogger("telega");

const CONNECTION_MONITOR_INTERVAL_MS = 30_000;

let userbotRunning = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let natsClient: NatsClient | null = null;
const subscribedChannels = new Map<string, boolean>(); // channelId -> isSubscribed

/**
 * Инициализировать NATS клиент для публикации сообщений
 */
export function initNatsClient(client: NatsClient): void {
  natsClient = client;
  logger.info("NATS client initialized for message publishing");
}

/**
 * Мониторинг соединения и автоматическое переподключение
 */
function startConnectionMonitoring(): void {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
  }

  reconnectTimer = setInterval(() => {
    const connectionInfo = getConnectionInfo();

    if (connectionInfo.connected) return;
    if (connectionInfo.isConnecting) return;

    logger.warn("Соединение потеряно, перезапускаем userbot...");
    startUserbot().catch((error) => {
      logger.error("Ошибка при перезапуске", error);
    });
  }, CONNECTION_MONITOR_INTERVAL_MS);
}

/**
 * Остановка мониторинга соединения
 */
function stopConnectionMonitoring(): void {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
}

/**
 * Подписаться на конкретный канал
 */
async function subscribeToChannelInternal(
  client: ReturnType<typeof getTelegramClient> extends Promise<infer T>
    ? T
    : never,
  channelUsername: string
): Promise<void> {
  try {
    // Вступаем в канал если еще не участник
    await client.invoke(
      new Api.channels.JoinChannel({ channel: channelUsername })
    );
    logger.info("Вступили в канал", { channel: channelUsername });
  } catch (error) {
    const errorMessage =
      error instanceof Error && "errorMessage" in error
        ? (error as { errorMessage?: string }).errorMessage
        : undefined;

    if (errorMessage?.includes("USER_ALREADY_PARTICIPANT")) {
      logger.info("Уже в канале", { channel: channelUsername });
    } else {
      logger.warn("Ошибка вступления в канал", {
        channel: channelUsername,
        error: errorMessage,
      });
      throw error;
    }
  }

  // Создаем обработчик для этого канала
  const handler = (event: NewMessageEvent) => {
    const handleMessage = async () => {
      try {
        const message = event.message;
        if (!message) return;
        if (!message.message) return;

        logger.debug("New message received", {
          channel: channelUsername,
          messageId: message.id,
          textLength: message.message.length,
          views: message.views,
          forwards: message.forwards,
        });

        // Публикуем сырое сообщение в NATS
        if (natsClient) {
          const payload = {
            channelId: channelUsername,
            messageId: message.id,
            text: message.message,
            date: message.date,
            views: message.views,
            forwards: message.forwards,
            timestamp: Date.now(),
          };

          try {
            await natsClient.publish("telega.message", payload);
            logger.info("Message published to NATS", {
              channel: channelUsername,
              messageId: message.id,
              textPreview: message.message.substring(0, 50),
            });
          } catch (error) {
            logger.error("Failed to publish message to NATS", {
              channel: channelUsername,
              messageId: message.id,
              error,
            });
          }
        } else {
          logger.warn("NATS client not initialized, message not published", {
            channel: channelUsername,
            messageId: message.id,
          });
        }
      } catch (error) {
        logger.error("Ошибка обработки сообщения", {
          channel: channelUsername,
          error,
        });
      }
    };
    handleMessage().catch((error) => {
      logger.error("Ошибка в обработчике сообщений", {
        channel: channelUsername,
        error,
      });
    });
  };

  // Добавляем обработчик новых сообщений
  client.addEventHandler(handler, new NewMessage({ chats: [channelUsername] }));

  subscribedChannels.set(channelUsername, true);
  logger.info("Подписались на канал", { channel: channelUsername });
}

/**
 * Отписаться от конкретного канала
 */
function unsubscribeFromChannelInternal(channelUsername: string): void {
  try {
    // Удаляем обработчики для этого канала
    // Telegram client не предоставляет точного способа удалить конкретный обработчик
    // поэтому просто удаляем из нашего списка
    subscribedChannels.delete(channelUsername);
    logger.info("Отписались от канала", { channel: channelUsername });
  } catch (error) {
    logger.error("Ошибка отписки от канала", error, {
      channel: channelUsername,
    });
    throw error;
  }
}

export async function startUserbot(): Promise<void> {
  // Предотвращаем множественный запуск
  if (userbotRunning) {
    logger.info("Userbot уже запущен");
    return;
  }

  logger.info("Starting Telegram userbot...");
  const startTime = Date.now();

  try {
    userbotRunning = true;
    const client = await getTelegramClient();

    logger.info("Userbot авторизован", {
      timeMs: Date.now() - startTime,
    });

    // Добавляем обработчик разрыва соединения
    client.addEventHandler((update: { className?: string }) => {
      if (
        update.className !== "ConnectionClosed" &&
        update.className !== "ConnectionLost"
      ) {
        return;
      }

      logger.warn("Соединение потеряно, будет выполнено переподключение...", {
        updateClass: update.className,
      });
      userbotRunning = false;
    });

    logger.info("Userbot запущен успешно", {
      totalTimeMs: Date.now() - startTime,
      monitoringInterval: CONNECTION_MONITOR_INTERVAL_MS,
    });

    // Запускаем мониторинг соединения
    startConnectionMonitoring();
  } catch (error) {
    logger.error("Ошибка запуска userbot", {
      error,
      timeMs: Date.now() - startTime,
    });
    userbotRunning = false;
    throw error;
  }
}

/**
 * Подписаться на каналы из списка
 */
export async function subscribeToChannels(
  channels: ChannelSubscription[]
): Promise<void> {
  if (!userbotRunning) {
    logger.warn("Userbot не запущен, невозможно подписаться на каналы");
    return;
  }

  logger.info("Subscribing to Telegram channels", {
    totalChannels: channels.length,
    activeChannels: channels.filter((c) => c.active).length,
  });

  const client = await getTelegramClient();
  let subscribed = 0;
  let failed = 0;

  for (const channel of channels) {
    if (!channel.active) {
      logger.debug("Пропускаем неактивный канал", {
        channel: channel.channelId,
      });
      continue;
    }

    // Пропускаем уже подписанные каналы
    if (subscribedChannels.has(channel.channelId)) {
      logger.debug("Уже подписаны на канал", { channel: channel.channelId });
      continue;
    }

    try {
      await subscribeToChannelInternal(client, channel.channelId);
      subscribed++;
    } catch (error) {
      failed++;
      logger.error("Ошибка подписки на канал", {
        channel: channel.channelId,
        error,
      });
    }
  }

  logger.info("Завершена подписка на каналы", {
    total: channels.length,
    active: channels.filter((c) => c.active).length,
    subscribed,
    failed,
    totalSubscribed: subscribedChannels.size,
  });
}

/**
 * Подписаться на один канал
 */
export async function subscribeToChannel(channelId: string): Promise<void> {
  if (!userbotRunning) {
    throw new Error("Userbot не запущен");
  }

  const client = await getTelegramClient();
  const normalizedId = channelId.replace("@", "");

  if (subscribedChannels.has(normalizedId)) {
    logger.info("Уже подписаны на канал", { channel: normalizedId });
    return;
  }

  await subscribeToChannelInternal(client, normalizedId);
}

/**
 * Отписаться от канала
 */
export function unsubscribeFromChannel(channelId: string): void {
  if (!userbotRunning) {
    throw new Error("Userbot не запущен");
  }

  const normalizedId = channelId.replace("@", "");

  if (!subscribedChannels.has(normalizedId)) {
    logger.info("Не подписаны на канал", { channel: normalizedId });
    return;
  }

  unsubscribeFromChannelInternal(normalizedId);
}

/**
 * Остановка userbot
 */
export function stopUserbot(): void {
  userbotRunning = false;
  stopConnectionMonitoring();
  subscribedChannels.clear();
  logger.info("Userbot остановлен");
}

/**
 * Получить статус userbot
 */
export function getUserbotStatus() {
  return {
    running: userbotRunning,
    connectionInfo: getConnectionInfo(),
    subscribedChannels: Array.from(subscribedChannels.keys()),
  };
}

/**
 * Получить список подписанных каналов
 */
export function getSubscribedChannels(): string[] {
  return Array.from(subscribedChannels.keys());
}
