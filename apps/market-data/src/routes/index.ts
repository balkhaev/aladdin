/**
 * Market Data Routes Index
 * Собирает все роуты воедино
 */

import type { CacheService } from "@aladdin/cache";
import { HTTP_STATUS } from "@aladdin/http/responses";
import type { Hono } from "hono";
import type { FundingRateService } from "../services/funding-rate-service";
import type { MarketDataServiceWrapper } from "../services/market-data-wrapper";
import type { OpenInterestService } from "../services/open-interest-service";
import type { OrderBookCollector } from "../services/order-book-collector";
import type { OrderBookService } from "../services/order-book-service";
import { setupCacheRoutes } from "./cache";
import { setupCandlesRoutes } from "./candles";
import { setupFuturesRoutes } from "./futures";
import { setupOrderBookRoutes } from "./orderbook";
import { setupQuotesRoutes } from "./quotes";
import { setupTickersRoutes } from "./tickers";

// Re-export existing routes
export { setupMacroRoutes } from "./macro";
export { setupOnChainRoutes } from "./on-chain";

/**
 * Setup all market data routes
 */
export function setupMarketDataRoutes(
  app: Hono,
  service: MarketDataServiceWrapper,
  orderBookService?: OrderBookService,
  orderBookCollector?: OrderBookCollector,
  fundingRateService?: FundingRateService,
  openInterestService?: OpenInterestService,
  cache?: CacheService
): void {
  // WebSocket endpoint info
  app.get("/ws/market-data", (c) =>
    c.text("WebSocket endpoint. Use ws:// protocol to connect.", HTTP_STATUS.OK)
  );

  // Setup route modules
  setupTickersRoutes(app, service);
  setupQuotesRoutes(app, service, cache);
  setupCandlesRoutes(app, service);
  setupOrderBookRoutes(app, service, orderBookService, orderBookCollector);
  setupFuturesRoutes(app, fundingRateService, openInterestService);
  setupCacheRoutes(app, cache);
}
