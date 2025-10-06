/**
 * Base Gateway Service
 * Extends BaseService with Gateway-specific functionality
 */

import { BaseService, type BaseServiceConfig } from "@aladdin/service";
import type { Context, Hono } from "hono";
import {
  createProxyMiddleware,
  type PathRewriteRule,
} from "./proxy-middleware";
import { ServiceRegistry } from "./service-registry";

export type GatewayServiceConfig = BaseServiceConfig & {
  services: Record<string, string>; // serviceName -> URL
  pathRewrites?: Record<string, PathRewriteRule>;
  healthCheckInterval?: number;
  getUserId?: (c: Context) => string | undefined;
};

/**
 * Base Gateway Service
 * Provides service registry, health monitoring, and request proxying
 */
export class BaseGatewayService extends BaseService {
  protected registry: ServiceRegistry;
  protected pathRewrites?: Record<string, PathRewriteRule>;
  protected getUserId?: (c: Context) => string | undefined;

  constructor(config: GatewayServiceConfig) {
    super(config);

    this.registry = new ServiceRegistry({
      services: config.services,
      healthCheckInterval: config.healthCheckInterval,
      logger: this.logger,
    });

    this.pathRewrites = config.pathRewrites;
    this.getUserId = config.getUserId;
  }

  /**
   * Get service registry
   */
  getRegistry(): ServiceRegistry {
    return this.registry;
  }

  /**
   * Setup proxy routes for registered services
   */
  setupProxyRoutes(app: Hono): void {
    // In dev mode, skip health checks to allow requests even if services haven't passed health checks yet
    // This helps during startup when services may start in random order
    const skipHealthCheck = process.env.NODE_ENV !== "production";

    // Setup path rewrites first (more specific routes)
    if (this.pathRewrites) {
      for (const [pattern, rule] of Object.entries(this.pathRewrites)) {
        app.use(
          pattern,
          createProxyMiddleware(rule.target, {
            serviceRegistry: this.registry,
            logger: this.logger,
            enableRetry: true,
            enableCircuitBreaker: true,
            getUserId: this.getUserId,
            pathRewrite: rule.rewrite,
            skipHealthCheck,
          })
        );

        this.logger.info("Proxy rewrite route setup", {
          pattern,
          target: rule.target,
          rewrite: rule.rewrite,
        });
      }
    }

    // Setup standard service routes
    const services = this.registry.getAllServices();

    for (const service of services) {
      const servicePath = `/api/${service.name}/*`;

      app.use(
        servicePath,
        createProxyMiddleware(service.name, {
          serviceRegistry: this.registry,
          logger: this.logger,
          enableRetry: true,
          enableCircuitBreaker: true,
          getUserId: this.getUserId,
          skipHealthCheck,
        })
      );

      this.logger.info("Proxy route setup", {
        service: service.name,
        path: servicePath,
      });
    }
  }

  /**
   * Check if all services are healthy
   */
  areAllServicesHealthy(): boolean {
    const allHealth = this.registry.getAllServicesHealth();
    return allHealth.every((h) => h.healthy);
  }

  /**
   * Get aggregated health status
   */
  getAggregatedHealth(): {
    gateway: string;
    services: Record<string, boolean>;
    allHealthy: boolean;
    timestamp: number;
  } {
    const allHealth = this.registry.getAllServicesHealth();
    const services: Record<string, boolean> = {};

    for (const health of allHealth) {
      services[health.name] = health.healthy;
    }

    return {
      gateway: "ok",
      services,
      allHealthy: this.areAllServicesHealthy(),
      timestamp: Date.now(),
    };
  }

  /**
   * Service name
   */
  getServiceName(): string {
    return "gateway";
  }

  /**
   * Wait for all registered services to become healthy
   * Useful during startup to ensure services are ready before accepting traffic
   */
  async waitForServicesReady(
    timeout = 30_000,
    checkInterval = 1000
  ): Promise<{
    ready: boolean;
    healthyServices: string[];
    unhealthyServices: string[];
  }> {
    const startTime = Date.now();

    this.logger.info("Waiting for services to become ready...");

    while (Date.now() - startTime < timeout) {
      const allHealth = this.registry.getAllServicesHealth();
      const unhealthy = allHealth.filter((h) => !h.healthy);

      if (unhealthy.length === 0) {
        this.logger.info("All services are ready!", {
          services: allHealth.map((h) => h.name),
        });
        return {
          ready: true,
          healthyServices: allHealth.map((h) => h.name),
          unhealthyServices: [],
        };
      }

      this.logger.debug("Some services are not ready yet", {
        unhealthyServices: unhealthy.map((h) => `${h.name} (${h.lastError})`),
        elapsed: `${Date.now() - startTime}ms`,
      });

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Timeout reached
    const allHealth = this.registry.getAllServicesHealth();
    const healthy = allHealth.filter((h) => h.healthy);
    const unhealthy = allHealth.filter((h) => !h.healthy);

    this.logger.warn("Timeout waiting for services", {
      timeout,
      healthyServices: healthy.map((h) => h.name),
      unhealthyServices: unhealthy.map((h) => `${h.name} (${h.lastError})`),
    });

    return {
      ready: false,
      healthyServices: healthy.map((h) => h.name),
      unhealthyServices: unhealthy.map((h) => h.name),
    };
  }

  /**
   * Cleanup
   */
  protected override async onStop(): Promise<void> {
    this.registry.stop();
    await super.onStop();
  }
}
