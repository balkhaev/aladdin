/**
 * Market Data Service - Alternative Bootstrap Approach
 *
 * Note: This service requires custom WebSocket handling that isn't fully
 * compatible with the standard ServiceBootstrap due to complex WebSocket
 * upgrade logic and multiple exchange connections.
 *
 * This file demonstrates what the migration would look like, but the
 * original index.ts remains in use for WebSocket support.
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { ServerWebSocket } from "bun";
import { BinanceConnector } from "./connectors/binance";
import { BybitConnector } from "./connectors/bybit";
import { OKXConnector } from "./connectors/okx";
import { MarketDataServiceWrapper } from "./services/market-data-wrapper";
import "dotenv/config";

const DEFAULT_PORT = 3010;
const PORT = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
const DEFAULT_LIMIT = 1;
const DEFAULT_ORDERBOOK_LIMIT = 100;
const DEFAULT_TRADES_LIMIT = 1000;
const DEFAULT_ARBITRAGE_LIMIT = 100;

type WebSocketData = {
  clientId: string;
  subscribedSymbols: Set<string>;
  subscribedCandles: Set<string>;
  subscribedOrderBooks: Map<string, number>;
  subscribedTrades: Set<string>;
  orderBookIntervals: Map<string, Timer>;
};

// Secondary connectors for multi-exchange support
let bybitConnector: BybitConnector;
let okxConnector: OKXConnector;

await initializeService<MarketDataServiceWrapper, WebSocketData>({
  serviceName: "market-data",
  port: PORT,

  createService: (deps) => {
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
    // Connect secondary connectors
    await bybitConnector.connect();
    deps.logger.info("Bybit connector connected");

    await okxConnector.connect();
    deps.logger.info("OKX connector connected");

    // Subscribe to default symbols
    const defaultSymbols = (
      process.env.DEFAULT_SYMBOLS ?? "BTCUSDT,ETHUSDT,BNBUSDT"
    ).split(",");

    for (const symbol of defaultSymbols) {
      const trimmedSymbol = symbol.trim();
      await service.subscribeToSymbol(trimmedSymbol);
      await bybitConnector.subscribe(trimmedSymbol);
      await okxConnector.subscribe(trimmedSymbol);
    }

    deps.logger.info("Market Data Service fully initialized");
  },

  setupRoutes: (app, service) => {
    // All the same routes as in index.ts
    app.get("/api/market-data/tickers", (c) => {
      const tickers = service.getAvailableTickers();
      return c.json(createSuccessResponse(tickers));
    });

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

    // Add other routes...
  },

  dependencies: {
    nats: true,
    postgres: false,
    clickhouse: true,
  },
});
