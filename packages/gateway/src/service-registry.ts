/**
 * Service Registry
 * Manages microservices registration, health checking, and URL resolution
 */

import type { Logger } from "@aladdin/logger";

export type ServiceConfig = {
  name: string;
  url: string;
  healthCheckInterval?: number;
  enabled?: boolean;
};

export type ServiceHealth = {
  name: string;
  url: string;
  healthy: boolean;
  lastCheck: number;
  lastError?: string;
};

export type ServiceRegistryConfig = {
  services: Record<string, string>; // serviceName -> URL
  healthCheckInterval?: number;
  logger?: Logger;
};

/**
 * Service Registry
 * Tracks registered microservices and their health status
 */
export class ServiceRegistry {
  private services = new Map<string, ServiceConfig>();
  private healthStatus = new Map<string, ServiceHealth>();
  private healthCheckIntervals = new Map<string, Timer>();
  private logger?: Logger;
  private readonly healthCheckInterval: number;

  constructor(config: ServiceRegistryConfig) {
    this.logger = config.logger;
    this.healthCheckInterval = config.healthCheckInterval ?? 30_000; // 30 seconds

    // Register services
    for (const [name, url] of Object.entries(config.services)) {
      this.registerService({
        name,
        url,
        healthCheckInterval: this.healthCheckInterval,
        enabled: true,
      });
    }
  }

  /**
   * Register a new service
   */
  registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);

    // Initialize health status
    this.healthStatus.set(config.name, {
      name: config.name,
      url: config.url,
      healthy: false, // Assume unhealthy until first check
      lastCheck: 0,
    });

    // Start health check interval if enabled
    if (config.enabled !== false) {
      this.startHealthCheck(config.name);
    }

    this.logger?.info("Service registered", {
      name: config.name,
      url: config.url,
    });
  }

  /**
   * Unregister a service
   */
  unregisterService(serviceName: string): void {
    const interval = this.healthCheckIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceName);
    }

    this.services.delete(serviceName);
    this.healthStatus.delete(serviceName);

    this.logger?.info("Service unregistered", { name: serviceName });
  }

  /**
   * Get service URL
   */
  getServiceUrl(serviceName: string): string | undefined {
    return this.services.get(serviceName)?.url;
  }

  /**
   * Check if service is healthy
   */
  isServiceHealthy(serviceName: string): boolean {
    return this.healthStatus.get(serviceName)?.healthy ?? false;
  }

  /**
   * Get health status for a service
   */
  getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.healthStatus.get(serviceName);
  }

  /**
   * Get health status for all services
   */
  getAllServicesHealth(): ServiceHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * Start health check for a service
   */
  private startHealthCheck(serviceName: string): void {
    // Perform initial health check immediately
    this.performHealthCheck(serviceName).catch(() => {
      // Ignore errors on initial check
    });

    // Setup recurring health checks
    const interval = setInterval(() => {
      this.performHealthCheck(serviceName).catch(() => {
        // Errors are logged in performHealthCheck
      });
    }, this.healthCheckInterval);

    this.healthCheckIntervals.set(serviceName, interval);
  }

  /**
   * Perform health check for a service
   */
  private async performHealthCheck(serviceName: string): Promise<void> {
    const config = this.services.get(serviceName);
    if (!config) return;

    try {
      const response = await fetch(`${config.url}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const healthy = response.ok;

      this.healthStatus.set(serviceName, {
        name: serviceName,
        url: config.url,
        healthy,
        lastCheck: Date.now(),
        lastError: healthy ? undefined : `HTTP ${response.status}`,
      });

      if (healthy) {
        this.logger?.debug("Service health check passed", {
          service: serviceName,
        });
      } else {
        this.logger?.warn("Service health check failed", {
          service: serviceName,
          status: response.status,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.healthStatus.set(serviceName, {
        name: serviceName,
        url: config.url,
        healthy: false,
        lastCheck: Date.now(),
        lastError: errorMessage,
      });

      this.logger?.error("Service health check failed", {
        service: serviceName,
        error: errorMessage,
      });
    }
  }

  /**
   * Stop all health checks (cleanup)
   */
  stop(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    this.logger?.info("Service registry stopped");
  }
}
