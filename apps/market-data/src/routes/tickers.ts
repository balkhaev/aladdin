/**
 * Tickers and Subscriptions Routes
 */

import { createSuccessResponse, HTTP_STATUS } from "@aladdin/shared/http";
import { subscribeSymbolsBodySchema } from "@aladdin/shared/schemas/market-data";
import type { Hono } from "hono";
import type { MarketDataServiceWrapper } from "../services/market-data-wrapper";

export function setupTickersRoutes(
  app: Hono,
  service: MarketDataServiceWrapper
): void {
  /**
   * GET /api/market-data/tickers - Get available tickers
   */
  app.get("/api/market-data/tickers", (c) => {
    const tickers = service.getAvailableTickers();
    return c.json(createSuccessResponse(tickers));
  });

  /**
   * GET /api/market-data/symbols - Get all available symbols from Binance
   */
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

  /**
   * POST /api/market-data/subscribe - Subscribe to symbol(s)
   */
  app.post("/api/market-data/subscribe", async (c) => {
    const body = await c.req.json();
    const validated = subscribeSymbolsBodySchema.safeParse(body);

    if (!validated.success) {
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

    let symbolsToSubscribe: string[] = [];
    if (validated.data.symbols) {
      symbolsToSubscribe = validated.data.symbols.map((s) => s.toUpperCase());
    } else if (validated.data.symbol) {
      symbolsToSubscribe = [validated.data.symbol.toUpperCase()];
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
}
