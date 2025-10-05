/**
 * Smart Order Router (SOR)
 *
 * Автоматический выбор оптимальной биржи (или нескольких бирж) для исполнения ордера:
 * - Price comparison across exchanges
 * - Liquidity analysis
 * - Fee optimization
 * - Latency consideration
 * - Multi-venue splitting
 *
 * Based on:
 * - Market microstructure theory
 * - Transaction cost analysis
 * - Best execution principles (MiFID II, RegNMS)
 */

import type { Logger } from "@aladdin/logger";

export type Exchange = "binance" | "bybit" | "okx" | "kraken";

export type ExchangeQuote = {
  exchange: Exchange;
  price: number;
  availableLiquidity: number; // USD value
  estimatedFee: number; // % (e.g., 0.001 = 0.1%)
  latency: number; // milliseconds
  timestamp: number;
};

export type RoutingStrategy =
  | "best-price" // Cheapest execution price
  | "best-execution" // Optimal total cost (price + fees + slippage)
  | "fastest" // Lowest latency
  | "split" // Split across multiple venues
  | "smart"; // AI-driven (considers all factors)

export type SmartRouteParams = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  orderType: "MARKET" | "LIMIT";
  strategy?: RoutingStrategy;
  maxSlippage?: number; // Maximum acceptable slippage (%)
  urgency?: "low" | "medium" | "high";
  allowedExchanges?: Exchange[];
};

export type RouteRecommendation = {
  strategy: RoutingStrategy;
  routes: Array<{
    exchange: Exchange;
    quantity: number;
    estimatedPrice: number;
    estimatedFee: number;
    estimatedCost: number;
    share: number; // % of total order
  }>;
  totalEstimatedCost: number;
  totalEstimatedFee: number;
  averagePrice: number;
  expectedSlippage: number;
  confidence: number; // 0-1, confidence in recommendation
  reason: string;
  alternatives: Array<{
    strategy: RoutingStrategy;
    totalCost: number;
    reason: string;
  }>;
};

export type PriceComparison = {
  symbol: string;
  side: "BUY" | "SELL";
  quotes: ExchangeQuote[];
  bestPrice: {
    exchange: Exchange;
    price: number;
  };
  priceDifference: number; // % difference between best and worst
  timestamp: number;
};

// Constants
const PERCENT_MULTIPLIER = 100;
const MIN_LIQUIDITY_THRESHOLD = 1000; // $1000 minimum liquidity
const HIGH_CONFIDENCE = 0.8;
const MEDIUM_CONFIDENCE = 0.6;
const LOW_CONFIDENCE = 0.4;
const SPLIT_THRESHOLD = 0.02; // 2% price difference triggers split
const MAX_ROUTES = 3; // Maximum number of exchanges to split across
const LIQUIDITY_BUFFER = 1.2; // 20% buffer for liquidity
const MAX_LATENCY_MS = 200;
const SLIPPAGE_BASE = 0.001; // 0.1% base slippage
const FEE_NORMALIZATION = 0.01; // Normalize fees to 1%

export class SmartOrderRouter {
  constructor(private logger: Logger) {}

