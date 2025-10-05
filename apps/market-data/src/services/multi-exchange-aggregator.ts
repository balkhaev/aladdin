import type { ClickHouseService } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { Tick } from "@aladdin/core";

type AggregatedPrice = {
  timestamp: number;
  symbol: string;
  vwap: number; // Volume Weighted Average Price
  binance_price: number | null;
  bybit_price: number | null;
  okx_price: number | null;
  binance_volume: number;
  bybit_volume: number;
  okx_volume: number;
  total_volume: number;
  avg_price: number;
  max_spread_percent: number;
  max_spread_exchange_high: string | null;
  max_spread_exchange_low: string | null;
  exchanges_count: number;
};

type ExchangeData = {
  price: number;
  volume: number;
  timestamp: number;
};

const AGGREGATION_INTERVAL_MS = 5000; // Агрегация каждые 5 секунд
const MAX_DATA_AGE_MS = 30_000; // Максимальный возраст данных 30 секунд
const HUNDRED_PERCENT = 100;

export class MultiExchangeAggregator {
  private exchangeData: Map<string, Map<string, ExchangeData>> = new Map(); // symbol -> exchange -> data
  private aggregationTimer: Timer | null = null;

  constructor(
    private clickhouse: ClickHouseService,
    private logger: Logger
  ) {}

  /**
   * Запуск агрегатора
   */
  start(): void {
    this.aggregationTimer = setInterval(() => {
      this.aggregateAndSave().catch((error) =>
        this.logger.error("Error aggregating prices", error)
      );
    }, AGGREGATION_INTERVAL_MS);

    this.logger.info("Multi-exchange aggregator started");
  }

  /**
   * Остановка агрегатора
   */
  stop(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    this.logger.info("Multi-exchange aggregator stopped");
  }

  /**
   * Добавить tick от биржи
   */
  addTick(tick: Tick): void {
    const { symbol, exchange, price, volume, timestamp } = tick;

    if (!this.exchangeData.has(symbol)) {
      this.exchangeData.set(symbol, new Map());
    }

    const symbolData = this.exchangeData.get(symbol);
    symbolData?.set(exchange, { price, volume, timestamp });
  }

  /**
   * Агрегация и сохранение данных
   */
  private async aggregateAndSave(): Promise<void> {
    const now = Date.now();
    const aggregatedPrices: AggregatedPrice[] = [];

    for (const [symbol, exchangeMap] of this.exchangeData.entries()) {
      // Удаляем устаревшие данные
      for (const [exchange, data] of exchangeMap.entries()) {
        if (now - data.timestamp > MAX_DATA_AGE_MS) {
          exchangeMap.delete(exchange);
        }
      }

      // Если нет данных, пропускаем
      if (exchangeMap.size === 0) {
        this.exchangeData.delete(symbol);
        continue;
      }

      // Агрегируем данные
      const aggregated = this.aggregateSymbol(symbol, exchangeMap);
      if (aggregated) {
        aggregatedPrices.push(aggregated);
      }
    }

    // Сохраняем в ClickHouse
    if (aggregatedPrices.length > 0) {
      await this.saveAggregatedPrices(aggregatedPrices);
    }
  }

