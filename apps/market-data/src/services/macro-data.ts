import {
  BaseService,
  type BaseServiceConfig,
} from "@aladdin/service";
import { CoinGeckoProvider } from "../providers/coingecko";
import { FearGreedProvider } from "../providers/feargreed";

const DEFAULT_GLOBAL_METRICS_INTERVAL = 600_000; // 10 minutes
const DEFAULT_FEARGREED_INTERVAL = 900_000; // 15 minutes
const DEFAULT_TRENDING_INTERVAL = 1_800_000; // 30 minutes
const MINUTES_TO_MS = 60_000;
const HUNDRED = 100;

// Regex for datetime formatting
const DATETIME_REGEX = /\.\d{3}Z$/;

type MacroDataServiceConfig = BaseServiceConfig & {
  coingeckoApiUrl?: string;
  coingeckoApiKey?: string;
  feargreedApiUrl?: string;
  globalMetricsInterval?: number;
  feargreedInterval?: number;
  trendingInterval?: number;
};

/**
 * Macro Data Service - Global market metrics and macro indicators
 */
export class MacroDataService extends BaseService {
  private config: MacroDataServiceConfig;
  private coinGeckoProvider?: CoinGeckoProvider;
  private fearGreedProvider?: FearGreedProvider;
  private globalMetricsInterval?: Timer;
  private fearGreedInterval?: Timer;
  private trendingInterval?: Timer;

  constructor(config: MacroDataServiceConfig) {
    super(config);
    this.config = config;
  }

  getServiceName(): string {
    return "macro-data";
  }

  protected onInitialize(): void {
    if (!this.clickhouse) {
      throw new Error("ClickHouse is required for Macro Data Service");
    }

    // Initialize providers
    this.coinGeckoProvider = new CoinGeckoProvider({
      apiUrl: this.config.coingeckoApiUrl ?? "https://api.coingecko.com/api/v3",
      apiKey: this.config.coingeckoApiKey,
      logger: this.logger,
    });

    this.fearGreedProvider = new FearGreedProvider({
      apiUrl: this.config.feargreedApiUrl ?? "https://api.alternative.me",
      logger: this.logger,
    });

    this.logger.info("Providers initialized");
  }

  protected async onStart(): Promise<void> {
    // Collect data immediately on start
    await Promise.allSettled([
      this.collectGlobalMetrics(),
      this.collectFearGreed(),
      this.collectTrending(),
      this.collectTopCoins(),
    ]);

    // Schedule periodic collection
    const globalInterval =
      this.config.globalMetricsInterval ?? DEFAULT_GLOBAL_METRICS_INTERVAL;
    const feargreedInt =
      this.config.feargreedInterval ?? DEFAULT_FEARGREED_INTERVAL;
    const trendingInt =
      this.config.trendingInterval ?? DEFAULT_TRENDING_INTERVAL;

    this.globalMetricsInterval = setInterval(() => {
      Promise.allSettled([this.collectGlobalMetrics(), this.collectTopCoins()]);
    }, globalInterval);

    this.fearGreedInterval = setInterval(() => {
      this.collectFearGreed().catch((err) =>
        this.logger.error("Fear & greed collection failed", err)
      );
    }, feargreedInt);

    this.trendingInterval = setInterval(() => {
      this.collectTrending().catch((err) =>
        this.logger.error("Trending collection failed", err)
      );
    }, trendingInt);

    this.logger.info("Background tasks started", {
      globalMetricsInterval: globalInterval / MINUTES_TO_MS,
      fearGreedInterval: feargreedInt / MINUTES_TO_MS,
      trendingInterval: trendingInt / MINUTES_TO_MS,
    });
  }

  protected async onStop(): Promise<void> {
    await Promise.resolve(); // Ensure async
    if (this.globalMetricsInterval) {
      clearInterval(this.globalMetricsInterval);
    }
    if (this.fearGreedInterval) {
      clearInterval(this.fearGreedInterval);
    }
    if (this.trendingInterval) {
      clearInterval(this.trendingInterval);
    }
    this.logger.info("Background tasks stopped");
  }

  protected onHealthCheck(): Promise<Record<string, boolean>> {
    return Promise.resolve({
      coinGecko: this.coinGeckoProvider !== undefined,
      fearGreed: this.fearGreedProvider !== undefined,
      backgroundTasks: this.globalMetricsInterval !== undefined,
    });
  }

  get clickhouseClient() {
    return this.clickhouse;
  }

  /**
   * Сбор глобальных метрик
   */
  private async collectGlobalMetrics(): Promise<void> {
    if (!(this.coinGeckoProvider && this.clickhouse)) return;

    try {
      this.logger.info("Collecting global market metrics...");

      const data = await this.coinGeckoProvider.getGlobalMetrics();

      const altcoinDominance =
        HUNDRED - data.btc_dominance - data.eth_dominance;

      const query = `
        INSERT INTO aladdin.global_market_metrics (
          timestamp,
          total_market_cap_usd,
          market_cap_change_24h,
          total_volume_24h_usd,
          btc_dominance,
          eth_dominance,
          altcoin_dominance,
          active_cryptocurrencies,
          markets
        ) VALUES (
          now(),
          ${data.total_market_cap_usd},
          ${data.market_cap_change_percentage_24h},
          ${data.total_volume_24h_usd},
          ${data.btc_dominance},
          ${data.eth_dominance},
          ${altcoinDominance},
          ${data.active_cryptocurrencies},
          ${data.markets}
        )
      `;

      await this.clickhouse.command(query);
      this.logger.info("Global metrics collected successfully");
    } catch (error) {
      this.logger.error("Failed to collect global metrics", error);
    }
  }