  /**
   * Find optimal routing for an order
   */
  findOptimalRoute(
    params: SmartRouteParams,
    quotes: ExchangeQuote[]
  ): RouteRecommendation {
    const {
      symbol,
      side,
      quantity,
      strategy = "smart",
      maxSlippage = 0.01,
      urgency = "medium",
      allowedExchanges,
    } = params;

    this.logger.info("Finding optimal route", {
      symbol,
      side,
      quantity,
      strategy,
    });

    // Filter allowed exchanges
    let filteredQuotes = allowedExchanges
      ? quotes.filter((q) => allowedExchanges.includes(q.exchange))
      : quotes;

    // Filter by liquidity
    filteredQuotes = filteredQuotes.filter(
      (q) => q.availableLiquidity >= MIN_LIQUIDITY_THRESHOLD
    );

    if (filteredQuotes.length === 0) {
      throw new Error("No exchanges with sufficient liquidity");
    }

    // Sort by best price for the side
    const sortedQuotes = this.sortQuotesByPrice(filteredQuotes, side);

    // Apply strategy
    let routes: RouteRecommendation["routes"];
    let confidence: number;
    let reason: string;

    switch (strategy) {
      case "best-price": {
        ({ routes, confidence, reason } = this.routeBestPrice(
          sortedQuotes,
          quantity
        ));
        break;
      }
      case "best-execution": {
        ({ routes, confidence, reason } = this.routeBestExecution({
          quotes: sortedQuotes,
          quantity,
          side,
          maxSlippage,
        }));
        break;
      }
      case "fastest": {
        ({ routes, confidence, reason } = this.routeFastest(
          sortedQuotes,
          quantity
        ));
        break;
      }
      case "split": {
        ({ routes, confidence, reason } = this.routeSplit(
          sortedQuotes,
          quantity
        ));
        break;
      }
      case "smart": {
        ({ routes, confidence, reason } = this.routeSmart({
          quotes: sortedQuotes,
          quantity,
          side,
          urgency,
        }));
        break;
      }
      default: {
        ({ routes, confidence, reason } = this.routeSmart({
          quotes: sortedQuotes,
          quantity,
          side,
          urgency,
        }));
      }
    }

    // Calculate totals
    const totalEstimatedCost = routes.reduce(
      (sum, r) => sum + r.estimatedCost,
      0
    );
    const totalEstimatedFee = routes.reduce(
      (sum, r) => sum + r.estimatedFee,
      0
    );
    const averagePrice =
      routes.reduce((sum, r) => sum + r.estimatedPrice * r.share, 0) /
      PERCENT_MULTIPLIER;

    // Calculate expected slippage
    const bestQuotePrice = sortedQuotes[0].price;
    const expectedSlippage =
      Math.abs(averagePrice - bestQuotePrice) / bestQuotePrice;

    // Generate alternatives
    const alternatives = this.generateAlternatives(
      sortedQuotes,
      quantity,
      strategy
    );

    this.logger.info("Route found", {
      strategy,
      routesCount: routes.length,
      totalCost: totalEstimatedCost,
      confidence,
    });

    return {
      strategy,
      routes,
      totalEstimatedCost,
      totalEstimatedFee,
      averagePrice,
      expectedSlippage,
      confidence,
      reason,
      alternatives,
    };
  }

  /**
   * Compare prices across exchanges
   */
  comparePrices(
    symbol: string,
    side: "BUY" | "SELL",
    quotes: ExchangeQuote[]
  ): PriceComparison {
    const sortedQuotes = this.sortQuotesByPrice(quotes, side);

    const bestPrice = {
      exchange: sortedQuotes[0].exchange,
      price: sortedQuotes[0].price,
    };

    const worstPrice = sortedQuotes.at(-1)?.price ?? 0;
    const priceDifference =
      Math.abs(worstPrice - bestPrice.price) / bestPrice.price;

    return {
      symbol,
      side,
      quotes: sortedQuotes,
      bestPrice,
      priceDifference,
      timestamp: Date.now(),
    };
  }

  /**
   * Route to exchange with best price
   */
  private routeBestPrice(
    quotes: ExchangeQuote[],
    quantity: number
  ): {
    routes: RouteRecommendation["routes"];
    confidence: number;
    reason: string;
  } {
    const bestQuote = quotes[0];

    // Check if liquidity is sufficient
    const requiredLiquidity = quantity * bestQuote.price * LIQUIDITY_BUFFER;
    if (bestQuote.availableLiquidity < requiredLiquidity) {
      return this.routeSplit(quotes, quantity);
    }

    const estimatedCost = quantity * bestQuote.price;
    const estimatedFee = estimatedCost * bestQuote.estimatedFee;

    return {
      routes: [
        {
          exchange: bestQuote.exchange,
          quantity,
          estimatedPrice: bestQuote.price,
          estimatedFee,
          estimatedCost: estimatedCost + estimatedFee,
          share: PERCENT_MULTIPLIER,
        },
      ],
      confidence: HIGH_CONFIDENCE,
      reason: `Best price on ${bestQuote.exchange}: $${bestQuote.price}`,
    };
  }

