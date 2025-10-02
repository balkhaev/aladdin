import {
  connect,
  JSONCodec,
  type Msg,
  type NatsConnection,
  type Subscription,
} from "nats";
import type { Logger } from "./logger";

type NatsClientOptions = {
  servers?: string | string[];
  logger?: Logger;
};

export class NatsClient {
  private connection: NatsConnection | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private codec = JSONCodec();

  constructor(private options: NatsClientOptions = {}) {}

  /**
   * Подключение к NATS серверу
   */
  async connect(): Promise<void> {
    try {
      const servers = this.options.servers ?? "nats://localhost:4222";
      this.connection = await connect({ servers });

      this.options.logger?.info("Connected to NATS", { servers });

      // Обработка закрытия соединения
      (async () => {
        if (!this.connection) return;
        const done = this.connection.closed();
        const err = await done;
        if (err) {
          this.options.logger?.error("NATS connection closed with error", err);
        } else {
          this.options.logger?.info("NATS connection closed");
        }
      })();
    } catch (error) {
      this.options.logger?.error("Failed to connect to NATS", error);
      throw error;
    }
  }

  /**
   * Публикация сообщения
   */
  publish<T = unknown>(subject: string, data: T): void {
    if (!this.connection) {
      throw new Error("NATS connection not established");
    }

    try {
      const encoded = this.codec.encode(data);
      this.connection.publish(subject, encoded);
      this.options.logger?.nats("publish", subject, { data });
    } catch (error) {
      this.options.logger?.error("Failed to publish message", error, {
        subject,
      });
      throw error;
    }
  }

  /**
   * Подписка на сообщения
   * Возвращает Subscription для управления подпиской
   */
  subscribe<T = unknown>(
    subject: string,
    handler: (data: T, msg: Msg) => void | Promise<void>
  ): Subscription {
    if (!this.connection) {
      throw new Error("NATS connection not established");
    }

    try {
      const sub = this.connection.subscribe(subject);
      this.subscriptions.set(subject, sub);
      this.options.logger?.nats("subscribe", subject);

      // Обработка сообщений
      (async () => {
        for await (const msg of sub) {
          try {
            const data = this.codec.decode(msg.data) as T;
            await handler(data, msg);
          } catch (error) {
            this.options.logger?.error("Error handling NATS message", error, {
              subject,
            });
          }
        }
      })();

      return sub;
    } catch (error) {
      this.options.logger?.error("Failed to subscribe", error, { subject });
      throw error;
    }
  }

  /**
   * Request-Reply pattern
   */
  async request<TRequest = unknown, TResponse = unknown>(
    subject: string,
    data: TRequest,
    timeout = 5000
  ): Promise<TResponse> {
    if (!this.connection) {
      throw new Error("NATS connection not established");
    }

    try {
      const encoded = this.codec.encode(data);
      const msg = await this.connection.request(subject, encoded, { timeout });
      const response = this.codec.decode(msg.data) as TResponse;

      this.options.logger?.nats("request", subject, { data, response });
      return response;
    } catch (error) {
      this.options.logger?.error("Request failed", error, { subject });
      throw error;
    }
  }

  /**
   * Отписка от топика
   */
  async unsubscribe(subject: string): Promise<void> {
    const sub = this.subscriptions.get(subject);
    if (sub) {
      await sub.unsubscribe();
      this.subscriptions.delete(subject);
      this.options.logger?.info("Unsubscribed from subject", { subject });
    }
  }

  /**
   * Закрытие всех подписок и соединения
   */
  async close(): Promise<void> {
    // Отписываемся от всех топиков
    for (const [subject, sub] of this.subscriptions) {
      await sub.unsubscribe();
      this.options.logger?.info("Unsubscribed during close", { subject });
    }
    this.subscriptions.clear();

    // Закрываем соединение
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.options.logger?.info("NATS connection closed");
    }
  }

  /**
   * Проверка состояния подключения
   */
  isConnected(): boolean {
    return this.connection !== null && !this.connection.isClosed();
  }

  /**
   * Получение NATS connection для расширенного использования
   */
  getConnection(): NatsConnection | null {
    return this.connection;
  }
}

/**
 * Фабрика для создания NATS клиента
 */
export const createNatsClient = async (
  options: NatsClientOptions = {}
): Promise<NatsClient> => {
  const client = new NatsClient(options);
  await client.connect();
  return client;
};

/**
 * Singleton instance для глобального NATS клиента
 */
let globalNatsClient: NatsClient | null = null;

/**
 * Инициализация глобального NATS клиента
 */
export const initNatsClient = async (
  options: NatsClientOptions = {}
): Promise<NatsClient> => {
  if (globalNatsClient?.isConnected()) {
    return globalNatsClient;
  }

  globalNatsClient = await createNatsClient(options);
  return globalNatsClient;
};

/**
 * Получение глобального NATS клиента
 */
export const getNatsClient = (): NatsClient => {
  if (!globalNatsClient) {
    throw new Error(
      "NATS client not initialized. Call initNatsClient() first."
    );
  }

  if (!globalNatsClient.isConnected()) {
    throw new Error("NATS client not connected");
  }

  return globalNatsClient;
};
