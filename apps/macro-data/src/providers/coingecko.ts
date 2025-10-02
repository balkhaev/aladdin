import type { Logger } from "@aladdin/shared/logger";

type CoinGeckoConfig = {
  apiUrl: string;
  apiKey?: string;
  logger: Logger;
};

export type GlobalMarketData = {
  total_market_cap_usd: number;
  total_volume_24h_usd: number;
  market_cap_change_percentage_24h: number;
  btc_dominance: number;
  eth_dominance: number;
  active_cryptocurrencies: number;
  markets: number;
  timestamp: number;
};

export type TrendingCoin = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number;
  price_usd: number;
  price_btc: number;
  volume_24h: number;
  price_change_24h: number;
  market_cap: number;
};

export type CoinData = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  price_usd: number;
  market_cap: number;
  volume_24h: number;
  price_change_24h: number;
  price_change_7d: number;
  market_cap_change_24h: number;
  category: string | null;
  sector: string | null;
};

const RATE_LIMIT_DELAY_MS = 1200; // 50 calls/minute = 1.2s between calls
const REQUEST_TIMEOUT_MS = 10_000;

export class CoinGeckoProvider {
  private lastRequestTime = 0;

  constructor(private config: CoinGeckoConfig) {}

  /**
   * Ожидание для соблюдения rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Выполнить запрос к CoinGecko API
   */
  private async request<T>(endpoint: string): Promise<T> {
    await this.waitForRateLimit();

    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: HeadersInit = {
      Accept: "application/json",
    };

    if (this.config.apiKey) {
      headers["x-cg-pro-api-key"] = this.config.apiKey;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `CoinGecko API error: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      this.config.logger.error("CoinGecko API request failed", { url, error });
      throw error;
    }
  }

  /**
   * Получить глобальные рыночные метрики
   */
  async getGlobalMetrics(): Promise<GlobalMarketData> {
    const data = await this.request<{
      data: {
        total_market_cap: { usd: number };
        total_volume: { usd: number };
        market_cap_change_percentage_24h_usd: number;
        market_cap_percentage: { btc: number; eth: number };
        active_cryptocurrencies: number;
        markets: number;
        updated_at: number;
      };
    }>("/global");

    return {
      total_market_cap_usd: data.data.total_market_cap.usd,
      total_volume_24h_usd: data.data.total_volume.usd,
      market_cap_change_percentage_24h:
        data.data.market_cap_change_percentage_24h_usd,
      btc_dominance: data.data.market_cap_percentage.btc,
      eth_dominance: data.data.market_cap_percentage.eth,
      active_cryptocurrencies: data.data.active_cryptocurrencies,
      markets: data.data.markets,
      timestamp: Date.now(),
    };
  }

  /**
   * Получить топ трендовых монет
   */
  async getTrending(): Promise<TrendingCoin[]> {
    const data = await this.request<{
      coins: Array<{
        item: {
          id: string;
          coin_id: number;
          name: string;
          symbol: string;
          market_cap_rank: number;
          thumb: string;
          small: string;
          large: string;
          slug: string;
          price_btc: number;
          score: number;
          data: {
            price: string;
            price_btc: string;
            price_change_percentage_24h: { usd: number };
            market_cap: string;
            total_volume: string;
          };
        };
      }>;
    }>("/search/trending");

    return data.coins.map((coin) => ({
      id: coin.item.id,
      symbol: coin.item.symbol,
      name: coin.item.name,
      market_cap_rank: coin.item.market_cap_rank,
      price_usd: Number.parseFloat(coin.item.data.price),
      price_btc: coin.item.price_btc,
      volume_24h: Number.parseFloat(coin.item.data.total_volume),
      price_change_24h: coin.item.data.price_change_percentage_24h.usd,
      market_cap: Number.parseFloat(coin.item.data.market_cap),
    }));
  }

  /**
   * Получить топ монеты по категориям
   */
  async getTopCoins(limit = 100): Promise<CoinData[]> {
    const data = await this.request<
      Array<{
        id: string;
        symbol: string;
        name: string;
        image: string;
        current_price: number;
        market_cap: number;
        market_cap_rank: number | null;
        fully_diluted_valuation: number | null;
        total_volume: number;
        high_24h: number;
        low_24h: number;
        price_change_24h: number;
        price_change_percentage_24h: number;
        market_cap_change_24h: number;
        market_cap_change_percentage_24h: number;
        circulating_supply: number;
        total_supply: number | null;
        max_supply: number | null;
        ath: number;
        ath_change_percentage: number;
        ath_date: string;
        atl: number;
        atl_change_percentage: number;
        atl_date: string;
        roi: null | { times: number; currency: string; percentage: number };
        last_updated: string;
        price_change_percentage_7d_in_currency: number;
      }>
    >(
      `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=7d`
    );

    return data.map((coin) => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      market_cap_rank: coin.market_cap_rank,
      price_usd: coin.current_price,
      market_cap: coin.market_cap,
      volume_24h: coin.total_volume,
      price_change_24h: coin.price_change_percentage_24h,
      price_change_7d: coin.price_change_percentage_7d_in_currency,
      market_cap_change_24h: coin.market_cap_change_percentage_24h,
      category: this.categorizeToken(coin.id, coin.symbol),
      sector: this.getSector(coin.id, coin.symbol),
    }));
  }

  /**
   * Категоризация токена (DeFi, L1, L2, etc)
   */
  private categorizeToken(id: string, symbol: string): string | null {
    const defi = [
      "uniswap",
      "aave",
      "compound",
      "maker",
      "curve-dao-token",
      "sushi",
      "pancakeswap-token",
      "1inch",
    ];
    const l1 = [
      "bitcoin",
      "ethereum",
      "binancecoin",
      "cardano",
      "solana",
      "polkadot",
      "avalanche-2",
      "near",
      "cosmos",
    ];
    const l2 = [
      "polygon",
      "optimism",
      "arbitrum",
      "immutable-x",
      "loopring",
      "starknet",
    ];
    const gaming = [
      "axie-infinity",
      "decentraland",
      "the-sandbox",
      "gala",
      "illuvium",
      "immutable-x",
    ];
    const meme = ["dogecoin", "shiba-inu", "pepe", "floki", "bonk"];

    if (defi.includes(id)) return "DeFi";
    if (l1.includes(id)) return "Layer 1";
    if (l2.includes(id)) return "Layer 2";
    if (gaming.includes(id)) return "Gaming";
    if (meme.includes(id)) return "Meme";

    return null;
  }

  /**
   * Определение сектора
   */
  private getSector(id: string, symbol: string): string | null {
    const infrastructure = [
      "ethereum",
      "solana",
      "polkadot",
      "avalanche-2",
      "cosmos",
      "near",
    ];
    const defi = ["uniswap", "aave", "compound", "maker", "curve-dao-token"];
    const exchange = ["binancecoin", "uniswap", "pancakeswap-token"];

    if (infrastructure.includes(id)) return "Infrastructure";
    if (defi.includes(id)) return "DeFi";
    if (exchange.includes(id)) return "Exchange";

    return "Other";
  }
}
