import type { Logger } from "@aladdin/logger";

type MarketCapData = {
  symbol: string;
  marketCap: number;
  price: number;
  lastUpdated: number;
};

/**
 * MarketCapProvider - Provides market cap and price data for cryptocurrencies
 */
export class MarketCapProvider {
  private marketCapCache = new Map<string, MarketCapData>();
  private readonly CACHE_TTL_MS = 300_000; // 5 minutes
  private readonly CMC_API_BASE = "https://pro-api.coinmarketcap.com/v1";

  constructor(
    private apiKey: string,
    private logger: Logger
  ) {}

  /**
   * Get market cap for a symbol
   */
  async getMarketCap(symbol: string): Promise<number> {
    const data = await this.getData(symbol);
    return data.marketCap;
  }

  /**
   * Get current price for a symbol
   */
  async getPrice(symbol: string): Promise<number> {
    const data = await this.getData(symbol);
    return data.price;
  }

  /**
   * Get market data (cached or fresh)
   */
  private async getData(symbol: string): Promise<MarketCapData> {
    const cached = this.marketCapCache.get(symbol);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && now - cached.lastUpdated < this.CACHE_TTL_MS) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await this.fetchMarketData(symbol);
      this.marketCapCache.set(symbol, {
        symbol,
        marketCap: data.marketCap,
        price: data.price,
        lastUpdated: now,
      });
      return {
        symbol,
        marketCap: data.marketCap,
        price: data.price,
        lastUpdated: now,
      };
    } catch (error) {
      this.logger.error("Failed to fetch market data", { symbol, error });
      // Return cached value if fetch fails
      if (cached) {
        return cached;
      }
      return { symbol, marketCap: 0, price: 0, lastUpdated: now };
    }
  }

  /**
   * Fetch market cap and price from CoinMarketCap API
   */
  private async fetchMarketData(
    symbol: string
  ): Promise<{ marketCap: number; price: number }> {
    const url = `${this.CMC_API_BASE}/cryptocurrency/quotes/latest?symbol=${symbol}`;

    const response = await fetch(url, {
      headers: {
        "X-CMC_PRO_API_KEY": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.data?.[symbol]) {
      throw new Error(`No data for symbol: ${symbol}`);
    }

    const quote = data.data[symbol].quote.USD;
    const marketCap = quote.market_cap;
    const price = quote.price;

    this.logger.debug("Fetched market data", { symbol, marketCap, price });

    return { marketCap, price };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.marketCapCache.clear();
  }
}
