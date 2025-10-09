/**
 * Trading Routes Index
 * Собирает все роуты воедино
 */

import type { Hono } from "hono";
import type { TradingService } from "../services/trading";
import { setupBalanceRoutes } from "./balance";
import { setupHistoryRoutes } from "./history";
import { setupOrdersRoutes } from "./orders";
import { setupPositionsRoutes } from "./positions";

// Re-export existing executor routes
export { setupExecutorRoutes } from "./executor";

// Re-export webhook routes
export { setupWebhookRoutes } from "./webhook";

/**
 * Setup all trading routes
 */
export function setupTradingRoutes(app: Hono, service: TradingService): void {
  // Setup route modules
  setupOrdersRoutes(app, service);
  setupPositionsRoutes(app, service);
  setupBalanceRoutes(app, service);
  setupHistoryRoutes(app, service);
}
