/**
 * Routing Types
 */

import type { Context } from "hono";
import type { z } from "zod";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RouteContext<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> = {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
  userId?: string;
  context: Context;
};

export type RouteHandler<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  TResponse = unknown,
> = (ctx: RouteContext<TBody, TQuery, TParams>) => Promise<TResponse>;

export type ValidationSchemas<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> = {
  body?: z.ZodType<TBody>;
  query?: z.ZodType<TQuery>;
  params?: z.ZodType<TParams>;
};

export type RouteConfig<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
  TResponse = unknown,
> = {
  method: HTTPMethod;
  path: string;
  handler: RouteHandler<TBody, TQuery, TParams, TResponse>;
  schemas?: ValidationSchemas<TBody, TQuery, TParams>;
  requireAuth?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
};
