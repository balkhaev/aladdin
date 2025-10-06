# @aladdin/routing

Type-safe route builder with automatic validation and error handling for Hono.

## Features

- ✅ **Fluent API** - Chain methods for readable route definitions
- ✅ **Type Safety** - Full TypeScript support with type inference
- ✅ **Automatic Validation** - Zod schema validation for body, query, and params
- ✅ **Error Handling** - Automatic error catching and formatting
- ✅ **Auth Support** - Built-in auth requirement and userId extraction
- ✅ **Success Responses** - Automatic wrapping in standardized format
- ✅ **Route Groups** - Organize routes with common prefixes

## Installation

```bash
bun add @aladdin/routing
```

## Basic Usage

```typescript
import { RouteBuilder } from "@aladdin/routing"
import { z } from "zod"
import type { Hono } from "hono"

const app: Hono = new Hono()

// Simple GET route
RouteBuilder.get("/api/users")
  .handle(async () => {
    return { users: [] }
  })
  .register(app)

// POST route with validation
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

RouteBuilder.post("/api/users")
  .validate({ body: createUserSchema })
  .handle(async ({ body }) => {
    // body is typed automatically!
    return { userId: "123", email: body.email }
  })
  .register(app)

// Protected route with auth
RouteBuilder.get("/api/profile")
  .requireAuth()
  .handle(async ({ userId }) => {
    // userId is guaranteed to exist
    return { userId, profile: {} }
  })
  .register(app)
```

## Advanced Usage

### Route with Query Parameters

```typescript
const querySchema = z.object({
  page: z.string().transform(Number),
  limit: z.string().transform(Number).optional(),
})

RouteBuilder.get("/api/posts")
  .validate({ query: querySchema })
  .handle(async ({ query }) => {
    const page = query.page // typed as number
    const limit = query.limit ?? 10 // typed as number | undefined

    return { posts: [], page, limit }
  })
  .register(app)
```

### Route with Path Parameters

```typescript
const paramsSchema = z.object({
  id: z.string().uuid(),
})

RouteBuilder.get("/api/users/:id")
  .validate({ params: paramsSchema })
  .handle(async ({ params }) => {
    const userId = params.id // typed as string (validated UUID)

    return { user: { id: userId } }
  })
  .register(app)
```

### Full Example with All Features

```typescript
const updateOrderSchema = z.object({
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
})

const orderParamsSchema = z.object({
  orderId: z.string(),
})

RouteBuilder.patch("/api/orders/:orderId")
  .requireAuth()
  .validate({
    body: updateOrderSchema,
    params: orderParamsSchema,
  })
  .handle(async ({ body, params, userId }) => {
    // All parameters are fully typed!
    const order = await updateOrder(params.orderId, userId, body)

    return order
  })
  .register(app)
```

## Route Groups

Organize related routes with a common prefix:

```typescript
import { RouteGroup, RouteBuilder } from "@aladdin/routing"

const tradingRoutes = new RouteGroup("/api/trading")

tradingRoutes
  .add(
    RouteBuilder.get("/orders")
      .requireAuth()
      .handle(async ({ userId }) => {
        return { orders: [] }
      })
  )
  .add(
    RouteBuilder.post("/orders")
      .requireAuth()
      .validate({ body: createOrderSchema })
      .handle(async ({ body, userId }) => {
        return { orderId: "123" }
      })
  )
  .register(app)

// Routes registered:
// GET  /api/trading/orders
// POST /api/trading/orders
```

## Error Handling

Errors are automatically caught and formatted:

```typescript
RouteBuilder.get("/api/data")
  .handle(async () => {
    throw new Error("Something went wrong")
  })
  .register(app)

// Automatic response:
// {
//   "success": false,
//   "error": {
//     "code": "INTERNAL_ERROR",
//     "message": "Something went wrong"
//   },
//   "timestamp": 1234567890
// }
```

Validation errors are handled automatically:

```typescript
// POST /api/users with invalid body
// Automatic response:
// {
//   "success": false,
//   "error": {
//     "code": "VALIDATION_ERROR",
//     "message": "Invalid request body",
//     "details": { ... }
//   },
//   "timestamp": 1234567890
// }
```

## Success Responses

All successful responses are wrapped automatically:

```typescript
RouteBuilder.get("/api/user")
  .handle(async () => {
    return { id: "123", name: "John" }
  })
  .register(app)

// Automatic response:
// {
//   "success": true,
//   "data": {
//     "id": "123",
//     "name": "John"
//   },
//   "timestamp": 1234567890
// }
```

## Access to Hono Context

You can access the full Hono context if needed:

```typescript
RouteBuilder.get("/api/custom")
  .handle(async ({ context }) => {
    const customHeader = context.req.header("x-custom")
    context.header("x-response-header", "value")

    return { data: "custom" }
  })
  .register(app)
```

## Best Practices

1. **Define schemas separately** for reusability:

   ```typescript
   // schemas.ts
   export const createUserSchema = z.object({ ... });
   export const userParamsSchema = z.object({ ... });
   ```

2. **Use RouteGroup** for organizing related endpoints:

   ```typescript
   const apiV1 = new RouteGroup("/api/v1")
   ```

3. **Extract common logic** into middleware or service layers:

   ```typescript
   .handle(async ({ userId }) => {
     const service = new UserService();
     return await service.getUser(userId);
   })
   ```

4. **Leverage TypeScript** for type inference:
   ```typescript
   // No need to manually type - it's inferred!
   .handle(async ({ body, params, query }) => {
     // All fully typed based on schemas
   })
   ```

## Comparison to Raw Hono

### Before (Raw Hono):

```typescript
app.post("/api/orders", async (c) => {
  try {
    // Manual userId extraction
    const userId = c.req.header("x-user-id")
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Manual body validation
    const body = await c.req.json()
    const result = createOrderSchema.safeParse(body)
    if (!result.success) {
      return c.json({ error: "Validation failed", details: result.error }, 400)
    }

    // Business logic
    const order = await createOrder(userId, result.data)

    // Manual success response
    return c.json({ success: true, data: order }, 201)
  } catch (error) {
    return c.json({ error: "Internal error" }, 500)
  }
})
```

### After (RouteBuilder):

```typescript
RouteBuilder.post("/api/orders")
  .requireAuth()
  .validate({ body: createOrderSchema })
  .handle(async ({ body, userId }) => {
    return await createOrder(userId, body)
  })
  .register(app)
```

**80% less boilerplate code!** 🎉

## License

MIT
