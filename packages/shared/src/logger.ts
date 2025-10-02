import { resolve } from "node:path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

type LoggerOptions = {
  service: string;
  level?: string;
  logDir?: string;
};

/**
 * Создает логгер для сервиса с записью в файловую систему
 * Все логи пишутся в директорию /logs с ежедневной ротацией
 */
export const createLogger = (options: LoggerOptions): winston.Logger => {
  const {
    service,
    level = "info",
    logDir = resolve(process.cwd(), "../../logs"),
  } = options;

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(
      ({
        timestamp,
        level: logLevel,
        message: logMessage,
        service: logService,
        ...meta
      }) => {
        let metaStr = "";
        if (Object.keys(meta).length > 0) {
          metaStr = `\n${JSON.stringify(meta, null, 2)}`;
        }
        return `${timestamp} [${logService}] ${logLevel}: ${logMessage}${metaStr}`;
      }
    )
  );

  // Транспорт для записи всех логов в файл с ротацией
  const fileRotateTransport = new DailyRotateFile({
    filename: `${service}-%DATE%.log`,
    dirname: logDir,
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "30d",
    format: logFormat,
    level: "debug",
  });

  // Транспорт для записи только ошибок
  const errorFileTransport = new DailyRotateFile({
    filename: `${service}-error-%DATE%.log`,
    dirname: logDir,
    datePattern: "YYYY-MM-DD",
    maxSize: "20m",
    maxFiles: "30d",
    format: logFormat,
    level: "error",
  });

  const logger = winston.createLogger({
    level,
    defaultMeta: { service },
    transports: [
      fileRotateTransport,
      errorFileTransport,
      new winston.transports.Console({
        format: consoleFormat,
      }),
    ],
  });

  // Обработка необработанных ошибок
  logger.on("error", (error) => {
    console.error("Logger error:", error);
  });

  return logger;
};

// Типы для структурированного логирования
export type LogData = {
  [key: string]: unknown;
};

/**
 * Хелперы для логирования с типобезопасностью
 */
export class Logger {
  constructor(private logger: winston.Logger) {}

  debug(message: string, data?: LogData): void {
    this.logger.debug(message, data);
  }

  info(message: string, data?: LogData): void {
    this.logger.info(message, data);
  }

  warn(message: string, data?: LogData): void {
    this.logger.warn(message, data);
  }

  error(message: string, error?: Error | unknown, data?: LogData): void {
    const errorData =
      error instanceof Error
        ? {
            error: {
              message: error.message,
              stack: error.stack,
              name: error.name,
            },
            ...data,
          }
        : { error, ...data };

    this.logger.error(message, errorData);
  }

  /**
   * Логирование HTTP запросов
   */
  http(request: {
    method: string;
    path: string;
    statusCode: number;
    duration: number;
    data?: LogData;
  }): void {
    this.logger.info("HTTP Request", {
      method: request.method,
      path: request.path,
      statusCode: request.statusCode,
      duration: `${request.duration}ms`,
      ...request.data,
    });
  }

  /**
   * Логирование NATS сообщений
   */
  nats(
    action: "publish" | "subscribe" | "request" | "reply",
    subject: string,
    data?: LogData
  ): void {
    this.logger.debug(`NATS ${action}`, {
      action,
      subject,
      ...data,
    });
  }

  /**
   * Логирование операций с базой данных
   */
  db(
    operation: string,
    table: string,
    duration?: number,
    data?: LogData
  ): void {
    this.logger.debug(`DB ${operation}`, {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
      ...data,
    });
  }
}

/**
 * Кэш логгеров для переиспользования
 */
const loggerCache = new Map<string, Logger>();

/**
 * Получает или создает логгер для указанного сервиса
 * Логгеры кэшируются для переиспользования
 */
export const getLogger = (
  service: string,
  options?: Omit<LoggerOptions, "service">
): Logger => {
  if (loggerCache.has(service)) {
    return loggerCache.get(service) as Logger;
  }

  const winstonLogger = createLogger({ service, ...options });
  const logger = new Logger(winstonLogger);
  loggerCache.set(service, logger);

  return logger;
};