  /**
   * Агрегация данных для одного символа
   */
  private aggregateSymbol(
    symbol: string,
    exchangeMap: Map<string, ExchangeData>
  ): AggregatedPrice | null {
    const prices: number[] = [];
    const volumes: number[] = [];
    const exchangePrices: Map<string, number> = new Map();

    let binance_price: number | null = null;
    let bybit_price: number | null = null;
    let okx_price: number | null = null;
    let binance_volume = 0;
    let bybit_volume = 0;
    let okx_volume = 0;

    // Собираем данные с каждой биржи
    for (const [exchange, data] of exchangeMap.entries()) {
      prices.push(data.price);
      volumes.push(data.volume);
      exchangePrices.set(exchange, data.price);

      if (exchange === "binance") {
        binance_price = data.price;
        binance_volume = data.volume;
      } else if (exchange === "bybit") {
        bybit_price = data.price;
        bybit_volume = data.volume;
      } else if (exchange === "okx") {
        okx_price = data.price;
        okx_volume = data.volume;
      }
    }

    if (prices.length === 0) {
      return null;
    }

    // Вычисляем VWAP (Volume Weighted Average Price)
    const totalVolume = volumes.reduce((sum, v) => sum + v, 0);
    const vwap =
      totalVolume > 0
        ? prices.reduce((sum, price, idx) => sum + price * volumes[idx], 0) /
          totalVolume
        : prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Средняя цена
    const avg_price = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    // Находим максимальный спред
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const max_spread_percent =
      ((maxPrice - minPrice) / minPrice) * HUNDRED_PERCENT;

    // Находим биржи с max и min ценами
    let max_spread_exchange_high: string | null = null;
    let max_spread_exchange_low: string | null = null;

    for (const [exchange, price] of exchangePrices.entries()) {
      if (price === maxPrice) {
        max_spread_exchange_high = exchange;
      }
      if (price === minPrice) {
        max_spread_exchange_low = exchange;
      }
    }

    return {
      timestamp: Date.now(),
      symbol,
      vwap,
      binance_price,
      bybit_price,
      okx_price,
      binance_volume,
      bybit_volume,
      okx_volume,
      total_volume: totalVolume,
      avg_price,
      max_spread_percent,
      max_spread_exchange_high,
      max_spread_exchange_low,
      exchanges_count: exchangeMap.size,
    };
  }

  /**
   * Сохранение агрегированных цен в ClickHouse
   */
  private async saveAggregatedPrices(prices: AggregatedPrice[]): Promise<void> {
    try {
      const query = `
        INSERT INTO aladdin.aggregated_prices (
          timestamp,
          symbol,
          vwap,
          binance_price,
          bybit_price,
          okx_price,
          binance_volume,
          bybit_volume,
          okx_volume,
          total_volume,
          avg_price,
          max_spread_percent,
          max_spread_exchange_high,
          max_spread_exchange_low,
          exchanges_count
        ) VALUES
      `;

      const values = prices
        .map(
          (p) =>
            `(
          ${p.timestamp},
          '${p.symbol}',
          ${p.vwap},
          ${p.binance_price ?? "NULL"},
          ${p.bybit_price ?? "NULL"},
          ${p.okx_price ?? "NULL"},
          ${p.binance_volume},
          ${p.bybit_volume},
          ${p.okx_volume},
          ${p.total_volume},
          ${p.avg_price},
          ${p.max_spread_percent},
          ${p.max_spread_exchange_high ? `'${p.max_spread_exchange_high}'` : "NULL"},
          ${p.max_spread_exchange_low ? `'${p.max_spread_exchange_low}'` : "NULL"},
          ${p.exchanges_count}
        )`
        )
        .join(",");

      await this.clickhouse.command(query + values);

      this.logger.debug("Saved aggregated prices", { count: prices.length });
    } catch (error) {
      this.logger.error("Failed to save aggregated prices", error);
    }
  }

