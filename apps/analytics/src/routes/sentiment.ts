/**
 * Sentiment Analysis Routes
 */

import type { CacheService } from "@aladdin/shared/cache";
import { InternalServerError, ValidationError } from "@aladdin/shared/errors";
import type { Hono } from "hono";
import { CACHE_TTL, SERVICES } from "../config";
import type { CombinedSentimentService } from "../services/sentiment/combined-sentiment";
import type { SentimentAnalysisService } from "../services/sentiment/sentiment-analysis";

export function setupSentimentRoutes(
  app: Hono,
  sentimentService?: SentimentAnalysisService,
  combinedSentimentService?: CombinedSentimentService,
  cache?: CacheService
): void {
  /**
   * GET /api/analytics/sentiment/batch
   * Get sentiment for multiple symbols
   * ВАЖНО: этот роут должен быть ПЕРЕД /api/analytics/sentiment/:symbol
   */
  app.get("/api/analytics/sentiment/batch", async (c) => {
    const symbolsParam = c.req.query("symbols");

    if (!symbolsParam) {
      throw new ValidationError("symbols query parameter is required");
    }

    const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());

    // Check if sentiment service is initialized
    if (!sentimentService) {
      throw new InternalServerError(
        "Sentiment analysis service not initialized"
      );
    }

    // Calculate sentiment for all symbols in parallel
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        // Try cache first
        if (cache) {
          const cacheKey = `sentiment:${symbol}`;
          const cached = await cache.get(cacheKey);
          if (cached) {
            return { symbol, ...cached, cached: true };
          }
        }

        const sentiment = await sentimentService.getCompositeSentiment(symbol);

        // Cache for configured TTL
        if (cache) {
          const cacheKey = `sentiment:${symbol}`;
          await cache.set(cacheKey, sentiment, CACHE_TTL.MARKET_OVERVIEW);
        }

        return sentiment;
      })
    );

    // Format results
    const sentiments = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);

    return c.json({
      success: true,
      data: sentiments,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: Date.now(),
    });
  });

  /**
   * GET /api/analytics/sentiment/:symbol
   * Get composite sentiment analysis for a single symbol
   */
  app.get("/api/analytics/sentiment/:symbol", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();

    // Check if sentiment service is initialized
    if (!sentimentService) {
      throw new InternalServerError(
        "Sentiment analysis service not initialized"
      );
    }

    // Try cache first
    if (cache) {
      const cacheKey = `sentiment:${symbol}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json({
          success: true,
          data: cached,
          cached: true,
          timestamp: Date.now(),
        });
      }
    }

    // Calculate sentiment
    const sentiment = await sentimentService.getCompositeSentiment(symbol);

    // Cache for configured TTL
    if (cache) {
      const cacheKey = `sentiment:${symbol}`;
      await cache.set(cacheKey, sentiment, CACHE_TTL.MARKET_OVERVIEW);
    }

    return c.json({
      success: true,
      data: sentiment,
      timestamp: Date.now(),
    });
  });

  /**
   * GET /api/analytics/social-sentiment/:symbol
   * Get social sentiment (Telegram + Twitter + Reddit) for a symbol
   * Note: This is a proxy to scraper service
   */
  app.get("/api/analytics/social-sentiment/:symbol", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();

    // Try cache first
    if (cache) {
      const cacheKey = `social-sentiment:${symbol}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json({
          success: true,
          data: cached,
          cached: true,
          timestamp: Date.now(),
        });
      }
    }

    // Fetch from scraper service
    try {
      const response = await fetch(
        `${SERVICES.SCRAPER_URL}/api/social/sentiment/${symbol}`
      );

      if (!response.ok) {
        throw new Error(
          `Social integrations API error: ${response.statusText}`
        );
      }

      const result = await response.json();

      // Cache for configured TTL
      if (cache && result.success) {
        const cacheKey = `social-sentiment:${symbol}`;
        await cache.set(cacheKey, result.data, CACHE_TTL.MARKET_OVERVIEW);
      }

      return c.json(result);
    } catch {
      // Return empty/neutral sentiment on error
      return c.json({
        success: true,
        data: {
          symbol,
          overall: 0,
          telegram: { score: 0, bullish: 0, bearish: 0, signals: 0 },
          twitter: {
            score: 0,
            positive: 0,
            negative: 0,
            neutral: 0,
            tweets: 0,
          },
          confidence: 0,
          timestamp: new Date().toISOString(),
        },
        timestamp: Date.now(),
      });
    }
  });

  /**
   * GET /api/analytics/sentiment/batch/combined
   * Get combined sentiment for multiple symbols
   */
  app.get("/api/analytics/sentiment/batch/combined", async (c) => {
    const symbolsParam = c.req.query("symbols");

    if (!symbolsParam) {
      throw new ValidationError("symbols query parameter is required");
    }

    const symbols = symbolsParam.split(",").map((s) => s.trim().toUpperCase());

    // Check if combined sentiment service is initialized
    if (!combinedSentimentService) {
      throw new InternalServerError(
        "Combined sentiment service not initialized"
      );
    }

    // Calculate sentiment for all symbols in parallel
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        // Try cache first
        if (cache) {
          const cacheKey = `combined-sentiment:${symbol}`;
          const cached = await cache.get(cacheKey);
          if (cached) {
            return { symbol, ...cached, cached: true };
          }
        }

        const sentiment =
          await combinedSentimentService.getCombinedSentiment(symbol);

        // Cache for configured TTL
        if (cache) {
          const cacheKey = `combined-sentiment:${symbol}`;
          await cache.set(cacheKey, sentiment, CACHE_TTL.COMBINED_SENTIMENT);
        }

        return sentiment;
      })
    );

    // Format results
    const sentiments = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason);

    return c.json({
      success: true,
      data: sentiments,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: Date.now(),
    });
  });

  /**
   * GET /api/analytics/sentiment/:symbol/combined
   * Get combined sentiment analysis (Analytics + Futures + Order Book)
   */
  app.get("/api/analytics/sentiment/:symbol/combined", async (c) => {
    const symbol = c.req.param("symbol").toUpperCase();

    // Check if combined sentiment service is initialized
    if (!combinedSentimentService) {
      throw new InternalServerError(
        "Combined sentiment service not initialized"
      );
    }

    // Try cache first
    if (cache) {
      const cacheKey = `combined-sentiment:${symbol}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return c.json({
          success: true,
          data: cached,
          cached: true,
          timestamp: Date.now(),
        });
      }
    }

    // Calculate combined sentiment
    const sentiment =
      await combinedSentimentService.getCombinedSentiment(symbol);

    // Cache for configured TTL
    if (cache) {
      const cacheKey = `combined-sentiment:${symbol}`;
      await cache.set(cacheKey, sentiment, CACHE_TTL.COMBINED_SENTIMENT);
    }

    return c.json({
      success: true,
      data: sentiment,
      timestamp: Date.now(),
    });
  });

  /**
   * POST /api/analytics/sentiment/analyze-batch
   * Analyze sentiment for multiple symbols (backward compatibility)
   */
  app.post("/api/analytics/sentiment/analyze-batch", async (c) => {
    const body = await c.req.json();
    const symbols = body.symbols as string[];

    if (!(symbols && Array.isArray(symbols))) {
      throw new ValidationError("symbols array is required in request body");
    }

    if (symbols.length === 0) {
      throw new ValidationError("symbols array cannot be empty");
    }

    // Check if sentiment service is initialized
    if (!sentimentService) {
      throw new InternalServerError(
        "Sentiment analysis service not initialized"
      );
    }

    // Calculate sentiment for all symbols in parallel
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        // Try cache first
        if (cache) {
          const cacheKey = `sentiment:${symbol}`;
          const cached = await cache.get(cacheKey);
          if (cached) {
            return { symbol, ...cached, cached: true };
          }
        }

        const sentiment = await sentimentService.getCompositeSentiment(symbol);

        // Cache for configured TTL
        if (cache) {
          const cacheKey = `sentiment:${symbol}`;
          await cache.set(cacheKey, sentiment, CACHE_TTL.MARKET_OVERVIEW);
        }

        return { symbol, ...sentiment };
      })
    );

    const sentiments = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);

    return c.json({
      success: true,
      data: sentiments,
      timestamp: Date.now(),
    });
  });
}
