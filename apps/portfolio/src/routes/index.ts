/**
 * Portfolio Routes Index
 * Собирает все роуты воедино
 */

import type { Hono } from "hono";
import type { CorrelationAnalysisService } from "../services/correlation-analysis";
import type { PortfolioService } from "../services/portfolio";
import type { RiskService } from "../services/risk";
import { setupOptimizationRoutes } from "./optimization";
import { setupPerformanceRoutes } from "./performance";
import { setupPortfolioRoutes } from "./portfolios";
import { setupPositionsRoutes } from "./positions";
import { setupPricesRoutes } from "./prices";
import { setupRebalancingRoutes } from "./rebalancing";
import { setupRiskRoutes } from "./risk";
import { setupSnapshotRoutes } from "./snapshot";
import { setupTransactionsRoutes } from "./transactions";

/**
 * Setup all portfolio routes
 */
export function setupAllPortfolioRoutes(
  app: Hono,
  service: PortfolioService,
  riskService: RiskService,
  correlationAnalysis?: CorrelationAnalysisService
): void {
  setupPortfolioRoutes(app, service);
  setupPerformanceRoutes(app, service);
  setupTransactionsRoutes(app, service);
  setupPositionsRoutes(app, service);
  setupSnapshotRoutes(app, service);
  setupPricesRoutes(app, service);
  setupOptimizationRoutes(app, service);
  setupRebalancingRoutes(app, service);
  setupRiskRoutes(app, riskService, correlationAnalysis);
}