  /**
   * Сбор Fear & Greed Index
   */
  private async collectFearGreed(): Promise<void> {
    if (!(this.fearGreedProvider && this.clickhouse)) return;

    try {
      this.logger.info("Collecting Fear & Greed Index...");

      const data = await this.fearGreedProvider.getCurrentIndex();
      const MILLISECONDS_TO_SECONDS = 1000;
      const timestamp = Math.floor(data.timestamp / MILLISECONDS_TO_SECONDS);

      // Check if this timestamp already exists to avoid duplicates
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM aladdin.fear_greed_index
        WHERE timestamp = FROM_UNIXTIME(${timestamp})
      `;

      const existing = await this.clickhouse.query<{ count: number }>(
        checkQuery
      );

      if (existing.length > 0 && existing[0].count > 0) {
        this.logger.debug(
          "Fear & Greed Index already exists for this timestamp",
          {
            timestamp,
            value: data.value,
          }
        );
        return;
      }

      const insertQuery = `
        INSERT INTO aladdin.fear_greed_index (
          timestamp,
          value,
          classification,
          time_until_update
        ) VALUES (
          FROM_UNIXTIME(${timestamp}),
          ${data.value},
          '${data.value_classification}',
          ${data.time_until_update}
        )
      `;

      await this.clickhouse.command(insertQuery);
      this.logger.info("Fear & Greed Index collected successfully", {
        value: data.value,
        classification: data.value_classification,
      });
    } catch (error) {
      this.logger.error("Failed to collect Fear & Greed Index", error);
    }
  }

  /**
   * Сбор трендовых монет
   */
  private async collectTrending(): Promise<void> {
    if (!(this.coinGeckoProvider && this.clickhouse)) return;

    try {
      this.logger.info("Collecting trending coins...");

      const coins = await this.coinGeckoProvider.getTrending();

      for (let i = 0; i < coins.length; i++) {
        const coin = coins[i];

        // Заменяем NaN и Infinity на NULL для ClickHouse
        const safeNumber = (value: number): string => {
          if (!Number.isFinite(value)) return "NULL";
          return value.toString();
        };

        const query = `
          INSERT INTO aladdin.trending_coins (
            timestamp,
            coin_id,
            symbol,
            name,
            market_cap_rank,
            price_usd,
            price_btc,
            volume_24h,
            price_change_24h,
            market_cap,
            rank
          ) VALUES (
            now(),
            '${coin.id}',
            '${coin.symbol}',
            '${coin.name.replace(/'/g, "''")}',
            ${coin.market_cap_rank},
            ${safeNumber(coin.price_usd)},
            ${safeNumber(coin.price_btc)},
            ${safeNumber(coin.volume_24h)},
            ${safeNumber(coin.price_change_24h)},
            ${safeNumber(coin.market_cap)},
            ${i + 1}
          )
        `;

        await this.clickhouse.command(query);
      }

      this.logger.info("Trending coins collected successfully", {
        count: coins.length,
      });
    } catch (error) {
      this.logger.error("Failed to collect trending coins", error);
    }
  }

  /**
   * Сбор топ монет
   */
  private async collectTopCoins(): Promise<void> {
    if (!(this.coinGeckoProvider && this.clickhouse)) return;

    try {
      this.logger.info("Collecting top coins...");
      const TOP_COINS_LIMIT = 100;

      const coins = await this.coinGeckoProvider.getTopCoins(TOP_COINS_LIMIT);

      // Используем один timestamp для всех монет в этой пачке
      // ClickHouse DateTime format: YYYY-MM-DD HH:MM:SS
      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace("T", " ")
        .replace(DATETIME_REGEX, "");

      // Заменяем NaN и Infinity на NULL для ClickHouse
      const safeNumber = (value: number): string =>
        Number.isFinite(value) ? value.toString() : "NULL";

      // Batch insert для лучшей производительности
      const values = coins.map(
        (coin) => `(
          '${timestamp}',
          '${coin.id}',
          '${coin.symbol}',
          '${coin.name.replace(/'/g, "''")}',
          ${coin.market_cap_rank ?? 0},
          ${safeNumber(coin.price_usd)},
          ${safeNumber(coin.market_cap)},
          ${safeNumber(coin.volume_24h)},
          ${safeNumber(coin.price_change_24h)},
          ${safeNumber(coin.price_change_7d)},
          ${safeNumber(coin.market_cap_change_24h)},
          ${coin.category ? `'${coin.category}'` : "NULL"},
          ${coin.sector ? `'${coin.sector}'` : "NULL"}
        )`
      );

      const query = `
        INSERT INTO aladdin.top_coins (
          timestamp,
          coin_id,
          symbol,
          name,
          market_cap_rank,
          price_usd,
          market_cap,
          volume_24h,
          price_change_24h,
          price_change_7d,
          market_cap_change_24h,
          category,
          sector
        ) VALUES ${values.join(", ")}
      `;

      await this.clickhouse.command(query);

      this.logger.info("Top coins collected successfully", {
        count: coins.length,
        timestamp,
      });
    } catch (error) {
      this.logger.error("Failed to collect top coins", error);
    }
  }
}