  /**
   * Route for best total execution (price + fees + slippage)
   */
  private routeBestExecution(params: {
    quotes: ExchangeQuote[];
    quantity: number;
    side: "BUY" | "SELL";
    maxSlippage: number;
  }): {
    routes: RouteRecommendation["routes"];
    confidence: number;
    reason: string;
  } {
    const { quotes, quantity, side, maxSlippage } = params;

    // Score each exchange by total execution cost
    const scored = quotes.map((quote) => {
      const price = quote.price;
      const fee = quote.estimatedFee;
      const estimatedSlippage = this.estimateSlippage(
        quantity * price,
        quote.availableLiquidity
      );

      const totalCost = price * (1 + fee + estimatedSlippage);
      const score = side === "BUY" ? totalCost : -totalCost;

      return { quote, score, estimatedSlippage };
    });

    // Sort by best score
    scored.sort((a, b) => a.score - b.score);

    const best = scored[0];

    // Check if slippage is acceptable
    if (best.estimatedSlippage > maxSlippage) {
      // Try splitting
      return this.routeSplit(quotes, quantity);
    }

    const estimatedCost = quantity * best.quote.price;
    const estimatedFee = estimatedCost * best.quote.estimatedFee;

    return {
      routes: [
        {
          exchange: best.quote.exchange,
          quantity,
          estimatedPrice: best.quote.price,
          estimatedFee,
          estimatedCost: estimatedCost + estimatedFee,
          share: PERCENT_MULTIPLIER,
        },
      ],
      confidence:
        best.estimatedSlippage < maxSlippage
          ? HIGH_CONFIDENCE
          : MEDIUM_CONFIDENCE,
      reason: `Best execution on ${best.quote.exchange} (total cost optimized)`,
    };
  }

  /**
   * Route to fastest exchange (lowest latency)
   */
  private routeFastest(
    quotes: ExchangeQuote[],
    quantity: number
  ): {
    routes: RouteRecommendation["routes"];
    confidence: number;
    reason: string;
  } {
    // Sort by latency
    const sortedByLatency = [...quotes].sort((a, b) => a.latency - b.latency);
    const fastest = sortedByLatency[0];

    // Check liquidity
    const requiredLiquidity = quantity * fastest.price * LIQUIDITY_BUFFER;
    if (fastest.availableLiquidity < requiredLiquidity) {
      // Find next fastest with sufficient liquidity
      const alternative = sortedByLatency.find(
        (q) => q.availableLiquidity >= requiredLiquidity
      );
      if (!alternative) {
        return this.routeSplit(quotes, quantity);
      }
      const estimatedCost = quantity * alternative.price;
      const estimatedFee = estimatedCost * alternative.estimatedFee;

      return {
        routes: [
          {
            exchange: alternative.exchange,
            quantity,
            estimatedPrice: alternative.price,
            estimatedFee,
            estimatedCost: estimatedCost + estimatedFee,
            share: PERCENT_MULTIPLIER,
          },
        ],
        confidence: MEDIUM_CONFIDENCE,
        reason: `Fastest with liquidity: ${alternative.exchange} (${alternative.latency}ms)`,
      };
    }

    const estimatedCost = quantity * fastest.price;
    const estimatedFee = estimatedCost * fastest.estimatedFee;

    return {
      routes: [
        {
          exchange: fastest.exchange,
          quantity,
          estimatedPrice: fastest.price,
          estimatedFee,
          estimatedCost: estimatedCost + estimatedFee,
          share: PERCENT_MULTIPLIER,
        },
      ],
      confidence: HIGH_CONFIDENCE,
      reason: `Fastest execution: ${fastest.exchange} (${fastest.latency}ms latency)`,
    };
  }

