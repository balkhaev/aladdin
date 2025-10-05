import {
  type ClickHouseClient as CHClient,
  createClient,
} from "@clickhouse/client";
import type { Logger } from "./logger";

export type ClickHouseClient = ClickHouseService;

const DEFAULT_CLICKHOUSE_PORT = 8123;
const SQL_PREVIEW_LENGTH = 100;

type ClickHouseClientOptions = {
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  logger?: Logger;
};

export class ClickHouseService {
  private client: CHClient;

  constructor(private options: ClickHouseClientOptions = {}) {
    // Приоритет: url параметр > CLICKHOUSE_URL env > отдельные параметры
    const clickhouseUrl = options.url || process.env.CLICKHOUSE_URL;

    if (clickhouseUrl) {
      // Используем URL напрямую (с учетом credentials)
      const database =
        options.database || process.env.CLICKHOUSE_DATABASE || "aladdin";
      const username =
        options.username || process.env.CLICKHOUSE_USER || "default";
      const password =
        options.password || process.env.CLICKHOUSE_PASSWORD || "";

      this.client = createClient({
        url: clickhouseUrl,
        database,
        username,
        password,
      });

      this.options.logger?.info("ClickHouse client initialized", {
        url: clickhouseUrl,
        database,
        username,
      });
    } else {
      // Используем отдельные параметры (legacy режим)
      const {
        host = process.env.CLICKHOUSE_HOST ?? "localhost",
        port = Number(process.env.CLICKHOUSE_PORT) || DEFAULT_CLICKHOUSE_PORT,
        database = process.env.CLICKHOUSE_DATABASE ?? "aladdin",
        username = process.env.CLICKHOUSE_USER ?? "default",
        password = process.env.CLICKHOUSE_PASSWORD ?? "",
      } = options;

      this.client = createClient({
        host: `http://${host}:${port}`,
        database,
        username,
        password,
      });

      this.options.logger?.info("ClickHouse client initialized", {
        host,
        port,
        database,
      });
    }
  }

  /**
   * Выполнение запроса
   */
  async query<T = unknown>(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<T[]> {
    const startTime = Date.now();

    try {
      const resultSet = await this.client.query({
        query: sql,
        query_params: params,
        format: "JSONEachRow",
      });

      const data = await resultSet.json<T>();
      const duration = Date.now() - startTime;

      this.options.logger?.db("query", "clickhouse", duration, {
        sql: sql.substring(0, SQL_PREVIEW_LENGTH),
        rowCount: data.length,
      });

      return data;
    } catch (error) {
      this.options.logger?.error("ClickHouse query failed", error, { sql });
      throw error;
    }
  }

  /**
   * Вставка данных
   */
  async insert<T = unknown>(table: string, data: T[]): Promise<void> {
    const startTime = Date.now();

    try {
      await this.client.insert({
        table,
        values: data,
        format: "JSONEachRow",
      });

      const duration = Date.now() - startTime;
      this.options.logger?.db("insert", table, duration, {
        rowCount: data.length,
      });
    } catch (error) {
      this.options.logger?.error("ClickHouse insert failed", error, { table });
      throw error;
    }
  }

  /**
   * Выполнение команды (CREATE, ALTER, etc.)
   */
  async command(sql: string): Promise<void> {
    const startTime = Date.now();

    try {
      await this.client.command({ query: sql });
      const duration = Date.now() - startTime;
      this.options.logger?.db("command", "clickhouse", duration, {
        sql: sql.substring(0, SQL_PREVIEW_LENGTH),
      });
    } catch (error) {
      this.options.logger?.error("ClickHouse command failed", error, { sql });
      throw error;
    }
  }

  /**
   * Пинг для проверки соединения
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.options.logger?.error("ClickHouse ping failed", error);
      return false;
    }
  }

  /**
   * Закрытие соединения
   */
  async close(): Promise<void> {
    await this.client.close();
    this.options.logger?.info("ClickHouse connection closed");
  }
}

/**
 * Фабрика для создания ClickHouse клиента
 */
export const createClickHouseClient = (
  options: ClickHouseClientOptions = {}
): ClickHouseService => new ClickHouseService(options);
