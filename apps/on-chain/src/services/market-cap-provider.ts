import type { Logger } from "@aladdin/shared/logger";

const CMC_API = "https://pro-api.coinmarketcap.com/v1";
const CACHE_DURATION_MS = 300_000; // 5 minutes

interface MarketCapCache {
  [symbol: string]: {
    value: number;
    timestamp: number;
  };
}

/**
 * Market cap data provider using CoinMarketCap API
 */
export class MarketCapProvider {
  private apiKey: string;
  private logger: Logger;
  private cache: MarketCapCache = {};

  constructor(apiKey: string, logger: Logger) {
    this.apiKey = apiKey;
    this.logger = logger;
  }

  /**
   * Get market cap for a cryptocurrency
   */
  async getMarketCap(symbol: string): Promise<number | undefined> {
    // Check cache first
    const cached = this.cache[symbol];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return cached.value;
    }

    try {
      const response = await fetch(
        `${CMC_API}/cryptocurrency/quotes/latest?symbol=${symbol}`,
        {
          headers: {
            "X-CMC_PRO_API_KEY": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        this.logger.warn(`CoinMarketCap API request failed for ${symbol}`, {
          status: response.status,
        });
        return;
      }

      const data = (await response.json()) as {
        data?: {
          [key: string]: {
            quote?: {
              USD?: {
                market_cap?: number;
              };
            };
          };
        };
      };

      const marketCap = data.data?.[symbol]?.quote?.USD?.market_cap;

      if (marketCap) {
        // Update cache
        this.cache[symbol] = {
          value: marketCap,
          timestamp: Date.now(),
        };
        return marketCap;
      }

      return;
    } catch (error) {
      this.logger.error(`Failed to fetch market cap for ${symbol}`, error);
      return;
    }
  }

  /**
   * Get market caps for multiple cryptocurrencies
   */
  async getMarketCaps(
    symbols: string[]
  ): Promise<Record<string, number | undefined>> {
    const result: Record<string, number | undefined> = {};

    // Fetch in batches to avoid rate limits
    for (const symbol of symbols) {
      result[symbol] = await this.getMarketCap(symbol);
      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return result;
  }
}
