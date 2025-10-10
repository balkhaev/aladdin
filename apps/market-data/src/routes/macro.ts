import type { ClickHouseClient } from "@aladdin/clickhouse";
import { NotFoundError } from "@aladdin/http/errors";
import type { Context, Hono } from "hono";

const DEFAULT_LIMIT = 1;
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MAX_CORRELATION_DAYS = 30;
const MIN_CORRELATION_COUNT = 2;
const DEFAULT_TOP_COINS_LIMIT = 50;
const TRENDING_COINS_LIMIT = 10;
const RSI_PERIOD = 14;
const ALTSEASON_LOOKBACK_DAYS = 90;
const TECHNICALS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const TECHNICALS_SYMBOL_LIMIT = 30;
const DAILY_TIMEFRAME = "1d";

const STABLECOIN_SYMBOLS = new Set([
  "USDT",
  "USDC",
  "BUSD",
  "DAI",
  "TUSD",
  "USDD",
  "FDUSD",
  "GUSD",
  "LUSD",
]);

type CandleRow = {
  timestamp: string;
  close: number | string;
};

type MacroTechnicals = {
  timestamp: string;
  averageCryptoRsi: number | null;
  assetsCount: number;
  altseasonIndex: number | null;
  altseasonSample: number;
  baseAsset: string;
  lookbackDays: number;
};

let macroTechnicalsCache:
  | {
      expiresAt: number;
      payload: MacroTechnicals;
    }
  | null = null;

function toTradingPair(symbol: string): string {
  const sanitized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (sanitized.endsWith("USDT")) {
    return sanitized;
  }
  return `${sanitized}USDT`;
}

function calculateRsi(closes: number[], period = RSI_PERIOD): number | null {
  if (closes.length < period + 1) {
    return null;
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) {
      gainSum += delta;
    } else {
      lossSum -= delta;
    }
  }

  let averageGain = gainSum / period;
  let averageLoss = lossSum / period;

  if (closes.length === period + 1) {
    if (averageLoss === 0) return 100;
    if (averageGain === 0) return 0;
    const rs = averageGain / averageLoss;
    return 100 - 100 / (1 + rs);
  }

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) return 100;
  if (averageGain === 0) return 0;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function calculateReturn(
  closes: number[],
  lookbackDays: number
): number | null {
  if (closes.length < lookbackDays + 1) {
    return null;
  }

  const latest = closes.at(-1);
  const past = closes.at(-(lookbackDays + 1));

  if (!latest || !past || past === 0) {
    return null;
  }

  return ((latest - past) / past) * 100;
}

async function fetchCandles(
  clickhouse: ClickHouseClient,
  symbol: string,
  timeframe: string,
  limit: number
): Promise<number[]> {
  const query = `
    SELECT 
      timestamp,
      close
    FROM aladdin.candles
    WHERE symbol = {symbol:String}
      AND timeframe = {timeframe:String}
    ORDER BY timestamp DESC
    LIMIT {limit:UInt32}
  `;

  const rows = await clickhouse.query<CandleRow>(query, {
    symbol,
    timeframe,
    limit,
  });

  if (rows.length === 0) {
    return [];
  }

  // Преобразуем строки в числа и разворачиваем в хронологический порядок
  return rows
    .map((row) => Number.parseFloat(String(row.close)))
    .reverse()
    .filter((value) => Number.isFinite(value));
}

