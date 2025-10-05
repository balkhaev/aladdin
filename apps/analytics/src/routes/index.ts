/**
 * Analytics Routes Index
 * Собирает все роуты воедино
 */

import type { CacheService } from "@aladdin/cache";
import { errorHandlerMiddleware } from "@aladdin/http/errors";
import type { Hono } from "hono";
import type { AnalyticsService } from "../services/analytics";
import type { CombinedSentimentService } from "../services/sentiment/combined-sentiment";
import type { SentimentAnalysisService } from "../services/sentiment/sentiment-analysis";
import { setupCacheRoutes } from "./cache";
import { setupIndicatorsRoutes } from "./indicators";
import { setupReportsRoutes } from "./reports";
import { setupSentimentRoutes } from "./sentiment";
import { setupStatisticsRoutes } from "./statistics";

/**
 * Setup all analytics routes
 */
export function setupAnalyticsRoutes(
  app: Hono,
  service: AnalyticsService,
  sentimentService?: SentimentAnalysisService,
  combinedSentimentService?: CombinedSentimentService,
  cache?: CacheService
): void {
  // Apply error handling middleware
  app.use("*", errorHandlerMiddleware());

  // Setup route modules
  setupIndicatorsRoutes(app, service, cache);
  setupStatisticsRoutes(app, service, cache);
  setupSentimentRoutes(app, sentimentService, combinedSentimentService, cache);
  setupReportsRoutes(app, service);
  setupCacheRoutes(app, cache);
}