  /**
   * Split order across multiple exchanges
   */
  private routeSplit(
    quotes: ExchangeQuote[],
    quantity: number
  ): {
    routes: RouteRecommendation["routes"];
    confidence: number;
    reason: string;
  } {
    const routes: RouteRecommendation["routes"] = [];
    let remainingQuantity = quantity;

    // Take top exchanges by price
    const topExchanges = quotes.slice(0, Math.min(MAX_ROUTES, quotes.length));

    for (const quote of topExchanges) {
      if (remainingQuantity <= 0) break;

      // Calculate how much we can fill on this exchange
      const maxQuantityHere =
        quote.availableLiquidity / quote.price / LIQUIDITY_BUFFER;
      const quantityHere = Math.min(remainingQuantity, maxQuantityHere);

      if (quantityHere > 0) {
        const estimatedCost = quantityHere * quote.price;
        const estimatedFee = estimatedCost * quote.estimatedFee;

        routes.push({
          exchange: quote.exchange,
          quantity: quantityHere,
          estimatedPrice: quote.price,
          estimatedFee,
          estimatedCost: estimatedCost + estimatedFee,
          share: (quantityHere / quantity) * PERCENT_MULTIPLIER,
        });

        remainingQuantity -= quantityHere;
      }
    }

    if (remainingQuantity > 0) {
      this.logger.warn("Could not fill entire order", {
        remaining: remainingQuantity,
        total: quantity,
      });
    }

    return {
      routes,
      confidence: routes.length > 1 ? MEDIUM_CONFIDENCE : LOW_CONFIDENCE,
      reason: `Split across ${routes.length} exchanges for better liquidity`,
    };
  }

  /**
   * Smart routing considering all factors
   */
  private routeSmart(params: {
    quotes: ExchangeQuote[];
    quantity: number;
    side: "BUY" | "SELL";
    urgency: "low" | "medium" | "high";
  }): {
    routes: RouteRecommendation["routes"];
    confidence: number;
    reason: string;
  } {
    const { quotes, quantity, side, urgency } = params;
    // Calculate composite score for each exchange
    const scored = quotes.map((quote) => {
      const priceScore = this.calculatePriceScore(quote, quotes, side);
      const feeScore = 1 - quote.estimatedFee / FEE_NORMALIZATION;
      const latencyScore = this.calculateLatencyScore(quote.latency);
      const liquidityScore = this.calculateLiquidityScore(
        quote.availableLiquidity,
        quantity * quote.price
      );

      // Weight based on urgency
      const weights = this.getWeights(urgency);
      const compositeScore =
        priceScore * weights.price +
        feeScore * weights.fee +
        latencyScore * weights.latency +
        liquidityScore * weights.liquidity;

      return { quote, score: compositeScore };
    });

    // Sort by composite score
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    // Check if we should split
    const requiredLiquidity = quantity * best.quote.price * LIQUIDITY_BUFFER;
    const shouldSplit =
      best.quote.availableLiquidity < requiredLiquidity ||
      this.shouldSplitByPrice(quotes, side);

    if (shouldSplit) {
      return this.routeSplit(quotes, quantity);
    }

    const estimatedCost = quantity * best.quote.price;
    const estimatedFee = estimatedCost * best.quote.estimatedFee;

    return {
      routes: [
        {
          exchange: best.quote.exchange,
          quantity,
          estimatedPrice: best.quote.price,
          estimatedFee,
          estimatedCost: estimatedCost + estimatedFee,
          share: PERCENT_MULTIPLIER,
        },
      ],
      confidence: HIGH_CONFIDENCE,
      reason: `Smart routing selected ${best.quote.exchange} (best composite score)`,
    };
  }

  /**
   * Sort quotes by price (best first)
   */
  private sortQuotesByPrice(
    quotes: ExchangeQuote[],
    side: "BUY" | "SELL"
  ): ExchangeQuote[] {
    return [...quotes].sort((a, b) => {
      // For BUY: lower price is better
      // For SELL: higher price is better
      return side === "BUY" ? a.price - b.price : b.price - a.price;
    });
  }

