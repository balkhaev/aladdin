import type { Logger } from "@aladdin/logger";
import type { Candle } from "@aladdin/core";
import type { SymbolInfo } from "../types";

const MILLISECONDS_TO_SECONDS = 1000;

export class BinanceAPI {
  private apiUrl: string;

  constructor(
    private logger: Logger,
    apiUrl = "https://api.binance.com"
  ) {
    this.apiUrl = apiUrl;
  }

  /**
   * Получить список всех торговых пар
   */
  async getAllSymbols(): Promise<SymbolInfo[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v3/exchangeInfo`);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        symbols: Array<{
          symbol: string;
          baseAsset: string;
          quoteAsset: string;
          status: string;
          isSpotTradingAllowed: boolean;
          isMarginTradingAllowed: boolean;
        }>;
      };

      // Фильтруем только активные USDT пары для упрощения
      const symbols = data.symbols
        .filter(
          (s) =>
            s.status === "TRADING" &&
            s.isSpotTradingAllowed &&
            s.quoteAsset === "USDT"
        )
        .map((s) => ({
          symbol: s.symbol,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          status: s.status,
          isSpotTradingAllowed: s.isSpotTradingAllowed,
          isMarginTradingAllowed: s.isMarginTradingAllowed,
        }));

      this.logger.info("Fetched symbols from Binance", {
        total: data.symbols.length,
        usdtPairs: symbols.length,
      });

      return symbols;
    } catch (error) {
      this.logger.error("Failed to fetch symbols from Binance", error);
      throw error;
    }
  }

  /**
   * Получить исторические свечи для символа
   */
  async getCandles(
    symbol: string,
    interval: string,
    limit = 100
  ): Promise<Candle[]> {
    try {
      const url = `${this.apiUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as [
        number, // 0: Open time
        string, // 1: Open
        string, // 2: High
        string, // 3: Low
        string, // 4: Close
        string, // 5: Volume
        number, // 6: Close time
        string, // 7: Quote asset volume
        number, // 8: Number of trades
        string, // 9: Taker buy base asset volume
        string, // 10: Taker buy quote asset volume
        string, // 11: Ignore
      ][];

      const candles: Candle[] = data.map((item) => ({
        timestamp: Math.floor(item[0] / MILLISECONDS_TO_SECONDS),
        symbol,
        timeframe: interval,
        open: Number.parseFloat(item[1]),
        high: Number.parseFloat(item[2]),
        low: Number.parseFloat(item[3]),
        close: Number.parseFloat(item[4]),
        volume: Number.parseFloat(item[5]),
        quoteVolume: Number.parseFloat(item[7]),
        trades: item[8],
        exchange: "binance",
      }));

      return candles;
    } catch (error) {
      this.logger.error("Failed to fetch candles from Binance", {
        symbol,
        interval,
        error,
      });
      throw error;
    }
  }

  /**
   * Получить 24h статистику по символу
   */
  async get24hStats(symbol: string): Promise<{
    priceChange: number;
    priceChangePercent: number;
    lastPrice: number;
    volume: number;
    quoteVolume: number;
  }> {
    try {
      const url = `${this.apiUrl}/api/v3/ticker/24hr?symbol=${symbol}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        priceChange: string;
        priceChangePercent: string;
        lastPrice: string;
        volume: string;
        quoteVolume: string;
      };

      return {
        priceChange: Number.parseFloat(data.priceChange),
        priceChangePercent: Number.parseFloat(data.priceChangePercent),
        lastPrice: Number.parseFloat(data.lastPrice),
        volume: Number.parseFloat(data.volume),
        quoteVolume: Number.parseFloat(data.quoteVolume),
      };
    } catch (error) {
      this.logger.error("Failed to fetch 24h stats from Binance", {
        symbol,
        error,
      });
      throw error;
    }
  }
}
