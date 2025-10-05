import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";

// Constants
const OI_CHANGE_THRESHOLD = 10; // 10% change is significant
const PRICE_CHANGE_THRESHOLD = 3; // 3% price change is significant
const PERCENTAGE_MULTIPLIER = 100;
const OI_HISTORY_LIMIT = 1000;
const HOURS_TO_COMPARE = 25;
const HOURS_TOLERANCE = 23;

// Regex patterns for symbol conversion
const USDT_SUFFIX_REGEX = /USDT$/;
const BUSD_SUFFIX_REGEX = /BUSD$/;
const USDT_REPLACEMENT = "-USDT-SWAP";
const BUSD_REPLACEMENT = "-BUSD-SWAP";

export type OpenInterestData = {
  symbol: string;
  exchange: string;
  timestamp: Date;

  openInterest: number; // Total OI in USD
  openInterestChange24h: number; // Absolute change
  openInterestChangePct: number; // Percentage change

  price: number; // Current futures price
  priceChange24h: number; // Price change %

  volume24h: number; // 24h volume

  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  explanation: string;
};

export class OpenInterestService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Fetch Open Interest from exchange
   */
  async getOpenInterest(
    symbol: string,
    exchange: string
  ): Promise<OpenInterestData> {
    this.logger.debug("Fetching open interest", { symbol, exchange });

    const rawData = await this.fetchFromExchange(symbol, exchange);

    // Get 24h ago data for comparison
    const historical = await this.get24hAgoData(symbol, exchange);

    // Calculate changes
    const oiChange24h = historical
      ? rawData.openInterest - historical.openInterest
      : 0;
    const oiChangePct =
      historical && historical.openInterest !== 0
        ? (oiChange24h / historical.openInterest) * PERCENTAGE_MULTIPLIER
        : 0;
    const priceChange24h =
      historical && historical.price !== 0
        ? ((rawData.price - historical.price) / historical.price) *
          PERCENTAGE_MULTIPLIER
        : 0;

    // Analyze signal based on OI + Price
    const { signal, explanation } = this.analyzeOI(oiChangePct, priceChange24h);

    return {
      symbol,
      exchange,
      timestamp: new Date(),
      openInterest: rawData.openInterest,
      openInterestChange24h: oiChange24h,
      openInterestChangePct: oiChangePct,
      price: rawData.price,
      priceChange24h,
      volume24h: rawData.volume24h,
      signal,
      explanation,
    };
  }

  /**
   * Fetch from specific exchange
   */
  private fetchFromExchange(
    symbol: string,
    exchange: string
  ): Promise<{
    openInterest: number;
    price: number;
    volume24h: number;
  }> {
    const exchangeLower = exchange.toLowerCase();

    if (exchangeLower === "binance") {
      return this.fetchBinanceOI(symbol);
    }

    if (exchangeLower === "bybit") {
      return this.fetchBybitOI(symbol);
    }

    if (exchangeLower === "okx") {
      return this.fetchOKXOI(symbol);
    }

    throw new Error(`Unsupported exchange: ${exchange}`);
  }

  /**
   * Fetch Binance Open Interest
   */
  private async fetchBinanceOI(symbol: string): Promise<{
    openInterest: number;
    price: number;
    volume24h: number;
  }> {
    // Binance Futures API
    const [oiResponse, tickerResponse] = await Promise.all([
      fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
      fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`),
    ]);

    if (!oiResponse.ok) {
      throw new Error(
        `Binance Futures API error: ${oiResponse.status} ${oiResponse.statusText}`
      );
    }

    if (!tickerResponse.ok) {
      throw new Error(
        `Binance Futures Ticker API error: ${tickerResponse.status} ${tickerResponse.statusText}`
      );
    }

    const oiData = await oiResponse.json();
    const tickerData = await tickerResponse.json();

    // OI is in contracts, convert to USD
    const price = Number.parseFloat(tickerData.lastPrice);
    const oiInContracts = Number.parseFloat(oiData.openInterest);
    const openInterestUSD = oiInContracts * price;

    return {
      openInterest: openInterestUSD,
      price,
      volume24h: Number.parseFloat(tickerData.quoteVolume), // Volume in USD
    };
  }

  /**
   * Fetch Bybit Open Interest
   */
  private async fetchBybitOI(symbol: string): Promise<{
    openInterest: number;
    price: number;
    volume24h: number;
  }> {
    const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Bybit API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.retCode !== 0 || !data.result?.list?.[0]) {
      throw new Error(`Bybit API error: ${data.retMsg || "No data"}`);
    }

    const ticker = data.result.list[0];

    // OI is in contracts, convert to USD
    const price = Number.parseFloat(ticker.lastPrice);
    const oiInContracts = Number.parseFloat(ticker.openInterest);
    const openInterestUSD = oiInContracts * price;

    return {
      openInterest: openInterestUSD,
      price,
      volume24h: Number.parseFloat(ticker.turnover24h), // Volume in USD
    };
  }

  /**
   * Fetch OKX Open Interest
   */
  private async fetchOKXOI(symbol: string): Promise<{
    openInterest: number;
    price: number;
    volume24h: number;
  }> {
    // OKX uses format like BTC-USDT-SWAP
    const okxSymbol = symbol
      .replace(USDT_SUFFIX_REGEX, USDT_REPLACEMENT)
      .replace(BUSD_SUFFIX_REGEX, BUSD_REPLACEMENT);

    const [oiResponse, tickerResponse] = await Promise.all([
      fetch(
        `https://www.okx.com/api/v5/public/open-interest?instId=${okxSymbol}`
      ),
      fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`),
    ]);

    if (!oiResponse.ok) {
      throw new Error(
        `OKX API error: ${oiResponse.status} ${oiResponse.statusText}`
      );
    }

    if (!tickerResponse.ok) {
      throw new Error(
        `OKX Ticker API error: ${tickerResponse.status} ${tickerResponse.statusText}`
      );
    }

    const oiData = await oiResponse.json();
    const tickerData = await tickerResponse.json();

    const oiHasData = oiData.code === "0" && oiData.data?.[0];
    const tickerHasData = tickerData.code === "0" && tickerData.data?.[0];

    if (!oiHasData) {
      const errorMsg = oiData.msg || "No OI data";
      throw new Error(`OKX API error: ${errorMsg}`);
    }

    if (!tickerHasData) {
      const errorMsg = tickerData.msg || "No ticker data";
      throw new Error(`OKX API error: ${errorMsg}`);
    }

    const oi = oiData.data[0];
    const ticker = tickerData.data[0];

    // OI is in contracts, convert to USD
    const price = Number.parseFloat(ticker.last);
    const oiInContracts = Number.parseFloat(oi.oi);
    const openInterestUSD = oiInContracts * price;

    return {
      openInterest: openInterestUSD,
      price,
      volume24h: Number.parseFloat(ticker.vol24h) * price, // Convert to USD
    };
  }

  /**
   * Get 24h ago data for comparison
   */
  private async get24hAgoData(
    symbol: string,
    exchange: string
  ): Promise<{ openInterest: number; price: number } | null> {
    try {
      const query = `
        SELECT open_interest, price
        FROM aladdin.open_interest
        WHERE symbol = {symbol:String}
          AND exchange = {exchange:String}
          AND timestamp >= now() - INTERVAL ${HOURS_TO_COMPARE} HOUR
          AND timestamp <= now() - INTERVAL ${HOURS_TOLERANCE} HOUR
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const rows = await this.clickhouse.query<{
        open_interest: string;
        price: string;
      }>(query, { symbol, exchange });

      if (rows.length > 0) {
        return {
          openInterest: Number.parseFloat(rows[0].open_interest),
          price: Number.parseFloat(rows[0].price),
        };
      }

      return null;
    } catch (error) {
      this.logger.error("Failed to get historical OI", {
        symbol,
        exchange,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Analyze OI + Price correlation
   *
   * Logic:
   * OI ↑ + Price ↑ = BULLISH (new longs entering)
   * OI ↑ + Price ↓ = BEARISH (new shorts entering)
   * OI ↓ + Price ↑ = NEUTRAL (shorts closing - squeeze)
   * OI ↓ + Price ↓ = NEUTRAL (longs closing - liquidations)
   */
  private analyzeOI(
    oiChangePct: number,
    priceChangePct: number
  ): {
    signal: "BULLISH" | "BEARISH" | "NEUTRAL";
    explanation: string;
  } {
    const oiIncreasing = oiChangePct > OI_CHANGE_THRESHOLD;
    const oiDecreasing = oiChangePct < -OI_CHANGE_THRESHOLD;
    const priceUp = priceChangePct > PRICE_CHANGE_THRESHOLD;
    const priceDown = priceChangePct < -PRICE_CHANGE_THRESHOLD;

    if (oiIncreasing && priceUp) {
      return {
        signal: "BULLISH",
        explanation: `OI +${oiChangePct.toFixed(1)}%, Price +${priceChangePct.toFixed(1)}% - New longs entering market`,
      };
    }

    if (oiIncreasing && priceDown) {
      return {
        signal: "BEARISH",
        explanation: `OI +${oiChangePct.toFixed(1)}%, Price ${priceChangePct.toFixed(1)}% - New shorts dominating`,
      };
    }

    if (oiDecreasing && priceUp) {
      return {
        signal: "NEUTRAL",
        explanation: `OI ${oiChangePct.toFixed(1)}%, Price +${priceChangePct.toFixed(1)}% - Shorts closing (squeeze)`,
      };
    }

    if (oiDecreasing && priceDown) {
      return {
        signal: "NEUTRAL",
        explanation: `OI ${oiChangePct.toFixed(1)}%, Price ${priceChangePct.toFixed(1)}% - Longs closing (liquidations)`,
      };
    }

    return {
      signal: "NEUTRAL",
      explanation: `OI ${oiChangePct >= 0 ? "+" : ""}${oiChangePct.toFixed(1)}%, Price ${priceChangePct >= 0 ? "+" : ""}${priceChangePct.toFixed(1)}% - Neutral market`,
    };
  }

  /**
   * Save Open Interest to ClickHouse
   */
  async saveOpenInterest(data: OpenInterestData): Promise<void> {
    try {
      await this.clickhouse.insert("aladdin.open_interest", [
        {
          timestamp: data.timestamp.getTime(),
          symbol: data.symbol,
          exchange: data.exchange,
          open_interest: data.openInterest,
          open_interest_change_24h: data.openInterestChange24h,
          open_interest_change_pct: data.openInterestChangePct,
          price: data.price,
          price_change_24h: data.priceChange24h,
          volume_24h: data.volume24h,
          signal: data.signal,
          explanation: data.explanation,
        },
      ]);

      this.logger.debug("Saved open interest", {
        symbol: data.symbol,
        exchange: data.exchange,
        oi: data.openInterest,
        signal: data.signal,
      });
    } catch (error) {
      this.logger.error("Failed to save open interest", {
        symbol: data.symbol,
        exchange: data.exchange,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get historical Open Interest
   */
  async getHistoricalOI(
    symbol: string,
    exchange: string,
    hours: number
  ): Promise<OpenInterestData[]> {
    const query = `
      SELECT
        timestamp,
        symbol,
        exchange,
        open_interest,
        open_interest_change_24h,
        open_interest_change_pct,
        price,
        price_change_24h,
        volume_24h,
        signal,
        explanation
      FROM aladdin.open_interest
      WHERE symbol = {symbol:String}
        AND exchange = {exchange:String}
        AND timestamp >= now() - INTERVAL {hours:UInt16} HOUR
      ORDER BY timestamp DESC
      LIMIT ${OI_HISTORY_LIMIT}
    `;

    const rows = await this.clickhouse.query<{
      timestamp: string;
      symbol: string;
      exchange: string;
      open_interest: string;
      open_interest_change_24h: string;
      open_interest_change_pct: string;
      price: string;
      price_change_24h: string;
      volume_24h: string;
      signal: string;
      explanation: string;
    }>(query, { symbol, exchange, hours });

    return rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      symbol: row.symbol,
      exchange: row.exchange,
      openInterest: Number.parseFloat(row.open_interest),
      openInterestChange24h: Number.parseFloat(row.open_interest_change_24h),
      openInterestChangePct: Number.parseFloat(row.open_interest_change_pct),
      price: Number.parseFloat(row.price),
      priceChange24h: Number.parseFloat(row.price_change_24h),
      volume24h: Number.parseFloat(row.volume_24h),
      signal: row.signal as "BULLISH" | "BEARISH" | "NEUTRAL",
      explanation: row.explanation,
    }));
  }

  /**
   * Get OI across all exchanges
   */
  async getAllExchangesOI(
    symbol: string
  ): Promise<Map<string, OpenInterestData>> {
    const exchanges = ["binance", "bybit", "okx"];
    const results = new Map<string, OpenInterestData>();

    await Promise.allSettled(
      exchanges.map(async (exchange) => {
        try {
          const data = await this.getOpenInterest(symbol, exchange);
          results.set(exchange, data);
        } catch (error) {
          this.logger.warn(`Failed to fetch OI from ${exchange}`, {
            symbol,
            error: error.message,
          });
        }
      })
    );

    return results;
  }
}
