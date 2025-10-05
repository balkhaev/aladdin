/**
 * Market Data Service Entry Point
 * Минимальный bootstrap файл
 */

import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { ServerWebSocket } from "bun";
import {
  config,
  DEFAULT_SYMBOLS,
  EXCHANGE_URLS,
  INTERVALS,
  SERVICES,
  TIME,
} from "./config";
import { BinanceConnector } from "./connectors/binance";
import { BybitConnector } from "./connectors/bybit";
import { OKXConnector } from "./connectors/okx";
import { setupMarketDataRoutes, setupMacroRoutes, setupOnChainRoutes } from "./routes";
import { FundingRateCollector } from "./services/funding-rate-collector";
import { FundingRateService } from "./services/funding-rate-service";
import { MarketDataServiceWrapper } from "./services/market-data-wrapper";
import { OpenInterestCollector } from "./services/open-interest-collector";
import { OpenInterestService } from "./services/open-interest-service";
import { OrderBookCollector } from "./services/order-book-collector";
import { OrderBookService } from "./services/order-book-service";
import { WebSocketHandler } from "./websocket/handler";
import "dotenv/config";

type WebSocketData = {
  clientId: string;
  subscribedSymbols: Set<string>;
  subscribedCandles: Set<string>;
  subscribedOrderBooks: Map<string, number>;
  subscribedTrades: Set<string>;
  orderBookIntervals: Map<string, Timer>;
};

let wsHandler: WebSocketHandler;
let bybitConnector: BybitConnector;
let okxConnector: OKXConnector;
let orderBookService: OrderBookService | undefined;
let orderBookCollector: OrderBookCollector | undefined;
let fundingRateService: FundingRateService | undefined;
let fundingRateCollector: FundingRateCollector | undefined;
let openInterestService: OpenInterestService | undefined;
let openInterestCollector: OpenInterestCollector | undefined;

/**
 * Subscribe to portfolio events for dynamic symbol subscription
 */
async function subscribeToPortfolioEvents(
  service: MarketDataServiceWrapper,
  bybit: BybitConnector,
  okx: OKXConnector
): Promise<void> {
  const { natsClient, logger } = service as unknown as {
    natsClient?: {
      subscribe: (
        subject: string,
        handler: (msg: string) => Promise<void>
      ) => Promise<void>;
    };
    logger?: {
      info: (msg: string, data?: Record<string, unknown>) => void;
      error: (msg: string, error: unknown) => void;
    };
  };

  if (!natsClient) return;

  try {
    await natsClient.subscribe(
      "portfolio.position.created",
      async (msg: string) => {
        try {
          const event = JSON.parse(msg) as {
            type: "portfolio.position.created";
            data: { portfolioId: string; position: { symbol: string } };
          };

          const { symbol } = event.data.position;
          const availableTickers = service.getAvailableTickers();

          if (!availableTickers.includes(symbol)) {
            await service.subscribeToSymbol(symbol);
            await bybit.subscribe(symbol);
            await okx.subscribe(symbol);
            logger?.info("Subscribed to new symbol from position", { symbol });
          }
        } catch (error) {
          logger?.error("Failed to handle position created event", error);
        }
      }
    );

    await natsClient.subscribe(
      "portfolio.position.updated",
      async (msg: string) => {
        try {
          const event = JSON.parse(msg) as {
            type: "portfolio.position.updated";
            data: { portfolioId: string; position: { symbol: string } };
          };

          const { symbol } = event.data.position;
          const availableTickers = service.getAvailableTickers();

          if (!availableTickers.includes(symbol)) {
            await service.subscribeToSymbol(symbol);
            await bybit.subscribe(symbol);
            await okx.subscribe(symbol);
          }
        } catch (error) {
          logger?.error("Failed to handle position updated event", error);
        }
      }
    );

    logger?.info("Subscribed to portfolio events");
  } catch (error) {
    logger?.error("Failed to subscribe to portfolio events", error);
  }
}

/**
 * Subscribe to all symbols from portfolio positions
 */
async function subscribeToPortfolioSymbols(
  service: MarketDataServiceWrapper,
  bybit: BybitConnector,
  okx: OKXConnector
): Promise<void> {
  try {
    const response = await fetch(`${SERVICES.PORTFOLIO_URL}/api/portfolio/symbols`);

    if (!response.ok) return;

    const result = (await response.json()) as {
      success: boolean;
      data: Array<{ symbol: string; exchange: string }>;
    };

    const hasData = result.success && result.data && result.data.length > 0;
    if (!hasData) return;

    const binanceSymbols = result.data
      .filter((s) => s.exchange === "binance")
      .map((s) => s.symbol);

    if (binanceSymbols.length > 0) {
      await service.subscribeToSymbols(binanceSymbols);

      for (const symbol of binanceSymbols) {
        await bybit.subscribe(symbol);
        await okx.subscribe(symbol);
      }
    }
  } catch {
    // Ignore errors
  }
}

