/**
 * Example: Service with RouteBuilder
 * Demonstrates type-safe route definitions
 */

import { RouteBuilder, RouteGroup } from "@aladdin/routing";
import { BaseService } from "@aladdin/service";
import { initializeService } from "@aladdin/service/bootstrap";
import { z } from "zod";

// ============ Service Class ============

class ExampleService extends BaseService {}

// ============ Validation Schemas ============

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  age: z.number().int().positive().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  age: z.number().int().positive().optional(),
});

const userIdSchema = z.object({
  id: z.string().uuid(),
});

const queryUsersSchema = z.object({
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("10"),
  search: z.string().optional(),
});

// ============ Initialize Service ============

await initializeService({
  serviceName: "route-builder-example",
  port: 3099,

  createService: (deps) =>
    new ExampleService({
      ...deps,
      enableCache: false,
      enableServiceClient: false,
    }),

  setupRoutes: (app) => {
    // Example 1: Simple GET route
    RouteBuilder.get("/api/health")
      .handle(async () => ({ status: "healthy", timestamp: Date.now() }))
      .register(app);

    // Example 2: POST with body validation
    RouteBuilder.post("/api/users")
      .validate({ body: createUserSchema })
      .handle(async ({ body }) => {
        // body is fully typed!
        return {
          id: crypto.randomUUID(),
          email: body.email,
          name: body.name,
          age: body.age,
          createdAt: new Date().toISOString(),
        };
      })
      .register(app);

    // Example 3: GET with query parameters
    RouteBuilder.get("/api/users")
      .validate({ query: queryUsersSchema })
      .handle(async ({ query }) => {
        // query is fully typed!
        return {
          users: [],
          pagination: {
            page: query.page,
            limit: query.limit,
            total: 0,
          },
          search: query.search,
        };
      })
      .register(app);

    // Example 4: GET with path parameters
    RouteBuilder.get("/api/users/:id")
      .validate({ params: userIdSchema })
      .handle(async ({ params }) => {
        // params is fully typed!
        return {
          id: params.id,
          email: "user@example.com",
          name: "John Doe",
        };
      })
      .register(app);

    // Example 5: PATCH with auth + body + params
    RouteBuilder.patch("/api/users/:id")
      .requireAuth()
      .validate({
        body: updateUserSchema,
        params: userIdSchema,
      })
      .handle(async ({ body, params, userId }) => {
        // All parameters are fully typed!
        // userId is guaranteed to exist because of requireAuth()
        return {
          id: params.id,
          name: body.name || "John Doe",
          age: body.age || 30,
          updatedBy: userId,
          updatedAt: new Date().toISOString(),
        };
      })
      .register(app);

    // Example 6: DELETE with auth
    RouteBuilder.delete("/api/users/:id")
      .requireAuth()
      .validate({ params: userIdSchema })
      .handle(async ({ params, userId }) => ({
        id: params.id,
        deleted: true,
        deletedBy: userId,
        deletedAt: new Date().toISOString(),
      }))
      .register(app);

    // Example 7: Using RouteGroup for organization
    const adminRoutes = new RouteGroup("/api/admin");

    adminRoutes
      .add(
        RouteBuilder.get("/stats")
          .requireAuth()
          .handle(async () => ({
            totalUsers: 100,
            activeUsers: 85,
            timestamp: Date.now(),
          }))
      )
      .add(
        RouteBuilder.get("/users")
          .requireAuth()
          .validate({ query: queryUsersSchema })
          .handle(async ({ query }) => ({
            users: [],
            page: query.page,
            limit: query.limit,
          }))
      )
      .add(
        RouteBuilder.delete("/users/:id")
          .requireAuth()
          .validate({ params: userIdSchema })
          .handle(async ({ params, userId }) => ({
            success: true,
            deletedUserId: params.id,
            deletedBy: userId,
          }))
      )
      .register(app);

    // Routes registered:
    // GET  /api/admin/stats
    // GET  /api/admin/users
    // DELETE /api/admin/users/:id

    // Example 8: Error handling (automatic)
    RouteBuilder.get("/api/error")
      .handle(async () => {
        throw new Error("Something went wrong");
        // Automatically caught and returns:
        // {
        //   "success": false,
        //   "error": {
        //     "code": "INTERNAL_ERROR",
        //     "message": "Something went wrong"
        //   },
        //   "timestamp": 1234567890
        // }
      })
      .register(app);

    // Example 9: Access Hono context if needed
    RouteBuilder.get("/api/custom")
      .handle(async ({ context }) => {
        const userAgent = context.req.header("user-agent");
        const ip = context.req.header("x-forwarded-for");

        return {
          userAgent,
          ip,
          timestamp: Date.now(),
        };
      })
      .register(app);
  },

  dependencies: {
    nats: false,
    postgres: false,
    clickhouse: false,
  },
});

// ============ Comparison: Before vs After ============

/*
BEFORE (Raw Hono):
------------------
app.post("/api/users", async (c) => {
  try {
    // Manual validation
    const body = await c.req.json();
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Validation failed" }, 400);
    }

    // Business logic
    const user = {
      id: crypto.randomUUID(),
      ...result.data,
      createdAt: new Date().toISOString(),
    };

    // Manual success response
    return c.json({ success: true, data: user }, 201);
  } catch (error) {
    return c.json({ error: "Internal error" }, 500);
  }
});

AFTER (RouteBuilder):
---------------------
RouteBuilder.post("/api/users")
  .validate({ body: createUserSchema })
  .handle(async ({ body }) => {
    return {
      id: crypto.randomUUID(),
      ...body,
      createdAt: new Date().toISOString(),
    };
  })
  .register(app);

Result: 80% less code! 🎉
*/
