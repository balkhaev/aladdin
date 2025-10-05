import { BaseService } from "@aladdin/shared/base-service";
import {
  closeRedis,
  getActiveSubscriptions,
  initRedis,
} from "./channel-subscriptions";
import {
  type ConnectionInfo,
  disconnectTelegram,
  getConnectionInfo,
} from "./telegram";
import {
  getUserbotStatus,
  initNatsClient,
  startUserbot,
  stopUserbot,
  subscribeToChannels,
} from "./userbot";

const USERBOT_RESTART_DELAY_MS = 10_000;

export class TelegaService extends BaseService {
  private userbotStarted = false;

  getServiceName(): string {
    return "telega";
  }

  protected onInitialize(): Promise<void> {
    // Проверяем наличие необходимых переменных окружения
    const hasApiId = !!process.env.TELEGRAM_API_ID;
    const hasApiHash = !!process.env.TELEGRAM_API_HASH;
    const hasBothCredentials = hasApiId && hasApiHash;

    if (!hasBothCredentials) {
      throw new Error(
        "TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in environment"
      );
    }

    this.logger.info("Telega service configuration validated");
    return Promise.resolve();
  }

  protected async onStart(): Promise<void> {
    try {
      // Инициализируем Redis
      initRedis();
      this.logger.info("Redis initialized");

      // Инициализируем NATS клиент для публикации сообщений
      if (this.natsClient) {
        initNatsClient(this.natsClient);
        this.logger.info("NATS client connected for message publishing");
      } else {
        this.logger.warn(
          "NATS client not available, messages will not be published"
        );
      }

      // Запускаем userbot
      await startUserbot();
      this.userbotStarted = true;
      this.logger.info("Userbot started successfully");

      // Загружаем активные подписки и подписываемся на каналы
      const subscriptions = await getActiveSubscriptions();
      this.logger.info("Loaded subscriptions from Redis", {
        count: subscriptions.length,
      });

      if (subscriptions.length > 0) {
        await subscribeToChannels(subscriptions);
        this.logger.info("Subscribed to channels from Redis");
      } else {
        this.logger.info("No active subscriptions found in Redis");
      }
    } catch (error) {
      this.logger.error("Failed to start userbot", error);
      // Пытаемся перезапустить
      setTimeout(() => {
        this.logger.info("Retrying userbot startup...");
        startUserbot().catch((retryError) => {
          this.logger.error("Userbot retry failed", retryError);
        });
      }, USERBOT_RESTART_DELAY_MS);
    }
  }

  protected async onStop(): Promise<void> {
    this.logger.info("Stopping Telega service...");

    try {
      // Останавливаем userbot
      if (this.userbotStarted) {
        stopUserbot();
        this.logger.info("Userbot stopped");
      }

      // Закрываем соединения
      await Promise.all([
        disconnectTelegram().catch((err) => {
          this.logger.error("Error disconnecting Telegram", err);
        }),
        closeRedis().catch((err) => {
          this.logger.error("Error closing Redis", err);
        }),
      ]);

      this.logger.info("All connections closed");
    } catch (error) {
      this.logger.error("Error during stop", error);
      throw error;
    }
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    const userbotStatus = getUserbotStatus();
    const connectionInfo = getConnectionInfo();

    return Promise.resolve({
      userbotRunning: userbotStatus.running,
      telegramConnected: connectionInfo.connected,
      telegramConnecting: connectionInfo.isConnecting,
      natsConnected: !!this.natsClient,
    });
  }

  /**
   * Получить статус userbot
   */
  getUserbotStatus() {
    return getUserbotStatus();
  }

  /**
   * Получить информацию о соединении с Telegram
   */
  getConnectionInfo(): ConnectionInfo {
    return getConnectionInfo();
  }
}
