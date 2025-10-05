/**
 * Base service class for all microservices
 * Provides common functionality and structure
 */

import { CacheService } from "@aladdin/cache";
import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { PrismaClient } from "@aladdin/database";
import { TypedServiceClient } from "@aladdin/http/client";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";

/**
 * Base service configuration
 */
export type BaseServiceConfig = {
  logger: Logger;
  natsClient?: NatsClient;
  prisma?: PrismaClient;
  clickhouse?: ClickHouseClient;
  enableCache?: boolean;
  enableServiceClient?: boolean;
};

/**
 * Service status
 */
export const ServiceStatus = {
  INITIALIZING: "initializing",
  READY: "ready",
  RUNNING: "running",
  STOPPING: "stopping",
  STOPPED: "stopped",
  ERROR: "error",
} as const;

export type ServiceStatus = (typeof ServiceStatus)[keyof typeof ServiceStatus];

/**
 * Base service class that all services should extend
 */
export abstract class BaseService {
  protected logger: Logger;
  protected natsClient?: NatsClient;
  protected prisma?: PrismaClient;
  protected clickhouse?: ClickHouseClient;
  protected status: ServiceStatus = ServiceStatus.INITIALIZING;

  private cacheService?: CacheService;
  private serviceClient?: TypedServiceClient;
  private enableCache: boolean;
  private enableServiceClient: boolean;

  constructor(config: BaseServiceConfig) {
    this.logger = config.logger;
    this.natsClient = config.natsClient;
    this.prisma = config.prisma;
    this.clickhouse = config.clickhouse;
    this.enableCache = config.enableCache ?? false;
    this.enableServiceClient = config.enableServiceClient ?? true;
  }

  /**
   * Get CacheService instance (lazy initialization)
   * Инициализирует Redis cache если enableCache=true
   */
  protected getCacheService(
    keyPrefix?: string,
    defaultTTL?: number
  ): CacheService {
    if (!this.enableCache) {
      throw new Error(
        "Cache is not enabled for this service. Set enableCache: true in config."
      );
    }

    if (!this.cacheService) {
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl) {
        throw new Error("REDIS_URL environment variable is not set");
      }

      this.cacheService = new CacheService({
        redis: redisUrl,
        logger: this.logger,
        keyPrefix: keyPrefix ?? `${this.getServiceName()}:`,
        defaultTTL: defaultTTL ?? 60,
      });

      this.logger.info("Cache service initialized", {
        keyPrefix: keyPrefix ?? `${this.getServiceName()}:`,
        defaultTTL: defaultTTL ?? 60,
      });
    }

