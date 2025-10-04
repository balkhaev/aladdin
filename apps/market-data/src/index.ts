import { CacheService } from "@aladdin/shared/cache";
import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { ServerWebSocket } from "bun";
import { BinanceConnector } from "./connectors/binance";
import { BybitConnector } from "./connectors/bybit";
import { OKXConnector } from "./connectors/okx";
import { FundingRateCollector } from "./services/funding-rate-collector";
import { FundingRateService } from "./services/funding-rate-service";
import { MarketDataServiceWrapper } from "./services/market-data-wrapper";
import { OpenInterestCollector } from "./services/open-interest-collector";
import { OpenInterestService } from "./services/open-interest-service";
import { OrderBookCollector } from "./services/order-book-collector";
import { OrderBookService } from "./services/order-book-service";
import { WebSocketHandler } from "./websocket/handler";
import { setupMacroRoutes } from "./routes/macro";
import { setupOnChainRoutes } from "./routes/on-chain";
import "dotenv/config";

const DEFAULT_PORT = 3010;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_TRADES_LIMIT = 1000;
const DEFAULT_ARBITRAGE_LIMIT = 100;
const DEFAULT_ARBIT_LIMIT_QUERY = 20;
const CACHE_TTL_SECONDS = 5;

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
let cacheService: CacheService;
let orderBookCollector: OrderBookCollector;
let orderBookService: OrderBookService;
let fundingRateService: FundingRateService;
let fundingRateCollector: FundingRateCollector;
let openInterestService: OpenInterestService;
let openInterestCollector: OpenInterestCollector;

/**
 * Subscribe to portfolio events for dynamic symbol subscription
 */
const DEFAULT_LIMIT = 1;
const DEFAULT_ORDERBOOK_LIMIT = 100;

async function subscribeToPortfolioEvents(
  service: MarketDataServiceWrapper
): Promise<void> {
  const serviceAny = service as unknown as {
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

  try {
    const natsClient = serviceAny.natsClient;
    if (!natsClient) {
      throw new Error("NATS client not available");
    }

    // Subscribe to position created events
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
            await bybitConnector.subscribe(symbol);
            await okxConnector.subscribe(symbol);
            serviceAny.logger?.info("Subscribed to new symbol from position", {
              symbol,
            });
          }
        } catch (error) {
          serviceAny.logger?.error(
            "Failed to handle position created event",
            error
          );
        }
      }
    );

    // Subscribe to position updated events
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
            await bybitConnector.subscribe(symbol);
            await okxConnector.subscribe(symbol);
          }
        } catch (error) {
          serviceAny.logger?.error(
            "Failed to handle position updated event",
            error
          );
        }
      }
    );

    serviceAny.logger?.info("Subscribed to portfolio events");
  } catch (error) {
    serviceAny.logger?.error("Failed to subscribe to portfolio events", error);
  }
}

/**
 * Subscribe to all symbols from portfolio positions
 */
async function subscribeToPortfolioSymbols(
  service: MarketDataServiceWrapper
): Promise<void> {
  const serviceAny = service as unknown as {
    logger?: { error: (msg: string, error: unknown) => void };
  };

  try {
    const portfolioUrl = process.env.PORTFOLIO_URL || "http://localhost:3012";
    const response = await fetch(`${portfolioUrl}/api/portfolio/symbols`);

    if (!response.ok) {
      return;
    }

    const result = (await response.json()) as {
      success: boolean;
      data: Array<{ symbol: string; exchange: string }>;
    };

    const hasData = result.success && result.data && result.data.length > 0;
    if (!hasData) {
      return;
    }

    const binanceSymbols = result.data
      .filter((s) => s.exchange === "binance")
      .map((s) => s.symbol);

    if (binanceSymbols.length > 0) {
      await service.subscribeToSymbols(binanceSymbols);

      // Subscribe secondary connectors
      for (const symbol of binanceSymbols) {
        await bybitConnector.subscribe(symbol);
        await okxConnector.subscribe(symbol);
      }
    }
  } catch (error) {
    serviceAny.logger?.error("Failed to subscribe to portfolio symbols", error);
  }
}