  /**
   * Estimate slippage based on order size and liquidity
   */
  private estimateSlippage(
    orderValue: number,
    availableLiquidity: number
  ): number {
    const participationRate = orderValue / availableLiquidity;
    // Simple square-root model
    return Math.sqrt(participationRate) * SLIPPAGE_BASE;
  }

  /**
   * Calculate price score (0-1, higher is better)
   */
  private calculatePriceScore(
    quote: ExchangeQuote,
    allQuotes: ExchangeQuote[],
    side: "BUY" | "SELL"
  ): number {
    const prices = allQuotes.map((q) => q.price);
    const bestPrice =
      side === "BUY" ? Math.min(...prices) : Math.max(...prices);
    const worstPrice =
      side === "BUY" ? Math.max(...prices) : Math.min(...prices);

    if (bestPrice === worstPrice) return 1;

    const normalized = (quote.price - worstPrice) / (bestPrice - worstPrice);
    return side === "BUY" ? 1 - normalized : normalized;
  }

  /**
   * Calculate latency score (0-1, higher is better)
   */
  private calculateLatencyScore(latency: number): number {
    // Normalize latency (assuming 0-200ms range)
    return Math.max(0, 1 - latency / MAX_LATENCY_MS);
  }

  /**
   * Calculate liquidity score (0-1, higher is better)
   */
  private calculateLiquidityScore(
    availableLiquidity: number,
    requiredLiquidity: number
  ): number {
    const ratio = availableLiquidity / requiredLiquidity;
    return Math.min(1, ratio / LIQUIDITY_BUFFER);
  }

  /**
   * Get weights based on urgency
   */
  private getWeights(urgency: "low" | "medium" | "high"): {
    price: number;
    fee: number;
    latency: number;
    liquidity: number;
  } {
    switch (urgency) {
      case "low": {
        return { price: 0.5, fee: 0.3, latency: 0.1, liquidity: 0.1 };
      }
      case "medium": {
        return { price: 0.4, fee: 0.3, latency: 0.2, liquidity: 0.1 };
      }
      case "high": {
        return { price: 0.3, fee: 0.2, latency: 0.4, liquidity: 0.1 };
      }
      default: {
        return { price: 0.4, fee: 0.3, latency: 0.2, liquidity: 0.1 };
      }
    }
  }

  /**
   * Check if order should be split by price difference
   */
  private shouldSplitByPrice(
    quotes: ExchangeQuote[],
    side: "BUY" | "SELL"
  ): boolean {
    if (quotes.length < 2) return false;

    const sorted = this.sortQuotesByPrice(quotes, side);
    const bestPrice = sorted[0].price;
    const secondBestPrice = sorted[1].price;

    const priceDiff = Math.abs(secondBestPrice - bestPrice) / bestPrice;
    return priceDiff < SPLIT_THRESHOLD; // If prices are close, consider splitting
  }

  /**
   * Generate alternative routing strategies
   */
  private generateAlternatives(
    quotes: ExchangeQuote[],
    quantity: number,
    currentStrategy: RoutingStrategy
  ): RouteRecommendation["alternatives"] {
    const alternatives: RouteRecommendation["alternatives"] = [];

    // Best price alternative
    if (currentStrategy !== "best-price") {
      const bestPriceRoute = this.routeBestPrice(quotes, quantity);
      const totalCost = bestPriceRoute.routes.reduce(
        (sum, r) => sum + r.estimatedCost,
        0
      );
      alternatives.push({
        strategy: "best-price",
        totalCost,
        reason: bestPriceRoute.reason,
      });
    }

    // Split alternative
    if (currentStrategy !== "split" && quotes.length > 1) {
      const splitRoute = this.routeSplit(quotes, quantity);
      const totalCost = splitRoute.routes.reduce(
        (sum, r) => sum + r.estimatedCost,
        0
      );
      alternatives.push({
        strategy: "split",
        totalCost,
        reason: splitRoute.reason,
      });
    }

    return alternatives;
  }
}