export function setupMacroRoutes(
  app: Hono,
  clickhouse: ClickHouseClient | undefined
) {
  /**
   * GET /api/market-data/macro/global - Получить глобальные рыночные метрики
   */
  app.get("/api/market-data/macro/global", async (c: Context) => {
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
   * GET /api/market-data/macro/feargreed - Получить Fear & Greed Index
   */
  app.get("/api/market-data/macro/feargreed", async (c: Context) => {
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
   * GET /api/market-data/macro/feargreed/history - Получить историю Fear & Greed Index
   */
  app.get("/api/market-data/macro/feargreed/history", async (c: Context) => {
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
   * GET /api/market-data/macro/trending - Получить трендовые монеты
   */
  app.get("/api/market-data/macro/trending", async (c: Context) => {
    if (!clickhouse) {
      throw new NotFoundError("ClickHouse connection");
    }

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
   * GET /api/market-data/macro/categories - Получить статистику по категориям
   */
  app.get("/api/market-data/macro/categories", async (c: Context) => {
    if (!clickhouse) {
      throw new NotFoundError("ClickHouse connection");
    }

    const query = `
      WITH latest_day AS (
        SELECT MAX(day) as max_day
        FROM aladdin.category_daily_stats_mv
        WHERE category != ''
      )
      SELECT 
        category,
        SUM(total_market_cap) as total_market_cap,
        SUM(total_volume_24h) as total_volume_24h,
        AVG(avg_price_change_24h) as avg_price_change_24h,
        AVG(avg_price_change_7d) as avg_price_change_7d,
        SUM(coins_count) as coins_count
      FROM aladdin.category_daily_stats_mv
      WHERE day = (SELECT max_day FROM latest_day)
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
   * GET /api/market-data/macro/top-coins - Получить топ монеты
   */
  app.get("/api/market-data/macro/top-coins", async (c: Context) => {
    if (!clickhouse) {
      throw new NotFoundError("ClickHouse connection");
    }

    const categoryParam = c.req.query("category");
    const category =
      categoryParam && categoryParam !== "undefined" && categoryParam !== ""
        ? categoryParam
        : undefined;
    const limit = Number(c.req.query("limit") ?? DEFAULT_TOP_COINS_LIMIT);

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

  /**
   * GET /api/market-data/macro/categories/correlation - Correlation matrix категорий
   */
  app.get(
    "/api/market-data/macro/categories/correlation",
    async (c: Context) => {
      if (!clickhouse) {
        throw new NotFoundError("ClickHouse connection");
      }

      const days = Number(c.req.query("days") ?? "7");
      const limitDays = Math.min(days, MAX_CORRELATION_DAYS);

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
    }
  );

  /**
   * GET /api/market-data/macro/technicals - Получить технические макро метрики
   * Average Crypto RSI и Altseason Index
   */
  app.get("/api/market-data/macro/technicals", async (c: Context) => {
    const now = Date.now();
    if (macroTechnicalsCache && macroTechnicalsCache.expiresAt > now) {
      return c.json({
        success: true,
        data: macroTechnicalsCache.payload,
        cached: true,
      });
    }

    if (!clickhouse) {
      throw new NotFoundError("ClickHouse connection");
    }

    // Получаем список топ-коинов по последнему snapshot
    const latestResult = await clickhouse.query<{
      latest_timestamp: string;
    }>(`
      SELECT max(timestamp) as latest_timestamp
      FROM aladdin.top_coins
    `);

    const baseSymbols = new Set<string>();

    if (
      latestResult.length > 0 &&
      latestResult[0].latest_timestamp !== undefined
    ) {
      const latestTimestamp = latestResult[0].latest_timestamp;

      const coins = await clickhouse.query<{
        symbol: string;
        market_cap_rank: number;
      }>(
        `
        SELECT 
          symbol,
          market_cap_rank
        FROM aladdin.top_coins
        WHERE timestamp = {latestTimestamp:DateTime}
        ORDER BY market_cap_rank ASC
        LIMIT {limit:UInt32}
      `,
        {
          latestTimestamp,
          limit: TECHNICALS_SYMBOL_LIMIT,
        }
      );

      for (const coin of coins) {
        if (coin.symbol) {
          baseSymbols.add(coin.symbol.toUpperCase());
        }
      }
    }

    // Добавляем BTC в список обязательно
    baseSymbols.add("BTC");

    // Фильтруем стабильные монеты
    const filteredSymbols = Array.from(baseSymbols).filter(
      (symbol) => !STABLECOIN_SYMBOLS.has(symbol)
    );

    const candleLimit = Math.max(
      ALTSEASON_LOOKBACK_DAYS + 5,
      RSI_PERIOD + 5
    );

    const symbolData = new Map<
      string,
      {
        closes: number[];
        rsi: number | null;
      }
    >();

    for (const symbol of filteredSymbols) {
      const pair = toTradingPair(symbol);
      const closes = await fetchCandles(
        clickhouse,
        pair,
        DAILY_TIMEFRAME,
        candleLimit
      );

      if (closes.length === 0) {
        continue;
      }

      const rsi = calculateRsi(closes, RSI_PERIOD);

      symbolData.set(symbol, {
        closes,
        rsi,
      });
    }

    // Расчет среднего RSI
    const rsiValues = Array.from(symbolData.values())
      .map((data) => data.rsi)
      .filter((value): value is number => value !== null);

    const averageRsi =
      rsiValues.length > 0
        ? Number(
            (
              rsiValues.reduce((sum, value) => sum + value, 0) /
              rsiValues.length
            ).toFixed(1)
          )
        : null;

    // Расчет Altseason Index
    const btcData = symbolData.get("BTC");
    const btcReturn = btcData
      ? calculateReturn(btcData.closes, ALTSEASON_LOOKBACK_DAYS)
      : null;

    let altSeasonSample = 0;
    let altSeasonWinners = 0;

    if (btcReturn !== null) {
      for (const [symbol, data] of symbolData.entries()) {
        if (symbol === "BTC") continue;

        const performance = calculateReturn(
          data.closes,
          ALTSEASON_LOOKBACK_DAYS
        );

        if (performance === null) continue;

        altSeasonSample += 1;
        if (performance > btcReturn) {
          altSeasonWinners += 1;
        }
      }
    }

    const altseasonIndex =
      altSeasonSample > 0
        ? Number(
            ((altSeasonWinners / altSeasonSample) * 100).toFixed(1)
          )
        : null;

    const payload: MacroTechnicals = {
      timestamp: new Date().toISOString(),
      averageCryptoRsi: averageRsi,
      assetsCount: rsiValues.length,
      altseasonIndex,
      altseasonSample: altSeasonSample,
      baseAsset: toTradingPair("BTC"),
      lookbackDays: ALTSEASON_LOOKBACK_DAYS,
    };

    macroTechnicalsCache = {
      expiresAt: now + TECHNICALS_CACHE_TTL_MS,
      payload,
    };

    return c.json({
      success: true,
      data: payload,
    });
  });
}
