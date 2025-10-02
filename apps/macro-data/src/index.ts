import { errorHandlerMiddleware, NotFoundError } from "@aladdin/shared/errors";
import { initializeService } from "@aladdin/shared/service-bootstrap";
import type { Context } from "hono";
import { MacroDataService } from "./services/macro-data";
import "dotenv/config";

// Константы
const DEFAULT_PORT = 3016;
const DEFAULT_GLOBAL_METRICS_INTERVAL = 10;
const DEFAULT_FEARGREED_INTERVAL = 60;
const DEFAULT_TRENDING_INTERVAL = 30;
const MINUTES_TO_MS = 60_000;
const DEFAULT_LIMIT = 1;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MAX_CORRELATION_DAYS = 30;
const MIN_CORRELATION_COUNT = 2; // Минимум 2 дня для корреляции
const DEFAULT_TOP_COINS_LIMIT = 50;
const TRENDING_COINS_LIMIT = 10;

initializeService({
  serviceName: "macro-data",
  port: process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT,

  dependencies: {
    clickhouse: true,
  },

  createService: (deps) =>
    new MacroDataService({
      ...deps,
      coingeckoApiUrl: process.env.COINGECKO_API_URL,
      coingeckoApiKey: process.env.COINGECKO_API_KEY,
      feargreedApiUrl: process.env.FEARGREED_API_URL,
      globalMetricsInterval:
        (Number(process.env.GLOBAL_METRICS_INTERVAL) ||
          DEFAULT_GLOBAL_METRICS_INTERVAL) * MINUTES_TO_MS,
      feargreedInterval:
        (Number(process.env.FEARGREED_INTERVAL) || DEFAULT_FEARGREED_INTERVAL) *
        MINUTES_TO_MS,
      trendingInterval:
        (Number(process.env.TRENDING_INTERVAL) || DEFAULT_TRENDING_INTERVAL) *
        MINUTES_TO_MS,
    }),

  setupRoutes: (app, service) => {
    // Apply error handling middleware
    app.use("*", errorHandlerMiddleware());

    /**
     * GET /api/macro/global - Получить глобальные рыночные метрики
     */
    app.get("/api/macro/global", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const query = `
        SELECT 
          timestamp,
          total_market_cap_usd,
          total_volume_24h_usd,
          market_cap_change_24h,
          btc_dominance,
          eth_dominance,
          altcoin_dominance,
          active_cryptocurrencies,
          markets
        FROM aladdin.global_market_metrics
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await clickhouse.query<{
        timestamp: string;
        total_market_cap_usd: string;
        total_volume_24h_usd: string;
        market_cap_change_24h: string;
        btc_dominance: string;
        eth_dominance: string;
        altcoin_dominance: string;
        active_cryptocurrencies: number;
        markets: number;
      }>(query);

      if (result.length === 0) {
        throw new NotFoundError("Global market metrics data");
      }

      const data = result[0];

      return c.json({
        success: true,
        data: {
          timestamp: data.timestamp,
          totalMarketCapUsd: Number.parseFloat(data.total_market_cap_usd),
          totalVolume24hUsd: Number.parseFloat(data.total_volume_24h_usd),
          marketCapChange24h: Number.parseFloat(data.market_cap_change_24h),
          btcDominance: Number.parseFloat(data.btc_dominance),
          ethDominance: Number.parseFloat(data.eth_dominance),
          altcoinDominance: Number.parseFloat(data.altcoin_dominance),
          activeCryptocurrencies: data.active_cryptocurrencies,
          markets: data.markets,
        },
      });
    });

    /**
     * GET /api/macro/feargreed - Получить Fear & Greed Index
     */
    app.get("/api/macro/feargreed", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const limit = Number(c.req.query("limit") ?? DEFAULT_LIMIT);

      const query = `
        SELECT 
          timestamp,
          value,
          classification
        FROM aladdin.fear_greed_index
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `;

      const result = await clickhouse.query<{
        timestamp: string;
        value: number;
        classification: string;
      }>(query);

      if (result.length === 0) {
        throw new NotFoundError("Fear & Greed Index data");
      }

      return c.json({
        success: true,
        data: limit === DEFAULT_LIMIT ? result[0] : result,
      });
    });

    /**
     * GET /api/macro/feargreed/history - Получить историю Fear & Greed Index
     */
    app.get("/api/macro/feargreed/history", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const days = Number(c.req.query("days") ?? DEFAULT_DAYS);
      const limitDays = Math.min(days, MAX_DAYS);

      const query = `
        SELECT 
          toUnixTimestamp(timestamp) as time,
          value
        FROM aladdin.fear_greed_index
        WHERE timestamp >= now() - INTERVAL {limitDays:UInt32} DAY
        ORDER BY timestamp ASC
      `;

      const result = await clickhouse.query<{
        time: number;
        value: number;
      }>(query, { limitDays });

      return c.json({
        success: true,
        data: result,
      });
    });

    /**
     * GET /api/macro/categories/correlation - Получить correlation matrix категорий
     */
    app.get("/api/macro/categories/correlation", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const days = Number(c.req.query("days") ?? "7");
      const limitDays = Math.min(days, MAX_CORRELATION_DAYS);

      // Получить изменения цен по категориям за период
      const query = `
        WITH category_changes AS (
          SELECT 
            category,
            toDate(timestamp) as date,
            avg(price_change_24h) as avg_change
          FROM aladdin.top_coins
          WHERE timestamp >= now() - INTERVAL {limitDays:UInt32} DAY
            AND category IS NOT NULL
            AND category != ''
          GROUP BY category, date
        )
        SELECT 
          c1.category as category1,
          c2.category as category2,
          corr(c1.avg_change, c2.avg_change) as correlation
        FROM category_changes c1
        CROSS JOIN category_changes c2
        WHERE c1.date = c2.date
        GROUP BY c1.category, c2.category
        HAVING count(*) >= {minCount:UInt32}
        ORDER BY c1.category, c2.category
      `;

      const result = await clickhouse.query<{
        category1: string;
        category2: string;
        correlation: number;
      }>(query, { limitDays, minCount: MIN_CORRELATION_COUNT });

      return c.json({
        success: true,
        data: result,
      });
    });

    /**
     * GET /api/macro/trending - Получить трендовые монеты
     */
    app.get("/api/macro/trending", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      // Получаем монеты за последнюю минуту (т.к. они записываются с разными секундами)
      const query = `
        SELECT 
          coin_id,
          symbol,
          name,
          market_cap_rank,
          price_usd,
          price_btc,
          volume_24h,
          price_change_24h,
          market_cap,
          rank,
          timestamp
        FROM aladdin.trending_coins
        WHERE timestamp >= (
          SELECT max(timestamp) - INTERVAL 1 MINUTE
          FROM aladdin.trending_coins
        )
        ORDER BY timestamp DESC, rank ASC
        LIMIT {limit:UInt32}
      `;

      const result = await clickhouse.query<{
        coin_id: string;
        symbol: string;
        name: string;
        market_cap_rank: number;
        price_usd: string;
        price_btc: string;
        volume_24h: string;
        price_change_24h: string;
        market_cap: string;
        rank: number;
        timestamp: string;
      }>(query, {
        limit: TRENDING_COINS_LIMIT,
      });

      if (result.length === 0) {
        // Нет данных в таблице
        return c.json({
          success: true,
          data: [],
        });
      }

      return c.json({
        success: true,
        data: result.map((coin) => ({
          id: coin.coin_id,
          symbol: coin.symbol,
          name: coin.name,
          marketCapRank: coin.market_cap_rank,
          priceUsd: Number.parseFloat(coin.price_usd),
          priceBtc: Number.parseFloat(coin.price_btc),
          volume24h: Number.parseFloat(coin.volume_24h),
          priceChange24h: Number.parseFloat(coin.price_change_24h),
          marketCap: Number.parseFloat(coin.market_cap),
          rank: coin.rank,
        })),
      });
    });

    /**
     * GET /api/macro/categories - Получить статистику по категориям
     */
    app.get("/api/macro/categories", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const query = `
        SELECT 
          category,
          SUM(total_market_cap) as total_market_cap,
          SUM(total_volume_24h) as total_volume_24h,
          AVG(avg_price_change_24h) as avg_price_change_24h,
          AVG(avg_price_change_7d) as avg_price_change_7d,
          SUM(coins_count) as coins_count
        FROM aladdin.category_daily_stats_mv
        WHERE day = today()
          AND category != ''
        GROUP BY category
        ORDER BY total_market_cap DESC
      `;

      const result = await clickhouse.query<{
        category: string;
        total_market_cap: string;
        total_volume_24h: string;
        avg_price_change_24h: string;
        avg_price_change_7d: string;
        coins_count: number;
      }>(query);

      return c.json({
        success: true,
        data: result.map((cat) => ({
          category: cat.category,
          totalMarketCap: Number.parseFloat(cat.total_market_cap),
          totalVolume24h: Number.parseFloat(cat.total_volume_24h),
          avgPriceChange24h: Number.parseFloat(cat.avg_price_change_24h),
          avgPriceChange7d: Number.parseFloat(cat.avg_price_change_7d),
          coinsCount: cat.coins_count,
        })),
      });
    });

    /**
     * GET /api/macro/top-coins - Получить топ монеты
     */
    app.get("/api/macro/top-coins", async (c: Context) => {
      const clickhouse = service.clickhouseClient;
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const categoryParam = c.req.query("category");
      // Игнорируем undefined, "undefined", null, пустые строки
      const category =
        categoryParam && categoryParam !== "undefined" && categoryParam !== ""
          ? categoryParam
          : undefined;
      const limit = Number(c.req.query("limit") ?? DEFAULT_TOP_COINS_LIMIT);

      // Получаем последний timestamp
      const latestQuery = `
        SELECT max(timestamp) as latest_timestamp
        FROM aladdin.top_coins
      `;

      const latestResult = await clickhouse.query<{
        latest_timestamp: string;
      }>(latestQuery);

      if (latestResult.length === 0 || !latestResult[0].latest_timestamp) {
        return c.json({
          success: true,
          data: [],
        });
      }

      let query = "";
      const params: Record<string, unknown> = {
        limit,
        latestTimestamp: latestResult[0].latest_timestamp,
      };

      if (category) {
        query = `
          SELECT 
            coin_id,
            symbol,
            name,
            market_cap_rank,
            price_usd,
            market_cap,
            volume_24h,
            price_change_24h,
            price_change_7d,
            category,
            sector
          FROM aladdin.top_coins
          WHERE timestamp = {latestTimestamp:DateTime}
            AND category = {category:String}
          ORDER BY market_cap_rank ASC
          LIMIT {limit:UInt32}
        `;
        params.category = category;
      } else {
        query = `
          SELECT 
            coin_id,
            symbol,
            name,
            market_cap_rank,
            price_usd,
            market_cap,
            volume_24h,
            price_change_24h,
            price_change_7d,
            category,
            sector
          FROM aladdin.top_coins
          WHERE timestamp = {latestTimestamp:DateTime}
          ORDER BY market_cap_rank ASC
          LIMIT {limit:UInt32}
        `;
      }

      const result = await clickhouse.query<{
        coin_id: string;
        symbol: string;
        name: string;
        market_cap_rank: number;
        price_usd: string;
        market_cap: string;
        volume_24h: string;
        price_change_24h: string;
        price_change_7d: string;
        category: string | null;
        sector: string | null;
      }>(query, params);

      return c.json({
        success: true,
        data: result.map((coin) => ({
          id: coin.coin_id,
          symbol: coin.symbol,
          name: coin.name,
          marketCapRank: coin.market_cap_rank,
          priceUsd: Number.parseFloat(coin.price_usd),
          marketCap: Number.parseFloat(coin.market_cap),
          volume24h: Number.parseFloat(coin.volume_24h),
          priceChange24h: Number.parseFloat(coin.price_change_24h),
          priceChange7d: Number.parseFloat(coin.price_change_7d),
          category: coin.category,
          sector: coin.sector,
        })),
      });
    });
  },
});