await initializeService<MarketDataServiceWrapper, WebSocketData>({
  serviceName: "market-data",
  port: PORT,

  createService: (deps) => {
    // Create connectors
    const binanceConnector = new BinanceConnector({
      logger: deps.logger,
      wsUrl: process.env.BINANCE_WS_URL ?? "wss://stream.binance.com:9443",
      apiUrl: process.env.BINANCE_API_URL ?? "https://api.binance.com",
    });

    bybitConnector = new BybitConnector({
      logger: deps.logger,
      wsUrl:
        process.env.BYBIT_WS_URL ?? "wss://stream.bybit.com/v5/public/spot",
      apiUrl: process.env.BYBIT_API_URL ?? "https://api.bybit.com",
      category: "spot",
    });

    okxConnector = new OKXConnector({
      logger: deps.logger,
      wsUrl: process.env.OKX_WS_URL ?? "wss://ws.okx.com:8443/ws/v5/public",
      apiUrl: process.env.OKX_API_URL ?? "https://www.okx.com",
    });

    return new MarketDataServiceWrapper({
      ...deps,
      connectors: {
        primary: binanceConnector,
        secondary: [bybitConnector, okxConnector],
      },
    });
  },

  afterInit: async (service, deps) => {
    // Initialize Redis cache
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      cacheService = new CacheService({
        redis: redisUrl,
        logger: deps.logger,
        keyPrefix: "market-data:",
        defaultTTL: 5, // 5 seconds default for market data
      });
      deps.logger.info("Redis cache initialized for market data");
    } else {
      deps.logger.warn("Redis URL not configured, caching disabled");
    }

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
    await subscribeToPortfolioEvents(service);
    await subscribeToPortfolioSymbols(service);

    // Subscribe to default symbols on all exchanges
    const defaultSymbols = (
      process.env.DEFAULT_SYMBOLS ?? "BTCUSDT,ETHUSDT,BNBUSDT"
    ).split(",");

    for (const symbol of defaultSymbols) {
      const trimmedSymbol = symbol.trim();
      await service.subscribeToSymbol(trimmedSymbol);
      await bybitConnector.subscribe(trimmedSymbol);
      await okxConnector.subscribe(trimmedSymbol);
    }

    deps.logger.info("Subscribed to default symbols on all exchanges", {
      symbols: defaultSymbols,
      exchanges: ["binance", "bybit", "okx"],
    });

    // Initialize Order Book Collector
    if (deps.clickhouse) {
      orderBookService = new OrderBookService(deps.clickhouse, deps.logger);
      orderBookCollector = new OrderBookCollector(
        orderBookService,
        deps.logger
      );

      const exchanges = ["binance", "bybit", "okx"];
      const collectionInterval = Number.parseInt(
        process.env.ORDERBOOK_INTERVAL_MS || "5000",
        10
      );

      orderBookCollector.start(defaultSymbols, exchanges, collectionInterval);

      deps.logger.info("Order book collector started", {
        symbols: defaultSymbols,
        exchanges,
        intervalMs: collectionInterval,
        collectionsPerMinute: Math.floor(MS_PER_MINUTE / collectionInterval),
      });

      // Initialize Funding Rate Collector
      fundingRateService = new FundingRateService(deps.clickhouse, deps.logger);
      fundingRateCollector = new FundingRateCollector(
        fundingRateService,
        deps.logger
      );

      const fundingInterval = Number.parseInt(
        process.env.FUNDING_INTERVAL_MS || String(MS_PER_HOUR),
        10
      ); // 1 hour
      fundingRateCollector.start(defaultSymbols, exchanges, fundingInterval);

      deps.logger.info("Funding rate collector started", {
        symbols: defaultSymbols,
        exchanges,
        intervalMs: fundingInterval,
        collectionsPerHour: Math.floor(MS_PER_HOUR / fundingInterval),
      });

      // Initialize Open Interest Collector
      openInterestService = new OpenInterestService(
        deps.clickhouse,
        deps.logger
      );
      openInterestCollector = new OpenInterestCollector(
        openInterestService,
        deps.logger
      );

      const oiInterval = Number.parseInt(
        process.env.OI_INTERVAL_MS || String(MS_PER_HOUR),
        10
      ); // 1 hour
      openInterestCollector.start(defaultSymbols, exchanges, oiInterval);

      deps.logger.info("Open interest collector started", {
        symbols: defaultSymbols,
        exchanges,
        intervalMs: oiInterval,
        collectionsPerHour: Math.floor(MS_PER_HOUR / oiInterval),
      });
    } else {
      deps.logger.warn(
        "ClickHouse not available, futures data collectors disabled"
      );
    }
  },

  setupRoutes: (app, service) => {
    // WebSocket endpoint info
    app.get("/ws/market-data", (c) =>
      c.text(
        "WebSocket endpoint. Use ws:// protocol to connect.",
        HTTP_STATUS.OK
      )
    );

    // Get available tickers (currently subscribed)
    app.get("/api/market-data/tickers", (c) => {
      const tickers = service.getAvailableTickers();
      return c.json(createSuccessResponse(tickers));
    });

    // Get all available symbols from Binance
    app.get("/api/market-data/symbols", async (c) => {
      try {
        const connector = service.getConnector();
        if (!connector.getAllSymbols) {
          return c.json(
            {
              success: false,
              error: {
                code: "NOT_SUPPORTED",
                message: "Exchange connector does not support getAllSymbols",
              },
              timestamp: Date.now(),
            },
            HTTP_STATUS.NOT_IMPLEMENTED
          );
        }

        const symbols = await connector.getAllSymbols();
        return c.json(createSuccessResponse(symbols));
      } catch (error) {
        console.error("Failed to fetch all symbols:", error);
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to fetch symbols",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Subscribe to symbol(s)
    app.post("/api/market-data/subscribe", async (c) => {
      const body = await c.req.json<{
        symbol?: string;
        symbols?: string[];
      }>();

      let symbolsToSubscribe: string[] = [];
      if (body.symbols) {
        symbolsToSubscribe = body.symbols.map((s) => s.toUpperCase());
      } else if (body.symbol) {
        symbolsToSubscribe = [body.symbol.toUpperCase()];
      }

      if (symbolsToSubscribe.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "symbol or symbols array is required",
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (symbolsToSubscribe.length > 1) {
        await service.subscribeToSymbols(symbolsToSubscribe);
      } else {
        await service.subscribeToSymbol(symbolsToSubscribe[0]);
      }

      return c.json(
        createSuccessResponse({
          symbols: symbolsToSubscribe,
          count: symbolsToSubscribe.length,
        })
      );
    });

    // Get quote
    app.get("/api/market-data/quote/:symbol", (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const quote = service.getQuote(symbol);

      if (!quote) {
        return c.json(
          {
            success: false,
            error: {
              code: "QUOTE_NOT_FOUND",
              message: `Quote not found for ${symbol}`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      return c.json(createSuccessResponse(quote));
    });

    // Get order book
    app.get("/api/market-data/orderbook/:symbol", async (c) => {
      const { symbol } = c.req.param();
      const limit = Math.min(
        Number(c.req.query("limit") ?? "20"),
        DEFAULT_ORDERBOOK_LIMIT
      );

      const connector = service.getConnector();
      const orderBook = await connector.getOrderBook(
        symbol.toUpperCase(),
        limit
      );

      return c.json(createSuccessResponse(orderBook));
    });

    // Get recent trades
    app.get("/api/market-data/trades/:symbol", async (c) => {
      const { symbol } = c.req.param();
      const limit = Math.min(
        Number(c.req.query("limit") ?? "100"),
        DEFAULT_TRADES_LIMIT
      );

      const connector = service.getConnector();
      const trades = await connector.getRecentTrades(
        symbol.toUpperCase(),
        limit
      );

      return c.json(
        createSuccessResponse({
          symbol: symbol.toUpperCase(),
          trades,
        })
      );
    });

    // Get aggregated price
    app.get("/api/market-data/aggregated/:symbol", async (c) => {
      const { symbol } = c.req.param();
      const limit = Number(c.req.query("limit")) || DEFAULT_LIMIT;
      const upperSymbol = symbol.toUpperCase();

      // Try cache first
      if (cacheService) {
        const cacheKey = `aggregated:${upperSymbol}:${limit}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return c.json(createSuccessResponse(cached));
        }
      }

      const prices = await service.getAggregatedPrices([upperSymbol], limit);

      if (prices.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: "NO_DATA",
              message: `No aggregated data found for ${symbol}`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      // Cache for 5 seconds
      if (cacheService) {
        const cacheKey = `aggregated:${upperSymbol}:${limit}`;
        await cacheService.set(cacheKey, prices[0], CACHE_TTL_SECONDS);
      }

      return c.json(createSuccessResponse(prices[0]));
    });

    // Get arbitrage opportunities
    app.get("/api/market-data/arbitrage", async (c) => {
      const minSpread = Number(c.req.query("minSpread") ?? "0.1");
      const limit = Math.min(
        Number(c.req.query("limit") ?? String(DEFAULT_ARBIT_LIMIT_QUERY)),
        DEFAULT_ARBITRAGE_LIMIT
      );

      // Try cache first
      if (cacheService) {
        const cacheKey = `arbitrage:${minSpread}:${limit}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return c.json(createSuccessResponse(cached));
        }
      }

      const opportunities = await service.getArbitrageOpportunities(
        minSpread,
        limit
      );

      // Cache for 10 seconds (arbitrage changes frequently)
      if (cacheService) {
        const cacheKey = `arbitrage:${minSpread}:${limit}`;
        await cacheService.set(cacheKey, opportunities, 10);
      }

      return c.json(createSuccessResponse(opportunities));
    });

    // Get price comparison
    app.get("/api/market-data/comparison/:symbol", async (c) => {
      const { symbol } = c.req.param();
      const upperSymbol = symbol.toUpperCase();

      // Try cache first
      if (cacheService) {
        const cacheKey = `comparison:${upperSymbol}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return c.json(createSuccessResponse(cached));
        }
      }

      const prices = await service.getAggregatedPrices(
        [upperSymbol],
        DEFAULT_LIMIT
      );

      if (prices.length === 0) {
        return c.json(
          {
            success: false,
            error: {
              code: "NO_DATA",
              message: `No data found for ${symbol}`,
            },
            timestamp: Date.now(),
          },
          HTTP_STATUS.NOT_FOUND
        );
      }

      const price = prices[0];

      const result = {
        symbol: price.symbol,
        exchanges: {
          binance: {
            price: price.binance_price,
            volume: price.binance_volume,
            available: price.binance_price !== null,
          },
          bybit: {
            price: price.bybit_price,
            volume: price.bybit_volume,
            available: price.bybit_price !== null,
          },
          okx: {
            price: price.okx_price,
            volume: price.okx_volume,
            available: price.okx_price !== null,
          },
        },
        aggregated: {
          vwap: price.vwap,
          avgPrice: price.avg_price,
          totalVolume: price.total_volume,
        },
        spread: {
          percent: price.max_spread_percent,
          highExchange: price.max_spread_exchange_high,
          lowExchange: price.max_spread_exchange_low,
        },
        timestamp: price.timestamp,
      };

      // Cache for 5 seconds
      if (cacheService) {
        const cacheKey = `comparison:${upperSymbol}`;
        await cacheService.set(cacheKey, result, CACHE_TTL_SECONDS);
      }

      return c.json(createSuccessResponse(result));
    });

    // Get historical candles
    app.get("/api/market-data/candles/:symbol", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const timeframe = (c.req.query("timeframe") ?? "1h") as string;
      const limit = Number(
        c.req.query("limit") ?? String(DEFAULT_HISTORY_LIMIT)
      );

      const candles = await service.getCandles(symbol, timeframe, limit);

      return c.json(createSuccessResponse(candles));
    });

    // Get recent ticks
    app.get("/api/market-data/ticks/:symbol", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const limit = Number(
        c.req.query("limit") ?? String(DEFAULT_HISTORY_LIMIT)
      );

      const ticks = await service.getRecentTicks(symbol, limit);

      return c.json(createSuccessResponse(ticks));
    });

    // ===== Order Book Endpoints =====

    // Get current order book snapshot
    app.get("/api/market-data/:symbol/orderbook", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";

      if (!orderBookService) {
        return c.json(
          { success: false, error: "Order book service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const snapshot = await orderBookService.getOrderBook(symbol, exchange);
        const analysis = orderBookService.analyzeSnapshot(snapshot);

        return c.json(
          createSuccessResponse({
            snapshot,
            analysis,
          })
        );
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch order book",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Get historical order book data
    app.get("/api/market-data/:symbol/orderbook/history", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";
      const hours = Number.parseInt(c.req.query("hours") || "1", 10);

      if (!orderBookService) {
        return c.json(
          { success: false, error: "Order book service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const snapshots = await orderBookService.getHistoricalSnapshots(
          symbol,
          exchange,
          hours
        );

        return c.json(
          createSuccessResponse({
            symbol,
            exchange,
            hours,
            count: snapshots.length,
            snapshots: snapshots.map((s) => ({
              timestamp: s.timestamp,
              spread: s.spread,
              spreadPercent: s.spreadPercent,
              bidDepth1Pct: s.bidDepth1Pct,
              askDepth1Pct: s.askDepth1Pct,
              bidAskImbalance: s.bidAskImbalance,
            })),
          })
        );
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch history",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Get order book collector status
    app.get("/api/market-data/orderbook/status", (c) => {
      if (!orderBookCollector) {
        return c.json(
          { success: false, error: "Order book collector not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      const status = orderBookCollector.getStatus();
      return c.json(createSuccessResponse(status));
    });

    // Manually trigger order book collection for a symbol
    app.post("/api/market-data/:symbol/orderbook/collect", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";

      if (!orderBookService) {
        return c.json(
          { success: false, error: "Order book service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const snapshot = await orderBookService.getOrderBook(symbol, exchange);
        await orderBookService.saveSnapshot(snapshot);
        const analysis = orderBookService.analyzeSnapshot(snapshot);

        return c.json(
          createSuccessResponse({
            message: "Order book collected successfully",
            snapshot,
            analysis,
          })
        );
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to collect order book",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // ===== Funding Rate Endpoints =====

    // Get current funding rate
    app.get("/api/market-data/:symbol/funding-rate", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";

      if (!fundingRateService) {
        return c.json(
          { success: false, error: "Funding rate service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const data = await fundingRateService.getFundingRate(symbol, exchange);

        return c.json(createSuccessResponse(data));
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch funding rate",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Get funding rate across all exchanges
    app.get("/api/market-data/:symbol/funding-rate/all", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();

      if (!fundingRateService) {
        return c.json(
          { success: false, error: "Funding rate service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const dataMap =
          await fundingRateService.getAllExchangesFundingRate(symbol);
        const result = Object.fromEntries(dataMap);

        return c.json(createSuccessResponse(result));
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch funding rates",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Get historical funding rates
    app.get("/api/market-data/:symbol/funding-rate/history", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";
      const hours = Number.parseInt(c.req.query("hours") || "24", 10);

      if (!fundingRateService) {
        return c.json(
          { success: false, error: "Funding rate service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const history = await fundingRateService.getHistoricalFundingRates(
          symbol,
          exchange,
          hours
        );

        return c.json(
          createSuccessResponse({
            symbol,
            exchange,
            hours,
            count: history.length,
            data: history,
          })
        );
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch history",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // ===== Open Interest Endpoints =====

    // Get current open interest
    app.get("/api/market-data/:symbol/open-interest", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";

      if (!openInterestService) {
        return c.json(
          { success: false, error: "Open interest service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const data = await openInterestService.getOpenInterest(
          symbol,
          exchange
        );

        return c.json(createSuccessResponse(data));
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch open interest",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Get open interest across all exchanges
    app.get("/api/market-data/:symbol/open-interest/all", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();

      if (!openInterestService) {
        return c.json(
          { success: false, error: "Open interest service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const dataMap = await openInterestService.getAllExchangesOI(symbol);
        const result = Object.fromEntries(dataMap);

        return c.json(createSuccessResponse(result));
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch open interest",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    // Get historical open interest
    app.get("/api/market-data/:symbol/open-interest/history", async (c) => {
      const symbol = c.req.param("symbol").toUpperCase();
      const exchange = c.req.query("exchange")?.toLowerCase() || "binance";
      const hours = Number.parseInt(c.req.query("hours") || "24", 10);

      if (!openInterestService) {
        return c.json(
          { success: false, error: "Open interest service not initialized" },
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }

      try {
        const history = await openInterestService.getHistoricalOI(
          symbol,
          exchange,
          hours
        );

        return c.json(
          createSuccessResponse({
            symbol,
            exchange,
            hours,
            count: history.length,
            data: history,
          })
        );
      } catch (error) {
        const errorAny = error as { message?: string };
        return c.json(
          {
            success: false,
            error: errorAny.message || "Failed to fetch history",
          },
          HTTP_STATUS.INTERNAL_ERROR
        );
      }
    });

    /**
     * GET /api/market-data/cache/stats - Get cache statistics
     */
    app.get("/api/market-data/cache/stats", (c) => {
      if (!cacheService) {
        return c.json({
          success: false,
          error: {
            code: "CACHE_DISABLED",
            message: "Redis cache is not configured",
          },
          timestamp: Date.now(),
        });
      }

      const stats = cacheService.getStats();
      return c.json(
        createSuccessResponse({
          ...stats,
          enabled: true,
        })
      );
    });

    /**
     * POST /api/market-data/cache/flush - Flush cache
     */
    app.post("/api/market-data/cache/flush", async (c) => {
      if (!cacheService) {
        return c.json({
          success: false,
          error: {
            code: "CACHE_DISABLED",
            message: "Redis cache is not configured",
          },
          timestamp: Date.now(),
        });
      }

      await cacheService.flush();
      return c.json(
        createSuccessResponse({
          message: "Cache flushed successfully",
        })
      );
    });

    // Setup Macro Data routes (from macro-data service)
    setupMacroRoutes(app, service.clickhouseClient);

    // Setup On-Chain routes (from on-chain service)
    setupOnChainRoutes(app, service.clickhouseClient);
  },

  // WebSocket configuration
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
