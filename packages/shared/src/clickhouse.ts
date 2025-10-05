import {
  type ClickHouseClient as CHClient,
  createClient,
} from "@clickhouse/client";
import type { Logger } from "./logger";

export type ClickHouseClient = ClickHouseService;

const DEFAULT_CLICKHOUSE_PORT = 8123;
const SQL_PREVIEW_LENGTH = 500;

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
        url: clickhouseUrl.replace(/:[^:@]+@/, ":***@"),
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

      if (
        this.options.logger &&
        "db" in this.options.logger &&
        typeof this.options.logger.db === "function"
      ) {
        this.options.logger.db("query", "clickhouse", duration, {
          sql: sql.substring(0, SQL_PREVIEW_LENGTH),
          rowCount: data.length,
        });
      } else {
        this.options.logger?.debug?.("ClickHouse query executed", {
          sql: sql.substring(0, SQL_PREVIEW_LENGTH),
          rowCount: data.length,
          duration: `${duration}ms`,
        });
      }

      return data;
    } catch (error) {
      if (
        this.options.logger &&
        "error" in this.options.logger &&
        typeof this.options.logger.error === "function"
      ) {
        // Check if it's our Logger class (has 3 parameters) or winston (has 1-2 parameters)
        if (this.options.logger.error.length >= 2) {
          // Our Logger class
          this.options.logger.error("ClickHouse query failed", error, { sql });
        } else {
          // winston.Logger
          this.options.logger.error("ClickHouse query failed", {
            sql,
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : error,
          });
        }
      }
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
      if (
        this.options.logger &&
        "db" in this.options.logger &&
        typeof this.options.logger.db === "function"
      ) {
        this.options.logger.db("insert", table, duration, {
          rowCount: data.length,
        });
      } else {
        this.options.logger?.debug?.("ClickHouse data inserted", {
          table,
          rowCount: data.length,
          duration: `${duration}ms`,
        });
      }
    } catch (error) {
      if (
        this.options.logger &&
        "error" in this.options.logger &&
        typeof this.options.logger.error === "function"
      ) {
        if (this.options.logger.error.length >= 2) {
          this.options.logger.error("ClickHouse insert failed", error, {
            table,
          });
        } else {
          this.options.logger.error("ClickHouse insert failed", {
            table,
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : error,
          });
        }
      }
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
      if (
        this.options.logger &&
        "db" in this.options.logger &&
        typeof this.options.logger.db === "function"
      ) {
        this.options.logger.db("command", "clickhouse", duration, {
          sql: sql.substring(0, SQL_PREVIEW_LENGTH),
        });
      } else {
        this.options.logger?.debug?.("ClickHouse command executed", {
          sql: sql.substring(0, SQL_PREVIEW_LENGTH),
          duration: `${duration}ms`,
        });
      }
    } catch (error) {
      if (
        this.options.logger &&
        "error" in this.options.logger &&
        typeof this.options.logger.error === "function"
      ) {
        if (this.options.logger.error.length >= 2) {
          this.options.logger.error("ClickHouse command failed", error, {
            sql,
          });
        } else {
          this.options.logger.error("ClickHouse command failed", {
            sql,
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : error,
          });
        }
      }
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
      if (
        this.options.logger &&
        "error" in this.options.logger &&
        typeof this.options.logger.error === "function"
      ) {
        if (this.options.logger.error.length >= 2) {
          this.options.logger.error("ClickHouse ping failed", error);
        } else {
          this.options.logger.error("ClickHouse ping failed", {
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                  }
                : error,
          });
        }
      }
      return false;
    }
  }

  /**
   * Закрытие соединения
   */
  async close(): Promise<void> {
    await this.client.close();
    if (this.options.logger && "info" in this.options.logger) {
      this.options.logger.info("ClickHouse connection closed");
    }
  }
}

/**
 * Фабрика для создания ClickHouse клиента
 */
export const createClickHouseClient = (
  options: ClickHouseClientOptions = {}
): ClickHouseService => new ClickHouseService(options);
