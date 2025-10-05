import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";

// Constants
const FUNDING_INTERVAL_HOURS = 8;
const HIGH_POSITIVE_THRESHOLD = 0.0001; // 0.01%
const HIGH_NEGATIVE_THRESHOLD = -0.0001;
const EXTREME_THRESHOLD = 0.001; // 0.1%

export type FundingRateData = {
  symbol: string;
  exchange: string;
  timestamp: Date;

  fundingRate: number; // Decimal (e.g., 0.0001 = 0.01%)
  fundingIntervalHours: number;
  nextFundingTime: Date;

  avgFunding24h: number;
  avgFunding7d: number;

  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  signal: string;
};

export class FundingRateService {
  constructor(
    private clickhouse: ClickHouseClient,
    private logger: Logger
  ) {}

  /**
   * Fetch funding rate from exchange
   */
  async getFundingRate(
    symbol: string,
    exchange: string
  ): Promise<FundingRateData> {
    this.logger.debug("Fetching funding rate", { symbol, exchange });

    const rawData = await this.fetchFromExchange(symbol, exchange);

    // Calculate historical averages
    const avg24h = await this.calculateAverage(symbol, exchange, 24);
    const avg7d = await this.calculateAverage(symbol, exchange, 168); // 7 days

    // Analyze sentiment
    const { sentiment, signal } = this.analyzeFunding(rawData.fundingRate);

    return {
      symbol,
      exchange,
      timestamp: new Date(),
      fundingRate: rawData.fundingRate,
      fundingIntervalHours: rawData.fundingIntervalHours,
      nextFundingTime: rawData.nextFundingTime,
      avgFunding24h: avg24h,
      avgFunding7d: avg7d,
      sentiment,
      signal,
    };
  }

  /**
   * Fetch from specific exchange
   */
  private async fetchFromExchange(
    symbol: string,
    exchange: string
  ): Promise<{
    fundingRate: number;
    fundingIntervalHours: number;
    nextFundingTime: Date;
  }> {
    switch (exchange.toLowerCase()) {
      case "binance":
        return this.fetchBinanceFunding(symbol);
      case "bybit":
        return this.fetchBybitFunding(symbol);
      case "okx":
        return this.fetchOKXFunding(symbol);
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }
  }

  /**
   * Fetch Binance funding rate
   */
  private async fetchBinanceFunding(symbol: string): Promise<{
    fundingRate: number;
    fundingIntervalHours: number;
    nextFundingTime: Date;
  }> {
    // Binance Futures API
    const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Binance Futures API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    return {
      fundingRate: Number.parseFloat(data.lastFundingRate),
      fundingIntervalHours: FUNDING_INTERVAL_HOURS,
      nextFundingTime: new Date(data.nextFundingTime),
    };
  }

  /**
   * Fetch Bybit funding rate
   */
  private async fetchBybitFunding(symbol: string): Promise<{
    fundingRate: number;
    fundingIntervalHours: number;
    nextFundingTime: Date;
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

    return {
      fundingRate: Number.parseFloat(ticker.fundingRate),
      fundingIntervalHours: FUNDING_INTERVAL_HOURS,
      nextFundingTime: new Date(Number.parseInt(ticker.nextFundingTime, 10)),
    };
  }

  /**
   * Fetch OKX funding rate
   */
  private async fetchOKXFunding(symbol: string): Promise<{
    fundingRate: number;
    fundingIntervalHours: number;
    nextFundingTime: Date;
  }> {
    // OKX uses format like BTC-USDT-SWAP
    const okxSymbol = symbol
      .replace(/USDT$/, "-USDT-SWAP")
      .replace(/BUSD$/, "-BUSD-SWAP");

    const url = `https://www.okx.com/api/v5/public/funding-rate?instId=${okxSymbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `OKX API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.code !== "0" || !data.data?.[0]) {
      throw new Error(`OKX API error: ${data.msg || "No data"}`);
    }

    const fundingData = data.data[0];