  /**
   * Получить последние агрегированные цены
   */
  async getAggregatedPrices(
    symbols: string[],
    limit = 1
  ): Promise<AggregatedPrice[]> {
    try {
      const symbolList = symbols.map((s) => `'${s}'`).join(",");
      const query = `
        SELECT 
          timestamp,
          symbol,
          vwap,
          binance_price,
          bybit_price,
          okx_price,
          binance_volume,
          bybit_volume,
          okx_volume,
          total_volume,
          avg_price,
          max_spread_percent,
          max_spread_exchange_high,
          max_spread_exchange_low,
          exchanges_count
        FROM aladdin.aggregated_prices
        WHERE symbol IN (${symbolList})
        ORDER BY timestamp DESC
        LIMIT ${limit * symbols.length}
      `;

      const result = await this.clickhouse.query<{
        timestamp: string;
        symbol: string;
        vwap: string;
        binance_price: string | null;
        bybit_price: string | null;
        okx_price: string | null;
        binance_volume: string;
        bybit_volume: string;
        okx_volume: string;
        total_volume: string;
        avg_price: string;
        max_spread_percent: string;
        max_spread_exchange_high: string | null;
        max_spread_exchange_low: string | null;
        exchanges_count: number;
      }>(query);

      return result.map((row) => ({
        timestamp: Number.parseInt(row.timestamp, 10),
        symbol: row.symbol,
        vwap: Number.parseFloat(row.vwap),
        binance_price: row.binance_price
          ? Number.parseFloat(row.binance_price)
          : null,
        bybit_price: row.bybit_price
          ? Number.parseFloat(row.bybit_price)
          : null,
        okx_price: row.okx_price ? Number.parseFloat(row.okx_price) : null,
        binance_volume: Number.parseFloat(row.binance_volume),
        bybit_volume: Number.parseFloat(row.bybit_volume),
        okx_volume: Number.parseFloat(row.okx_volume),
        total_volume: Number.parseFloat(row.total_volume),
        avg_price: Number.parseFloat(row.avg_price),
        max_spread_percent: Number.parseFloat(row.max_spread_percent),
        max_spread_exchange_high: row.max_spread_exchange_high,
        max_spread_exchange_low: row.max_spread_exchange_low,
        exchanges_count: row.exchanges_count,
      }));
    } catch (error) {
      this.logger.error("Failed to fetch aggregated prices", error);
      return [];
    }
  }

  /**
   * Получить арбитражные возможности
   */
  async getArbitrageOpportunities(
    minSpreadPercent = 0.1,
    limit = 20
  ): Promise<
    Array<{
      symbol: string;
      spread_percent: number;
      high_exchange: string;
      low_exchange: string;
      high_price: number;
      low_price: number;
      vwap: number;
      total_volume: number;
      timestamp: number;
    }>
  > {
    try {
      const query = `
        SELECT 
          symbol,
          max_spread_percent AS spread_percent,
          max_spread_exchange_high AS high_exchange,
          max_spread_exchange_low AS low_exchange,
          CASE 
            WHEN max_spread_exchange_high = 'binance' THEN binance_price
            WHEN max_spread_exchange_high = 'bybit' THEN bybit_price
            WHEN max_spread_exchange_high = 'okx' THEN okx_price
          END AS high_price,
          CASE 
            WHEN max_spread_exchange_low = 'binance' THEN binance_price
            WHEN max_spread_exchange_low = 'bybit' THEN bybit_price
            WHEN max_spread_exchange_low = 'okx' THEN okx_price
          END AS low_price,
          vwap,
          total_volume,
          timestamp
        FROM aladdin.aggregated_prices
        WHERE timestamp > now() - INTERVAL 5 MINUTE
          AND max_spread_percent >= ${minSpreadPercent}
          AND exchanges_count >= 2
        ORDER BY max_spread_percent DESC
        LIMIT ${limit}
      `;

      const result = await this.clickhouse.query<{
        symbol: string;
        spread_percent: string;
        high_exchange: string;
        low_exchange: string;
        high_price: string;
        low_price: string;
        vwap: string;
        total_volume: string;
        timestamp: string;
      }>(query);

      return result.map((row) => ({
        symbol: row.symbol,
        spread_percent: Number.parseFloat(row.spread_percent),
        high_exchange: row.high_exchange,
        low_exchange: row.low_exchange,
        high_price: Number.parseFloat(row.high_price),
        low_price: Number.parseFloat(row.low_price),
        vwap: Number.parseFloat(row.vwap),
        total_volume: Number.parseFloat(row.total_volume),
        timestamp: Number.parseInt(row.timestamp, 10),
      }));
    } catch (error) {
      this.logger.error("Failed to fetch arbitrage opportunities", error);
      return [];
    }
  }
}
