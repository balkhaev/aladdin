/**
 * Authentication and authorization middleware
 */

import { UnauthorizedError } from "@aladdin/http/errors";
import type { Context, Next } from "hono";

/**
 * Extract userId from request headers
 * This is a placeholder implementation for now
 * TODO: Integrate with Supabase JWT validation
 */
export function extractUserId() {
  return async (c: Context, next: Next) => {
    const userId = c.req.header("x-user-id");

    if (userId) {
      c.set("userId", userId);
    } else if (process.env.NODE_ENV === "development") {
      // For development, use a default test user
      c.set("userId", "test-user");
    } else {
      throw new UnauthorizedError("User ID is required");
    }

    await next();
  };
}

/**
 * Require authentication
 * Validates JWT token and extracts user information
 * TODO: Implement JWT validation with Supabase
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
      // For development, allow without auth
      if (process.env.NODE_ENV === "development") {
        c.set("userId", "test-user");
        c.set("user", { id: "test-user", email: "test@example.com" });
        await next();
        return;
      }

      throw new UnauthorizedError("Authorization header is required");
    }

    // Extract Bearer token
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      throw new UnauthorizedError("Invalid authorization header");
    }

    // TODO: Validate JWT token with Supabase
    // For now, just extract user ID from token or use test user
    // Placeholder: In production, validate JWT and extract user info
    const userId = c.req.header("x-user-id") ?? "test-user";

    c.set("userId", userId);
    c.set("user", {
      id: userId,
      email: "test@example.com", // TODO: Extract from JWT
    });

    await next();
  };
}

/**
 * Optional authentication
 * Extracts user info if available, but doesn't require it
 */
export function optionalAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (authHeader) {
      // TODO: Validate JWT token
      const userId = c.req.header("x-user-id") ?? "test-user";

      c.set("userId", userId);
      c.set("user", { id: userId, email: "test@example.com" });
    }

    await next();
  };
}

/**
 * Type helpers for accessing user data from context
 */
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    user: {
      id: string;
      email: string;
    };
  }
}
