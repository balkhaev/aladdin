import { getLogger } from "@aladdin/logger";
import Redis from "ioredis";

const logger = getLogger("telega-subscriptions");

const REDIS_KEY = "telega:subscriptions";
const MAX_RETRY_DELAY_MS = 2000;
const RETRY_DELAY_BASE_MS = 50;

let redis: Redis | null = null;

/**
 * Инициализация Redis клиента
 */
export function initRedis(redisUrl?: string): Redis {
  if (redis) {
    return redis;
  }

  const url = redisUrl || process.env.REDIS_URL || "redis://localhost:6379";
  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * RETRY_DELAY_BASE_MS, MAX_RETRY_DELAY_MS);
      return delay;
    },
  });

  redis.on("error", (error) => {
    logger.error("Redis connection error", error);
  });

  redis.on("connect", () => {
    logger.info("Connected to Redis", { url });
  });

  return redis;
}

/**
 * Получить Redis клиент
 */
export function getRedis(): Redis {
  if (!redis) {
    throw new Error("Redis not initialized. Call initRedis() first.");
  }
  return redis;
}

/**
 * Закрыть соединение с Redis
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Тип подписки на канал
 */
export type ChannelSubscription = {
  channelId: string; // username или ID канала
  addedAt: string; // ISO timestamp
  active: boolean; // активна ли подписка
};

/**
 * Добавить подписку на канал
 */
export async function subscribeToChannel(
  channelId: string
): Promise<ChannelSubscription> {
  const client = getRedis();
  const subscription: ChannelSubscription = {
    channelId: channelId.replace("@", ""),
    addedAt: new Date().toISOString(),
    active: true,
  };

  await client.hset(
    REDIS_KEY,
    subscription.channelId,
    JSON.stringify(subscription)
  );
  logger.info("Subscribed to channel", { channelId: subscription.channelId });

  return subscription;
}

/**
 * Отписаться от канала
 */
export async function unsubscribeFromChannel(
  channelId: string
): Promise<boolean> {
  const client = getRedis();
  const normalizedId = channelId.replace("@", "");
  const deleted = await client.hdel(REDIS_KEY, normalizedId);

  if (deleted > 0) {
    logger.info("Unsubscribed from channel", { channelId: normalizedId });
    return true;
  }

  return false;
}

/**
 * Получить все подписки
 */
export async function getAllSubscriptions(): Promise<ChannelSubscription[]> {
  const client = getRedis();
  const data = await client.hgetall(REDIS_KEY);

  return Object.values(data).map((json) =>
    JSON.parse(json)
  ) as ChannelSubscription[];
}

/**
 * Получить активные подписки
 */
export async function getActiveSubscriptions(): Promise<ChannelSubscription[]> {
  const all = await getAllSubscriptions();
  return all.filter((sub) => sub.active);
}

/**
 * Проверить подписку на канал
 */
export async function isSubscribed(channelId: string): Promise<boolean> {
  const client = getRedis();
  const normalizedId = channelId.replace("@", "");
  const exists = await client.hexists(REDIS_KEY, normalizedId);
  return exists === 1;
}

/**
 * Деактивировать подписку (не удаляя из Redis)
 */
export async function deactivateSubscription(
  channelId: string
): Promise<boolean> {
  const client = getRedis();
  const normalizedId = channelId.replace("@", "");
  const json = await client.hget(REDIS_KEY, normalizedId);

  if (!json) {
    return false;
  }

  const subscription = JSON.parse(json) as ChannelSubscription;
  subscription.active = false;

  await client.hset(REDIS_KEY, normalizedId, JSON.stringify(subscription));
  logger.info("Deactivated subscription", { channelId: normalizedId });

  return true;
}

/**
 * Активировать подписку
 */
export async function activateSubscription(
  channelId: string
): Promise<boolean> {
  const client = getRedis();
  const normalizedId = channelId.replace("@", "");
  const json = await client.hget(REDIS_KEY, normalizedId);

  if (!json) {
    return false;
  }

  const subscription = JSON.parse(json) as ChannelSubscription;
  subscription.active = true;

  await client.hset(REDIS_KEY, normalizedId, JSON.stringify(subscription));
  logger.info("Activated subscription", { channelId: normalizedId });

  return true;
}
