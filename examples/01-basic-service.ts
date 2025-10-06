/**
 * Example 1: Creating a Basic Microservice
 *
 * This example shows how to create a simple microservice using BaseService
 * with minimal configuration.
 */

import { BaseService, initializeService } from "@aladdin/service";
import type { ServiceDependencies } from "@aladdin/service/bootstrap";
import type { Hono } from "hono";

// 1. Define your service class
class HelloService extends BaseService {
  getServiceName(): string {
    return "hello-service";
  }

  // Optional: Add custom initialization
  protected override async onInitialize(): Promise<void> {
    this.logger.info("Hello service initializing...");
  }

  // Optional: Add custom startup logic
  protected override async onStart(): Promise<void> {
    this.logger.info("Hello service started!");
  }

  // Add your business logic
  async greet(name: string): Promise<string> {
    return `Hello, ${name}!`;
  }
}

// 2. Initialize and start the service
await initializeService({
  serviceName: "hello-service",
  port: 3020,

  // Create service instance
  createService: (deps: ServiceDependencies) =>
    new HelloService({
      ...deps,
      enableCache: false,
      enableServiceClient: false,
    }),

  // Setup HTTP routes
  setupRoutes: (app: Hono, service: HelloService) => {
    app.get("/api/hello/:name", async (c) => {
      const { name } = c.req.param();
      const message = await service.greet(name);

      return c.json({
        success: true,
        data: { message },
        timestamp: Date.now(),
      });
    });

    app.get("/api/hello", async (c) => {
      const message = await service.greet("World");

      return c.json({
        success: true,
        data: { message },
        timestamp: Date.now(),
      });
    });
  },

  // No dependencies needed for this simple service
  dependencies: {
    nats: false,
    postgres: false,
    clickhouse: false,
  },
});
