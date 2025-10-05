import { getLogger } from "@aladdin/logger";
import dotenv from "dotenv";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

dotenv.config();

const logger = getLogger("telega");

const RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const MAX_CONNECTION_RETRIES = 5;
const DEFAULT_RETRY_ATTEMPTS = 3;

const API_ID = Number.parseInt(process.env.TELEGRAM_API_ID || "", 10);
const API_HASH = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION_STRING || "";

if (!API_ID) {
  throw new Error("TELEGRAM_API_ID должен быть задан");
}

if (!API_HASH) {
  throw new Error("TELEGRAM_API_HASH должен быть задан");
}

let client: TelegramClient | null = null;
let isConnecting = false;

/**
 * Получить или создать TelegramClient с улучшенными настройками соединения
 */
export async function getTelegramClient(): Promise<TelegramClient> {
  if (!client) {
    const stringSession = new StringSession(SESSION_STRING);

    // Улучшенные настройки соединения для предотвращения дисконнектов
    const CONNECTION_RETRIES_COUNT = 10;
    client = new TelegramClient(stringSession, API_ID, API_HASH, {
      connectionRetries: CONNECTION_RETRIES_COUNT,
      retryDelay: 5000,
      timeout: MAX_RETRY_DELAY_MS,
      requestRetries: MAX_CONNECTION_RETRIES,
      downloadRetries: MAX_CONNECTION_RETRIES,
      maxConcurrentDownloads: 1,
      // Увеличиваем базовую задержку между запросами
      baseLogger: undefined, // отключаем базовое логирование для уменьшения нагрузки
      // Настройки для более стабильного соединения
      useIPV6: false,
      autoReconnect: true,
      // Увеличиваем таймауты
      floodSleepThreshold: 60,
      deviceModel: "Telega Parser",
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      langCode: "en",
      systemLangCode: "en",
    });

    // Обработка событий соединения
    client.addEventHandler(async (update: { className?: string }) => {
      if (update.className === "UpdatesTooLong") {
        logger.info("Получен UpdatesTooLong, переподключаемся...");
        await reconnectClient();
      }
    });

    await connectWithRetry();
  }

  // Проверяем состояние соединения
  if (client.connected) {
    return client;
  }

  if (!isConnecting) {
    await reconnectClient();
  }

  return client;
}

/**
 * Подключение с повторными попытками
 */
async function connectWithRetry(
  maxRetries = MAX_CONNECTION_RETRIES
): Promise<void> {
  if (!client) return;
  if (isConnecting) return;

  isConnecting = true;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      logger.info("Попытка подключения", {
        attempt: retryCount + 1,
        maxRetries,
      });

      if (!client.connected) {
        await client.connect();
      }

      logger.info("Успешно подключен");
      isConnecting = false;
      return;
    } catch (error) {
      retryCount++;
      logger.error("Ошибка подключения", error, { attempt: retryCount });

      if (retryCount < maxRetries) {
        const delay = Math.min(
          RETRY_DELAY_MS * 2 ** retryCount,
          MAX_RETRY_DELAY_MS
        );
        logger.info("Повторная попытка подключения", { delayMs: delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  isConnecting = false;
  throw new Error(`Не удалось подключиться после ${maxRetries} попыток`);
}

/**
 * Переподключение клиента
 */
async function reconnectClient(): Promise<void> {
  if (!client) return;
  if (isConnecting) return;

  logger.info("Переподключение...");

  try {
    if (client.connected) {
      await client.disconnect();
    }
  } catch (error) {
    logger.error("Ошибка при отключении", error);
  }

  await connectWithRetry();
}

/**
 * Получить последние N сообщений из указанного канала с обработкой ошибок
 */
export async function getChannelMessages(channelId: string, limit = 10) {
  const telegramClient = await getTelegramClient();

  try {
    // Убираем @ из начала если есть
    const cleanChannelId = channelId.replace("@", "");

    // Получаем сообщения из канала с повторными попытками
    const messages = await retryOperation(
      () => telegramClient.getMessages(cleanChannelId, { limit }),
      DEFAULT_RETRY_ATTEMPTS
    );

    return messages.map((msg) => {
      const {
        id,
        date: msgDate,
        message: msgContent,
        fromId,
        peerId,
        views,
        forwards,
        replies,
        editDate,
      } = msg;
      return {
        id,
        date: msgDate,
        message: msgContent,
        fromId,
        peerId,
        views,
        forwards,
        replies,
        editDate,
        raw: msg,
      };
    });
  } catch (error) {
    logger.error("Ошибка получения сообщений", error, { channelId });

    // Если ошибка связана с соединением, пытаемся переподключиться
    if (
      error instanceof Error &&
      (error.message.includes("CONNECTION_NOT_INITED") ||
        error.message.includes("Not connected") ||
        error.message.includes("TIMEOUT"))
    ) {
      logger.info("Ошибка соединения, переподключаемся...");
      await reconnectClient();
      throw new Error("Ошибка соединения с Telegram. Попробуйте снова.");
    }

    throw error;
  }
}

/**
 * Повторение операции с обработкой ошибок
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn("Операция failed", {
        attempt: i + 1,
        maxRetries,
        error: lastError.message,
      });

      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Закрыть соединение с Telegram
 */
export async function disconnectTelegram() {
  if (client) {
    try {
      logger.info("Отключение...");
      await client.disconnect();
      logger.info("Отключен");
    } catch (error) {
      logger.error("Ошибка при отключении", error);
    } finally {
      client = null;
      isConnecting = false;
    }
  }
}

/**
 * Проверка состояния соединения
 */
export function isClientConnected(): boolean {
  return client?.connected ?? false;
}

/**
 * Тип информации о соединении
 */
export type ConnectionInfo = {
  connected: boolean;
  isConnecting: boolean;
  hasClient: boolean;
};

/**
 * Получить информацию о соединении
 */
export function getConnectionInfo(): ConnectionInfo {
  return {
    connected: client?.connected ?? false,
    isConnecting,
    hasClient: !!client,
  };
}
