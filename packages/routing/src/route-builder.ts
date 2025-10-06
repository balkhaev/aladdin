/**
 * Route Builder
 * Fluent API for defining type-safe routes with validation
 */

import { ValidationError } from "@aladdin/http/errors";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/http/responses";
import type { Context, Hono } from "hono";
import type { z } from "zod";
import type {
  HTTPMethod,
  RouteConfig,
  RouteContext,
  RouteHandler,
  ValidationSchemas,
} from "./types";

export class RouteBuilder<
  TBody = never,
  TQuery = never,
  TParams = never,
  TResponse = unknown,
> {
  private config: Partial<RouteConfig<TBody, TQuery, TParams, TResponse>> = {};

  constructor(method: HTTPMethod, path: string) {
    this.config.method = method;
    this.config.path = path;
  }

  /**
   * Static factory methods for each HTTP method
   */
  static get(path: string): RouteBuilder {
    return new RouteBuilder("GET", path);
  }

  static post(path: string): RouteBuilder {
    return new RouteBuilder("POST", path);
  }

  static put(path: string): RouteBuilder {
    return new RouteBuilder("PUT", path);
  }

  static patch(path: string): RouteBuilder {
    return new RouteBuilder("PATCH", path);
  }

  static delete(path: string): RouteBuilder {
    return new RouteBuilder("DELETE", path);
  }

  /**
   * Specify validation schemas
   */
  validate<NewBody = never, NewQuery = never, NewParams = never>(schemas: {
    body?: z.ZodType<NewBody>;
    query?: z.ZodType<NewQuery>;
    params?: z.ZodType<NewParams>;
  }): RouteBuilder<NewBody, NewQuery, NewParams, TResponse> {
    const newBuilder = this as unknown as RouteBuilder<
      NewBody,
      NewQuery,
      NewParams,
      TResponse
    >;
    newBuilder.config.schemas = schemas as ValidationSchemas<
      NewBody,
      NewQuery,
      NewParams
    >;
    return newBuilder;
  }

  /**
   * Require authentication
   */
  requireAuth(): RouteBuilder<TBody, TQuery, TParams, TResponse> {
    this.config.requireAuth = true;
    return this;
  }

  /**
   * Set rate limiting
   */
  rateLimit(
    maxRequests: number,
    windowMs: number
  ): RouteBuilder<TBody, TQuery, TParams, TResponse> {
    this.config.rateLimit = { maxRequests, windowMs };
    return this;
  }

  /**
   * Define the handler
   */
  handle<NewResponse = unknown>(
    handler: RouteHandler<TBody, TQuery, TParams, NewResponse>
  ): RouteBuilder<TBody, TQuery, TParams, NewResponse> {
    const newBuilder = this as unknown as RouteBuilder<
      TBody,
      TQuery,
      TParams,
      NewResponse
    >;
    newBuilder.config.handler = handler as RouteHandler<
      TBody,
      TQuery,
      TParams,
      unknown
    >;
    return newBuilder;
  }

  /**
   * Register the route on a Hono app
   */
  register(app: Hono): void {
    const isConfigValid = Boolean(
      this.config.method && this.config.path && this.config.handler
    );

    if (!isConfigValid) {
      throw new Error("Route must have method, path, and handler");
    }

    const { method, path, handler, schemas, requireAuth } = this
      .config as Required<
      Pick<
        RouteConfig<TBody, TQuery, TParams, TResponse>,
        "method" | "path" | "handler"
      >
    > &
      Pick<
        RouteConfig<TBody, TQuery, TParams, TResponse>,
        "schemas" | "requireAuth" | "rateLimit"
      >;

    // Create Hono handler
    const honoHandler = async (c: Context) => {
      try {
        // Extract userId
        const userId = requireAuth
          ? c.req.header("x-user-id") || c.get("userId") || undefined
          : undefined;

        if (requireAuth && !userId) {
          return c.json(
            {
              success: false,
              error: {
                code: "UNAUTHORIZED",
                message: "Authentication required",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.UNAUTHORIZED
          );
        }

        // Extract and validate body
        let body: TBody | undefined;
        if (schemas?.body && ["POST", "PUT", "PATCH"].includes(method)) {
          const rawBody = await c.req.json().catch(() => ({}));
          const result = schemas.body.safeParse(rawBody);

          if (!result.success) {
            throw new ValidationError("Invalid request body", result.error);
          }

          body = result.data as TBody;
        }

        // Extract and validate query
        let query: TQuery | undefined;
        if (schemas?.query) {
          const rawQuery = Object.fromEntries(
            new URL(c.req.url).searchParams.entries()
          );
          const result = schemas.query.safeParse(rawQuery);

          if (!result.success) {
            throw new ValidationError("Invalid query parameters", result.error);
          }

          query = result.data as TQuery;
        }

        // Extract and validate params
        let params: TParams | undefined;
        if (schemas?.params) {
          const rawParams = c.req.param();
          const result = schemas.params.safeParse(rawParams);

          if (!result.success) {
            throw new ValidationError("Invalid path parameters", result.error);
          }

          params = result.data as TParams;
        } else {
          // If no schema, just get params directly
          params = c.req.param() as TParams;
        }

        // Create route context
        const ctx: RouteContext<TBody, TQuery, TParams> = {
          body,
          query,
          params,
          userId,
          context: c,
        };

        // Call handler
        const result = await handler(ctx);

        // Return success response
        return c.json(createSuccessResponse(result));
      } catch (error) {
        // Handle validation errors
        if (error instanceof ValidationError) {
          return c.json(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: error.message,
                details: error.details,
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.BAD_REQUEST
          );
        }

        // Handle other errors
        const message =
          error instanceof Error ? error.message : "Internal server error";

        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    };

    // Register on Hono app
    switch (method) {
      case "GET":
        app.get(path, honoHandler);
        break;
      case "POST":
        app.post(path, honoHandler);
        break;
      case "PUT":
        app.put(path, honoHandler);
        break;
      case "PATCH":
        app.patch(path, honoHandler);
        break;
      case "DELETE":
        app.delete(path, honoHandler);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method as string}`);
    }
  }
}

/**
 * Helper to create a route group with common prefix
 */
export class RouteGroup {
  private routes: RouteBuilder[] = [];

  constructor(private prefix: string) {}

  /**
   * Add a route to this group
   */
  add(route: RouteBuilder): RouteGroup {
    this.routes.push(route);
    return this;
  }

  /**
   * Register all routes in this group
   */
  register(app: Hono): void {
    for (const route of this.routes) {
      // Update path to include prefix
      const config = (route as { config: { path?: string } }).config;
      if (config.path) {
        config.path = `${this.prefix}${config.path}`;
      }

      route.register(app);
    }
  }
}