    return this.cacheService;
  }

  /**
   * Get ServiceClient instance (lazy initialization)
   * Предоставляет type-safe клиент для вызова других сервисов
   */
  protected getServiceClient(): TypedServiceClient {
    if (!this.enableServiceClient) {
      throw new Error(
        "Service client is not enabled for this service. Set enableServiceClient: true in config."
      );
    }

    if (!this.serviceClient) {
      this.serviceClient = new TypedServiceClient({
        logger: this.logger,
        enableRetry: true,
        enableCircuitBreaker: true,
      });

      this.logger.info("Service client initialized");
    }

    return this.serviceClient;
  }

  /**
   * Check if cache is available
   */
  protected hasCacheService(): boolean {
    return this.enableCache && this.cacheService !== undefined;
  }

  /**
   * Check if service client is available
   */
  protected hasServiceClient(): boolean {
    return this.enableServiceClient && this.serviceClient !== undefined;
  }

  /**
   * Get service name
   */
  abstract getServiceName(): string;

  /**
   * Initialize the service
   * Called once during startup
   */
  async initialize(): Promise<void> {
    this.logger.info(`Initializing ${this.getServiceName()} service...`);
    this.status = ServiceStatus.INITIALIZING;

    try {
      await this.onInitialize();
      this.status = ServiceStatus.READY;
      this.logger.info(`${this.getServiceName()} service initialized`);
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error(
        `Failed to initialize ${this.getServiceName()} service`,
        error
      );
      throw error;
    }
  }

  /**
   * Start the service
   * Called after initialization
   */
  async start(): Promise<void> {
    if (this.status !== ServiceStatus.READY) {
      throw new Error(
        `Cannot start service in ${this.status} status. Must be READY.`
      );
    }

    this.logger.info(`Starting ${this.getServiceName()} service...`);
    this.status = ServiceStatus.RUNNING;

    try {
      await this.onStart();
      this.logger.info(`${this.getServiceName()} service started`);
    } catch (error) {
      this.status = ServiceStatus.ERROR;
      this.logger.error(
        `Failed to start ${this.getServiceName()} service`,
        error
      );
      throw error;
    }
  }

  /**
   * Stop the service gracefully
   */
  async stop(): Promise<void> {
    this.logger.info(`Stopping ${this.getServiceName()} service...`);
    this.status = ServiceStatus.STOPPING;

    try {
      // Сначала вызываем кастомный onStop
      await this.onStop();

      // Затем очищаем ресурсы base service
      if (this.cacheService) {
        // CacheService не имеет метода close, но мы можем его добавить в будущем
        this.logger.info("Cache service cleaned up");
      }

      if (this.serviceClient) {
        // ServiceClient также может иметь cleanup логику в будущем
        this.logger.info("Service client cleaned up");
      }

      this.status = ServiceStatus.STOPPED;
      this.logger.info(`${this.getServiceName()} service stopped`);
    } catch (error) {
      this.logger.error(
        `Error stopping ${this.getServiceName()} service`,
        error
      );
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<ServiceHealth> {
    const health: ServiceHealth = {
      status: this.status,
      service: this.getServiceName(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      connections: {},
    };

    // Check NATS connection
    if (this.natsClient) {
      try {
        health.connections.nats = await this.checkNatsHealth();
      } catch {
        health.connections.nats = false;
      }
    }

    // Check Prisma connection
    if (this.prisma) {
      try {
        health.connections.postgres = await this.checkPrismaHealth();
      } catch {
        health.connections.postgres = false;
      }
    }

    // Check ClickHouse connection
    if (this.clickhouse) {
      try {
        health.connections.clickhouse = await this.checkClickHouseHealth();
      } catch {
        health.connections.clickhouse = false;
      }
    }

    // Add custom health checks
    try {
      const customHealth = await this.onHealthCheck();
      health.connections = { ...health.connections, ...customHealth };
    } catch (error) {
      this.logger.error("Custom health check failed", error);
    }

    return health;
  }

  /**
   * Check NATS connection health
   */
  protected checkNatsHealth(): Promise<boolean> {
    if (!this.natsClient) return Promise.resolve(false);
    // NATS client is connected if it exists and hasn't been closed
    return Promise.resolve(true); // TODO: Add proper health check when available
  }

  /**
   * Check Prisma connection health
   */
  protected async checkPrismaHealth(): Promise<boolean> {
    if (!this.prisma) return false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check ClickHouse connection health
   */
  protected async checkClickHouseHealth(): Promise<boolean> {
    if (!this.clickhouse) return false;
    try {
      return await this.clickhouse.ping();
    } catch {
      return false;
    }
  }

  /**
   * Service-specific initialization logic
   * Override in subclass
   */
  protected async onInitialize(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Service-specific start logic
   * Override in subclass
   */
  protected async onStart(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Service-specific stop logic
   * Override in subclass
   */
  protected async onStop(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Service-specific health checks
   * Override in subclass to add custom health checks
   */
  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({});
  }

  /**
   * Get current service status
   */
  getStatus(): ServiceStatus {
    return this.status;
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.status === ServiceStatus.RUNNING;
  }
}

/**
 * Service health response
 */
export type ServiceHealth = {
  status: ServiceStatus;
  service: string;
  timestamp: string;
  uptime: number;
  connections: Record<string, boolean>;
};
