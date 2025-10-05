import type { Logger } from "@aladdin/shared/logger";

type MarketCapData = {
  symbol: string;
  marketCap: number;
  lastUpdated: number;
};

/**
 * MarketCapProvider - Provides market cap data for cryptocurrencies
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
    const cached = this.marketCapCache.get(symbol);
    const now = Date.now();

    // Return cached value if still valid
    if (cached && now - cached.lastUpdated < this.CACHE_TTL_MS) {
      return cached.marketCap;
    }

    // Fetch fresh data
    try {
      const marketCap = await this.fetchMarketCap(symbol);
      this.marketCapCache.set(symbol, {
        symbol,
        marketCap,
        lastUpdated: now,
      });
      return marketCap;
    } catch (error) {
      this.logger.error("Failed to fetch market cap", { symbol, error });
      // Return cached value if fetch fails
      if (cached) {
        return cached.marketCap;
      }
      return 0;
    }
  }

  /**
   * Fetch market cap from CoinMarketCap API
   */
  private async fetchMarketCap(symbol: string): Promise<number> {
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

    const marketCap = data.data[symbol].quote.USD.market_cap;

    this.logger.debug("Fetched market cap", { symbol, marketCap });

    return marketCap;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.marketCapCache.clear();
  }
}

