import type { ClickHouseClient } from "@aladdin/shared/clickhouse";
import type { Logger } from "@aladdin/shared/logger";

// Constants
const ORDERBOOK_LIMIT = 100;
const TOP_LEVELS = 20;
const PRICE_RANGE_1PCT = 0.01;
const PRICE_RANGE_5PCT = 0.05;
const WALL_MULTIPLIER = 5;
const LIQUIDITY_SCORE_MAX = 10_000;
const SPREAD_EXCELLENT = 0.05;
const SPREAD_GOOD = 0.1;
const SPREAD_FAIR = 0.3;
const SPREAD_POOR_THRESHOLD = 0.5;
const LIQUIDITY_LOW_THRESHOLD = 30;
const IMBALANCE_BUY_THRESHOLD = 0.3;
const IMBALANCE_SELL_THRESHOLD = -0.3;
const CONFIDENCE_MULTIPLIER = 1.5;
const MAX_CONFIDENCE = 0.95;
const NEUTRAL_CONFIDENCE = 0.5;
const POOR_LIQUIDITY_CONFIDENCE = 0.3;

export type OrderBookLevel = {
  price: number;
  quantity: number;
  total: number; // Cumulative volume
};

export type OrderBookSnapshot = {
  symbol: string;
  exchange: string;
  timestamp: Date;

  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercent: number;

  bidDepth1Pct: number;
  askDepth1Pct: number;
  bidDepth5Pct: number;
  askDepth5Pct: number;

  bidAskImbalance: number;

  bidLevels: OrderBookLevel[];
  askLevels: OrderBookLevel[];
};

export type OrderBookAnalysis = {
  signal: "BUY" | "SELL" | "NEUTRAL";
  reason: string;
  confidence: number;
  details: {
    spreadQuality: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    liquidityScore: number; // 0-100
    hasLargeWalls: boolean;
  };
};

