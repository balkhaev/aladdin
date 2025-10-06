/**
 * Example 2: Service with Database Access
 *
 * This example demonstrates how to create a service that uses PostgreSQL
 * with Prisma ORM.
 */

import { createSuccessResponse } from "@aladdin/http/responses";
import { BaseService, initializeService } from "@aladdin/service";
import type { Hono } from "hono";

// Define your service
class UserService extends BaseService {
  getServiceName(): string {
    return "user-service";
  }

  // Business logic using Prisma
  async createUser(data: { email: string; name: string }) {
    const prisma = this.getPrisma();
    if (!prisma) {
      throw new Error("Prisma client not available");
    }

    // Example: Create user (adjust based on your Prisma schema)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
      },
    });

    return user;
  }

  async getUser(id: string) {
    const prisma = this.getPrisma();
    if (!prisma) {
      throw new Error("Prisma client not available");
    }

    return await prisma.user.findUnique({
      where: { id },
    });
  }

  async listUsers(limit = 10) {
    const prisma = this.getPrisma();
    if (!prisma) {
      throw new Error("Prisma client not available");
    }

    return await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }
}

// Initialize service
await initializeService({
  serviceName: "user-service",
  port: 3021,

  createService: (deps) =>
    new UserService({
      ...deps,
      enableCache: true, // Enable caching
      enableServiceClient: false,
    }),

  setupRoutes: (app: Hono, service: UserService) => {
    // GET /api/users - List all users
    app.get("/api/users", async (c) => {
      const limit = Number(c.req.query("limit") ?? "10");
      const users = await service.listUsers(limit);

      return c.json(
        createSuccessResponse({
          users,
          count: users.length,
        })
      );
    });

    // GET /api/users/:id - Get user by ID
    app.get("/api/users/:id", async (c) => {
      const { id } = c.req.param();
      const user = await service.getUser(id);

      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found",
            },
            timestamp: Date.now(),
          },
          404
        );
      }

      return c.json(createSuccessResponse(user));
    });

    // POST /api/users - Create new user
    app.post("/api/users", async (c) => {
      const body = await c.req.json<{ email: string; name: string }>();

      const user = await service.createUser(body);

      return c.json(createSuccessResponse(user), 201);
    });
  },

  // Enable PostgreSQL
  dependencies: {
    postgres: true,
    nats: false,
    clickhouse: false,
  },
});