    return {
      fundingRate: Number.parseFloat(fundingData.fundingRate),
      fundingIntervalHours: FUNDING_INTERVAL_HOURS,
      nextFundingTime: new Date(
        Number.parseInt(fundingData.nextFundingTime, 10)
      ),
    };
  }

  /**
   * Calculate historical average funding rate
   */
  private async calculateAverage(
    symbol: string,
    exchange: string,
    hours: number
  ): Promise<number> {
    try {
      const query = `
        SELECT avg(funding_rate) as avg_rate
        FROM aladdin.funding_rates
        WHERE symbol = {symbol:String}
          AND exchange = {exchange:String}
          AND timestamp >= now() - INTERVAL {hours:UInt16} HOUR
      `;

      const rows = await this.clickhouse.query<{ avg_rate: string }>(query, {
        symbol,
        exchange,
        hours,
      });

      if (rows.length > 0 && rows[0].avg_rate) {
        return Number.parseFloat(rows[0].avg_rate);
      }

      return 0;
    } catch (error) {
      this.logger.error("Failed to calculate average funding", {
        symbol,
        exchange,
        hours,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Analyze funding rate and generate signal
   */
  private analyzeFunding(rate: number): {
    sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
    signal: string;
  } {
    if (rate > EXTREME_THRESHOLD) {
      return {
        sentiment: "BULLISH",
        signal: `Extremely high positive funding (${(rate * 100).toFixed(4)}%) - Market overheated, possible correction`,
      };
    }

    if (rate > HIGH_POSITIVE_THRESHOLD) {
      return {
        sentiment: "BULLISH",
        signal: `High positive funding (${(rate * 100).toFixed(4)}%) - Longs paying shorts, bullish bias but watch for reversal`,
      };
    }

    if (rate < -EXTREME_THRESHOLD) {
      return {
        sentiment: "BEARISH",
        signal: `Extremely high negative funding (${(rate * 100).toFixed(4)}%) - Shorts squeezed, possible rally`,
      };
    }

    if (rate < HIGH_NEGATIVE_THRESHOLD) {
      return {
        sentiment: "BEARISH",
        signal: `High negative funding (${(rate * 100).toFixed(4)}%) - Shorts paying longs, bearish bias but watch for squeeze`,
      };
    }

    return {
      sentiment: "NEUTRAL",
      signal: `Neutral funding (${(rate * 100).toFixed(4)}%) - Balanced futures market`,
    };
  }

  /**
   * Save funding rate to ClickHouse
   */
  async saveFundingRate(data: FundingRateData): Promise<void> {
    try {
      await this.clickhouse.insert("aladdin.funding_rates", [
        {
          timestamp: Math.floor(data.timestamp.getTime() / 1000),
          symbol: data.symbol,
          exchange: data.exchange,
          funding_rate: data.fundingRate,
          funding_interval_hours: data.fundingIntervalHours,
          next_funding_time: Math.floor(data.nextFundingTime.getTime() / 1000),
          avg_funding_24h: data.avgFunding24h,
          avg_funding_7d: data.avgFunding7d,
          sentiment: data.sentiment,
          signal: data.signal,
        },
      ]);

      this.logger.debug("Saved funding rate", {
        symbol: data.symbol,
        exchange: data.exchange,
        rate: data.fundingRate,
      });
    } catch (error) {
      this.logger.error("Failed to save funding rate", {
        symbol: data.symbol,
        exchange: data.exchange,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get funding rates across all exchanges
   */
  async getAllExchangesFundingRate(
    symbol: string
  ): Promise<Map<string, FundingRateData>> {
    const exchanges = ["binance", "bybit", "okx"];
    const results = new Map<string, FundingRateData>();

    await Promise.allSettled(
      exchanges.map(async (exchange) => {
        try {
          const data = await this.getFundingRate(symbol, exchange);
          results.set(exchange, data);
        } catch (error) {
          this.logger.warn(`Failed to fetch funding rate from ${exchange}`, {
            symbol,
            error: error.message,
          });
        }
      })
    );

    return results;
  }

  /**
   * Get historical funding rates
   */
  async getHistoricalFunding(
    symbol: string,
    exchange: string,
    hours: number
  ): Promise<FundingRateData[]> {
    const query = `
      SELECT
        timestamp,
        symbol,
        exchange,
        funding_rate,
        funding_interval_hours,
        next_funding_time,
        avg_funding_24h,
        avg_funding_7d,
        sentiment,
        signal
      FROM aladdin.funding_rates
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
      funding_rate: string;
      funding_interval_hours: number;
      next_funding_time: string;
      avg_funding_24h: string;
      avg_funding_7d: string;
      sentiment: string;
      signal: string;
    }>(query, { symbol, exchange, hours });

    return rows.map((row) => ({
      timestamp: new Date(row.timestamp),
      symbol: row.symbol,
      exchange: row.exchange,
      fundingRate: Number.parseFloat(row.funding_rate),
      fundingIntervalHours: row.funding_interval_hours,
      nextFundingTime: new Date(row.next_funding_time),
      avgFunding24h: Number.parseFloat(row.avg_funding_24h),
      avgFunding7d: Number.parseFloat(row.avg_funding_7d),
      sentiment: row.sentiment as "BULLISH" | "BEARISH" | "NEUTRAL",
      signal: row.signal,
    }));
  }

  /**
   * Get funding rates across all exchanges for a symbol
   */
  async getAllExchangesFunding(
    symbol: string
  ): Promise<Map<string, FundingRateData>> {
    const exchanges = ["binance", "bybit", "okx"];
    const results = new Map<string, FundingRateData>();

    await Promise.allSettled(
      exchanges.map(async (exchange) => {
        try {
          const data = await this.getFundingRate(symbol, exchange);
          results.set(exchange, data);
        } catch (error) {
          this.logger.warn(`Failed to fetch funding from ${exchange}`, {
            symbol,
            error: error.message,
          });
        }
      })
    );

    return results;
  }
}