export class OrderBookService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Fetch order book from exchange
   */
  async getOrderBook(
    symbol: string,
    exchange: string
  ): Promise<OrderBookSnapshot> {
    this.logger.debug("Fetching order book", { symbol, exchange });

    // Get raw order book from exchange
    const rawOrderBook = await this.fetchFromExchange(symbol, exchange);

    // Calculate metrics
    const bestBid = rawOrderBook.bids[0]?.[0] ?? 0;
    const bestAsk = rawOrderBook.asks[0]?.[0] ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;

    const spread = bestAsk - bestBid;
    const spreadPercent = (spread / midPrice) * 100;

    // Process levels
    const bidLevels = this.processLevels(rawOrderBook.bids);
    const askLevels = this.processLevels(rawOrderBook.asks);

    // Calculate depth at different levels
    const bidDepth1Pct = this.calculateDepth(
      bidLevels,
      midPrice,
      PRICE_RANGE_1PCT,
      "bid"
    );
    const askDepth1Pct = this.calculateDepth(
      askLevels,
      midPrice,
      PRICE_RANGE_1PCT,
      "ask"
    );
    const bidDepth5Pct = this.calculateDepth(
      bidLevels,
      midPrice,
      PRICE_RANGE_5PCT,
      "bid"
    );
    const askDepth5Pct = this.calculateDepth(
      askLevels,
      midPrice,
      PRICE_RANGE_5PCT,
      "ask"
    );

    // Calculate imbalance
    const totalBidVolume = bidLevels.reduce(
      (sum, level) => sum + level.quantity,
      0
    );
    const totalAskVolume = askLevels.reduce(
      (sum, level) => sum + level.quantity,
      0
    );
    const bidAskImbalance =
      totalBidVolume + totalAskVolume > 0
        ? (totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume)
        : 0;

    return {
      symbol,
      exchange,
      timestamp: new Date(),
      bestBid,
      bestAsk,
      spread,
      spreadPercent,
      bidDepth1Pct,
      askDepth1Pct,
      bidDepth5Pct,
      askDepth5Pct,
      bidAskImbalance,
      bidLevels: bidLevels.slice(0, TOP_LEVELS),
      askLevels: askLevels.slice(0, TOP_LEVELS),
    };
  }

  /**
   * Fetch raw order book from exchange API
   */
  private fetchFromExchange(
    symbol: string,
    exchange: string
  ): Promise<{
    bids: [number, number][];
    asks: [number, number][];
  }> {
    switch (exchange.toLowerCase()) {
      case "binance":
        return this.fetchBinanceOrderBook(symbol);
      case "bybit":
        return this.fetchBybitOrderBook(symbol);
      case "okx":
        return this.fetchOKXOrderBook(symbol);
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  /**
   * Fetch Binance order book
   */
  private async fetchBinanceOrderBook(symbol: string): Promise<{
    bids: [number, number][];
    asks: [number, number][];
  }> {
    const url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${ORDERBOOK_LIMIT}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Binance API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      bids: data.bids.map((b: string[]) => [
        Number.parseFloat(b[0]),
        Number.parseFloat(b[1]),
      ]),
      asks: data.asks.map((a: string[]) => [
        Number.parseFloat(a[0]),
        Number.parseFloat(a[1]),
      ]),
    };
  }

  /**
   * Fetch Bybit order book
   */
  private async fetchBybitOrderBook(symbol: string): Promise<{
    bids: [number, number][];
    asks: [number, number][];
  }> {
    const url = `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${symbol}&limit=${ORDERBOOK_LIMIT}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Bybit API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }

    return {
      bids: data.result.b.map((b: string[]) => [
        Number.parseFloat(b[0]),
        Number.parseFloat(b[1]),
      ]),
      asks: data.result.a.map((a: string[]) => [
        Number.parseFloat(a[0]),
        Number.parseFloat(a[1]),
      ]),
    };
  }

  /**
   * Fetch OKX order book
   */
  private async fetchOKXOrderBook(symbol: string): Promise<{
    bids: [number, number][];
    asks: [number, number][];
  }> {
    // OKX uses format like BTC-USDT instead of BTCUSDT
    const okxSymbol = symbol
      .replace(/USDT$/, "-USDT")
      .replace(/BUSD$/, "-BUSD");
    const url = `https://www.okx.com/api/v5/market/books?instId=${okxSymbol}&sz=${ORDERBOOK_LIMIT}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `OKX API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.code !== "0") {
      throw new Error(`OKX API error: ${data.msg}`);
    }

    return {
      bids: data.data[0].bids.map((b: string[]) => [
        Number.parseFloat(b[0]),
        Number.parseFloat(b[1]),
      ]),
      asks: data.data[0].asks.map((a: string[]) => [
        Number.parseFloat(a[0]),
        Number.parseFloat(a[1]),
      ]),
    };
  }

  /**
   * Process raw levels into structured format
   */
  private processLevels(rawLevels: [number, number][]): OrderBookLevel[] {
    let cumulative = 0;

    return rawLevels.map(([price, quantity]) => {
      cumulative += quantity;
      return {
        price,
        quantity,
        total: cumulative,
      };
    });
  }

  /**
   * Calculate depth within price range
   */
  private calculateDepth(
    levels: OrderBookLevel[],
    midPrice: number,
    priceRange: number,
    side: "bid" | "ask"
  ): number {
    const minPrice = side === "bid" ? midPrice * (1 - priceRange) : midPrice;
    const maxPrice = side === "ask" ? midPrice * (1 + priceRange) : midPrice;

    return levels
      .filter((level) => {
        if (side === "bid")
          return level.price >= minPrice && level.price <= midPrice;
        return level.price <= maxPrice && level.price >= midPrice;
      })
      .reduce((sum, level) => sum + level.quantity * level.price, 0);
  }

  /**
   * Detect large walls (orders significantly larger than average)
   */
  private detectWalls(
    levels: OrderBookLevel[],
    multiplier = WALL_MULTIPLIER
  ): { price: number; quantity: number }[] {
    if (levels.length === 0) return [];

    const avgSize =
      levels.reduce((sum, level) => sum + level.quantity, 0) / levels.length;

    return levels
      .filter((level) => level.quantity > avgSize * multiplier)
      .map((level) => ({ price: level.price, quantity: level.quantity }));
  }

  /**
   * Save snapshot to ClickHouse
   */
  async saveSnapshot(snapshot: OrderBookSnapshot): Promise<void> {
    try {
      await this.clickhouse.insert("aladdin.order_book_snapshots", [
        {
          timestamp: Math.floor(snapshot.timestamp.getTime() / 1000), // Unix timestamp in seconds
          symbol: snapshot.symbol,
          exchange: snapshot.exchange,
          best_bid: snapshot.bestBid,
          best_ask: snapshot.bestAsk,
          bid_ask_spread: snapshot.spread,
          spread_percent: snapshot.spreadPercent,
          bid_depth_1pct: snapshot.bidDepth1Pct,
          ask_depth_1pct: snapshot.askDepth1Pct,
          bid_depth_5pct: snapshot.bidDepth5Pct,
          ask_depth_5pct: snapshot.askDepth5Pct,
          bid_ask_imbalance: snapshot.bidAskImbalance,
          bid_levels: JSON.stringify(snapshot.bidLevels),
          ask_levels: JSON.stringify(snapshot.askLevels),
        },
      ]);

      this.logger.debug("Saved order book snapshot", {
        symbol: snapshot.symbol,
        exchange: snapshot.exchange,
      });
    } catch (error) {
      this.logger.error("Failed to save order book snapshot", {
        symbol: snapshot.symbol,
        exchange: snapshot.exchange,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Analyze order book for trading signals
   */
  analyzeSnapshot(snapshot: OrderBookSnapshot): OrderBookAnalysis {
    const { spreadPercent, bidAskImbalance, bidLevels, askLevels } = snapshot;

    // Detect walls
    const bidWalls = this.detectWalls(bidLevels);
    const askWalls = this.detectWalls(askLevels);
    const hasLargeWalls = bidWalls.length > 0 || askWalls.length > 0;

    // Calculate liquidity score (0-100)
    const totalDepth = snapshot.bidDepth1Pct + snapshot.askDepth1Pct;
    const liquidityScore = Math.min(
      100,
      (totalDepth / LIQUIDITY_SCORE_MAX) * 100
    );

    // Determine spread quality
    let spreadQuality: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    if (spreadPercent < SPREAD_EXCELLENT) {
      spreadQuality = "EXCELLENT";
    } else if (spreadPercent < SPREAD_GOOD) {
      spreadQuality = "GOOD";
    } else if (spreadPercent < SPREAD_FAIR) {
      spreadQuality = "FAIR";
    } else {
      spreadQuality = "POOR";
    }

    // Signal logic:
    // 1. High bid imbalance + good spread = BUY signal
    // 2. High ask imbalance + good spread = SELL signal
    // 3. Wide spread or low liquidity = NEUTRAL

    if (
      spreadPercent > SPREAD_POOR_THRESHOLD ||
      liquidityScore < LIQUIDITY_LOW_THRESHOLD
    ) {
      return {
        signal: "NEUTRAL",
        reason: "Wide spread or low liquidity",
        confidence: POOR_LIQUIDITY_CONFIDENCE,
        details: {
          spreadQuality,
          liquidityScore,
          hasLargeWalls,
        },
      };
    }

    if (bidAskImbalance > IMBALANCE_BUY_THRESHOLD) {
      return {
        signal: "BUY",
        reason: `Strong bid pressure (${(bidAskImbalance * 100).toFixed(1)}% imbalance)`,
        confidence: Math.min(
          bidAskImbalance * CONFIDENCE_MULTIPLIER,
          MAX_CONFIDENCE
        ),
        details: {
          spreadQuality,
          liquidityScore,
          hasLargeWalls,
        },
      };
    }

    if (bidAskImbalance < IMBALANCE_SELL_THRESHOLD) {
      return {
        signal: "SELL",
        reason: `Strong ask pressure (${(Math.abs(bidAskImbalance) * 100).toFixed(1)}% imbalance)`,
        confidence: Math.min(
          Math.abs(bidAskImbalance) * CONFIDENCE_MULTIPLIER,
          MAX_CONFIDENCE
        ),
        details: {
          spreadQuality,
          liquidityScore,
          hasLargeWalls,
        },
      };
    }

    return {
      signal: "NEUTRAL",
      reason: "Balanced order book",
      confidence: NEUTRAL_CONFIDENCE,
      details: {
        spreadQuality,
        liquidityScore,
        hasLargeWalls,
      },
    };
  }

  /**
   * Get historical snapshots from ClickHouse
   */
  async getHistoricalSnapshots(
    symbol: string,
    exchange: string,
    hours: number
  ): Promise<OrderBookSnapshot[]> {
    const query = `
      SELECT
        timestamp,
        symbol,
        exchange,
        best_bid,
        best_ask,
        bid_ask_spread,
        spread_percent,
        bid_depth_1pct,
        ask_depth_1pct,
        bid_depth_5pct,
        ask_depth_5pct,
        bid_ask_imbalance,
        bid_levels,
        ask_levels
      FROM aladdin.order_book_snapshots
      WHERE symbol = {symbol:String}
        AND exchange = {exchange:String}
        AND timestamp >= now() - INTERVAL {hours:UInt16} HOUR
      ORDER BY timestamp DESC
      LIMIT 1000
    `;

    const rows = await this.clickhouse.query<{
      timestamp: string;
      symbol: string;
      exchange: string;
      best_bid: string;
      best_ask: string;
      bid_ask_spread: string;
      spread_percent: string;
      bid_depth_1pct: string;
      ask_depth_1pct: string;
      bid_depth_5pct: string;
      ask_depth_5pct: string;
      bid_ask_imbalance: string;
      bid_levels: string;
      ask_levels: string;
    }>(query, { symbol, exchange, hours });

    return rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      symbol: row.symbol,
      exchange: row.exchange,
      bestBid: Number.parseFloat(row.best_bid),
      bestAsk: Number.parseFloat(row.best_ask),
      spread: Number.parseFloat(row.bid_ask_spread),
      spreadPercent: Number.parseFloat(row.spread_percent),
      bidDepth1Pct: Number.parseFloat(row.bid_depth_1pct),
      askDepth1Pct: Number.parseFloat(row.ask_depth_1pct),
      bidDepth5Pct: Number.parseFloat(row.bid_depth_5pct),
      askDepth5Pct: Number.parseFloat(row.ask_depth_5pct),
      bidAskImbalance: Number.parseFloat(row.bid_ask_imbalance),
      bidLevels: JSON.parse(row.bid_levels),
      askLevels: JSON.parse(row.ask_levels),
    }));
  }
}