await initializeService<MarketDataServiceWrapper, WebSocketData>({
  serviceName: "market-data",
  port: config.PORT,

  createService: (deps) => {
    // Create connectors
    const binanceConnector = new BinanceConnector({
      logger: deps.logger,
      wsUrl: EXCHANGE_URLS.BINANCE.WS,
      apiUrl: EXCHANGE_URLS.BINANCE.API,
    });

    bybitConnector = new BybitConnector({
      logger: deps.logger,
      wsUrl: EXCHANGE_URLS.BYBIT.WS,
      apiUrl: EXCHANGE_URLS.BYBIT.API,
      category: "spot",
    });

    okxConnector = new OKXConnector({
      logger: deps.logger,
      wsUrl: EXCHANGE_URLS.OKX.WS,
      apiUrl: EXCHANGE_URLS.OKX.API,
    });

    return new MarketDataServiceWrapper({
      ...deps,
      connectors: {
        primary: binanceConnector,
        secondary: [bybitConnector, okxConnector],
      },
      enableCache: true,
      enableServiceClient: true,
    });
  },

  afterInit: async (service, deps) => {
    // Connect secondary connectors
    await bybitConnector.connect();
    deps.logger.info("Bybit connector connected");

    await okxConnector.connect();
    deps.logger.info("OKX connector connected");

    // Initialize WebSocket handler
    wsHandler = new WebSocketHandler(
      service.getMarketDataService(),
      deps.logger
    );

    // Subscribe to portfolio events
    await subscribeToPortfolioEvents(service, bybitConnector, okxConnector);
    await subscribeToPortfolioSymbols(service, bybitConnector, okxConnector);

    // Subscribe to default symbols on all exchanges
    for (const symbol of DEFAULT_SYMBOLS) {
      const trimmedSymbol = symbol.trim();
      await service.subscribeToSymbol(trimmedSymbol);
      await bybitConnector.subscribe(trimmedSymbol);
      await okxConnector.subscribe(trimmedSymbol);
    }

    deps.logger.info("Subscribed to default symbols on all exchanges", {
      symbols: DEFAULT_SYMBOLS,
      exchanges: ["binance", "bybit", "okx"],
    });

    // Initialize futures data collectors if ClickHouse is available
    if (deps.clickhouse) {
      // Order Book Collector
      orderBookService = new OrderBookService(deps.clickhouse, deps.logger);
      orderBookCollector = new OrderBookCollector(orderBookService, deps.logger);

      const exchanges = ["binance", "bybit", "okx"];
      orderBookCollector.start(DEFAULT_SYMBOLS, exchanges, INTERVALS.ORDERBOOK);

      deps.logger.info("Order book collector started", {
        symbols: DEFAULT_SYMBOLS,
        exchanges,
        intervalMs: INTERVALS.ORDERBOOK,
        collectionsPerMinute: Math.floor(TIME.MILLISECONDS_PER_MINUTE / INTERVALS.ORDERBOOK),
      });

      // Funding Rate Collector
      fundingRateService = new FundingRateService(deps.clickhouse, deps.logger);
      fundingRateCollector = new FundingRateCollector(fundingRateService, deps.logger);

      fundingRateCollector.start(DEFAULT_SYMBOLS, exchanges, INTERVALS.FUNDING_RATE);

      deps.logger.info("Funding rate collector started", {
        symbols: DEFAULT_SYMBOLS,
        exchanges,
        intervalMs: INTERVALS.FUNDING_RATE,
        collectionsPerHour: Math.floor(TIME.MILLISECONDS_PER_HOUR / INTERVALS.FUNDING_RATE),
      });

      // Open Interest Collector
      openInterestService = new OpenInterestService(deps.clickhouse, deps.logger);
      openInterestCollector = new OpenInterestCollector(openInterestService, deps.logger);

      openInterestCollector.start(DEFAULT_SYMBOLS, exchanges, INTERVALS.OPEN_INTEREST);

      deps.logger.info("Open interest collector started", {
        symbols: DEFAULT_SYMBOLS,
        exchanges,
        intervalMs: INTERVALS.OPEN_INTEREST,
        collectionsPerHour: Math.floor(TIME.MILLISECONDS_PER_HOUR / INTERVALS.OPEN_INTEREST),
      });
    } else {
      deps.logger.warn("ClickHouse not available, futures data collectors disabled");
    }
  },

  setupRoutes: (app, service) => {
    // Get cache service from BaseService
    const cache = service.hasCacheService()
      ? service.getCache("market-data:", 5)
      : undefined;

    // Setup main market data routes
    setupMarketDataRoutes(
      app,
      service,
      orderBookService,
      orderBookCollector,
      fundingRateService,
      openInterestService,
      cache
    );

    // Setup macro data routes
    setupMacroRoutes(app, service.clickhouseClient);

    // Setup on-chain routes
    setupOnChainRoutes(app, service.clickhouseClient);
  },

  websocket: {
    enabled: true,
    path: "/ws/market-data",
    handlers: {
      open: (ws: ServerWebSocket<WebSocketData>) => {
        if (wsHandler) {
          wsHandler.onOpen(ws);
        }
      },
      message: (ws: ServerWebSocket<WebSocketData>, message: string) => {
        if (wsHandler) {
          wsHandler.onMessage(ws, message);
        }
      },
      close: (
        ws: ServerWebSocket<WebSocketData>,
        code: number,
        reason: string
      ) => {
        if (wsHandler) {
          wsHandler.onClose(ws, code, reason);
        }
      },
    },
    createWebSocketData: () => ({
      clientId: crypto.randomUUID(),
      subscribedSymbols: new Set<string>(),
      subscribedCandles: new Set<string>(),
      subscribedOrderBooks: new Map<string, number>(),
      subscribedTrades: new Set<string>(),
      orderBookIntervals: new Map<string, Timer>(),
    }),
  },

  dependencies: {
    nats: true,
    postgres: false,
    clickhouse: true,
  },
});

