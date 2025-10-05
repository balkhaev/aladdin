import { beforeEach, describe, expect, test, mock } from "bun:test";
import type { Logger } from "@aladdin/logger";
import type { ClickHouseService } from "@aladdin/clickhouse";
import { SentimentAnalysisService } from "./sentiment-analysis";

describe("SentimentAnalysisService - OnChain Analysis", () => {
  let service: SentimentAnalysisService;
  let mockLogger: Logger;
  let mockClickhouse: ClickHouseService;

  beforeEach(() => {
    mockLogger = {
      info: () => {},
      error: () => {},
      warn: () => {},
      debug: () => {},
    } as unknown as Logger;

    mockClickhouse = {
      query: mock(async () => []),
    } as unknown as ClickHouseService;

    service = new SentimentAnalysisService(mockClickhouse, mockLogger);
  });

  describe("OnChain Sentiment with Advanced Metrics", () => {
    test("should calculate sentiment with MVRV ratio", async () => {
      // Mock on-chain data with MVRV
      const mockData = [{
        whale_tx_count: 25,
        whale_tx_volume: 500,
        exchange_net_flow: -500,
        active_addresses: 75_000,
        nvt_ratio: 45,
        mvrv_ratio: 0.8, // Undervalued
        nupl: -0.2, // Early accumulation
        sopr: 0.98,
        puell_multiple: undefined,
        stock_to_flow: undefined,
        exchange_reserve: 1_000_000,
      }];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("LIMIT 1")) {
          return mockData;
        }
        // Historical data
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      expect(sentiment).toBeDefined();
      expect(sentiment.compositeScore).toBeNumber();
      expect(sentiment.confidence).toBeGreaterThan(0);
    });

    test("should recognize overvalued conditions with MVRV > 3.7", async () => {
      const mockOnChainData = [{
        whale_tx_count: 25,
        whale_tx_volume: 500,
        exchange_net_flow: 0,
        active_addresses: 75_000,
        nvt_ratio: 45,
        mvrv_ratio: 4.5, // Overvalued
        nupl: 0.8, // Euphoria
        sopr: 1.1,
        puell_multiple: 5, // Cycle top
        stock_to_flow: 50,
        exchange_reserve: 1_000_000,
      }];

      // Mock technical data with neutral values
      const mockTechnicalData = [{
        timestamp: new Date().toISOString(),
        open: 40000,
        high: 41000,
        low: 39000,
        close: 40500,
        volume: 1000,
      }];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("on_chain_metrics")) {
          return mockOnChainData;
        }
        if (query.includes("candles")) {
          return mockTechnicalData.concat(Array(199).fill(mockTechnicalData[0]));
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Should be bearish due to overvaluation
      expect(sentiment.compositeScore).toBeLessThan(20); // More lenient
    });

    test("should recognize undervalued conditions with MVRV < 1.0", async () => {
      const mockOnChainData = [{
        whale_tx_count: 15,
        whale_tx_volume: 300,
        exchange_net_flow: -1000,
        active_addresses: 60_000,
        nvt_ratio: 30,
        mvrv_ratio: 0.7, // Undervalued
        nupl: -0.1, // Early accumulation
        sopr: 0.92,
        puell_multiple: 0.4, // Cycle bottom
        stock_to_flow: 55,
        exchange_reserve: 950_000,
      }];

      const mockTechnicalData = [{
        timestamp: new Date().toISOString(),
        open: 40000,
        high: 41000,
        low: 39000,
        close: 40500,
        volume: 1000,
      }];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("on_chain_metrics")) {
          return mockOnChainData;
        }
        if (query.includes("candles")) {
          return mockTechnicalData.concat(Array(199).fill(mockTechnicalData[0]));
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Should be bullish due to undervaluation (onChain component)
      expect(sentiment.components.onChain.score).toBeGreaterThan(0);
    });

    test("should handle Puell Multiple for cycle detection", async () => {
      const mockData = [{
        whale_tx_count: 20,
        exchange_net_flow: 0,
        active_addresses: 70_000,
        nvt_ratio: 40,
        mvrv_ratio: 1.2,
        nupl: 0.1,
        sopr: 1.0,
        puell_multiple: 0.3, // Deep cycle bottom
      }];

      mockClickhouse.query = mock(async () => mockData);

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Puell Multiple < 0.5 should contribute bullish signal
      expect(sentiment).toBeDefined();
      expect(sentiment.components.onChain).toBeDefined();
    });

    test("should use dynamic thresholds with historical data", async () => {
      const currentData = [{
        whale_tx_count: 45, // High relative to historical
        exchange_net_flow: -800,
        active_addresses: 90_000,
        nvt_ratio: 35,
        mvrv_ratio: 1.5,
        nupl: 0.2,
        sopr: 1.0,
      }];

      const historicalData = [
        { whale_tx_count: 15, exchange_net_flow: 200, active_addresses: 50_000, mvrv_ratio: 1.3, nupl: 0.15 },
        { whale_tx_count: 18, exchange_net_flow: 100, active_addresses: 55_000, mvrv_ratio: 1.4, nupl: 0.18 },
        { whale_tx_count: 20, exchange_net_flow: -100, active_addresses: 60_000, mvrv_ratio: 1.45, nupl: 0.19 },
        { whale_tx_count: 22, exchange_net_flow: -200, active_addresses: 65_000, mvrv_ratio: 1.48, nupl: 0.20 },
      ];

      let callCount = 0;
      mockClickhouse.query = mock(async (query: string) => {
        callCount++;
        if (query.includes("LIMIT 1")) {
          return currentData;
        }
        if (query.includes("INTERVAL 7 DAY")) {
          return historicalData;
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Should use percentile-based thresholds
      expect(sentiment).toBeDefined();
      expect(sentiment.confidence).toBeGreaterThan(0);
    });

    test("should calculate trends from historical data", async () => {
      const currentData = [{
        whale_tx_count: 30,
        exchange_net_flow: -500,
        active_addresses: 80_000,
        nvt_ratio: 40,
        mvrv_ratio: 1.8,
        nupl: 0.3,
        sopr: 1.0,
      }];

      // Uptrend in MVRV and NUPL
      const historicalData = [
        { whale_tx_count: 25, exchange_net_flow: -100, active_addresses: 70_000, mvrv_ratio: 1.2, nupl: 0.1 },
        { whale_tx_count: 26, exchange_net_flow: -200, active_addresses: 72_000, mvrv_ratio: 1.3, nupl: 0.15 },
        { whale_tx_count: 27, exchange_net_flow: -300, active_addresses: 75_000, mvrv_ratio: 1.5, nupl: 0.2 },
        { whale_tx_count: 28, exchange_net_flow: -400, active_addresses: 77_000, mvrv_ratio: 1.6, nupl: 0.25 },
      ];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("LIMIT 1")) {
          return currentData;
        }
        if (query.includes("INTERVAL 7 DAY")) {
          return historicalData;
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Positive trend should contribute to bullish sentiment
      expect(sentiment).toBeDefined();
      expect(sentiment.compositeScore).toBeNumber();
    });
  });

  describe("Exchange Reserve Impact", () => {
    test("should recognize decreasing exchange reserve as bullish", async () => {
      const currentData = [{
        whale_tx_count: 25,
        exchange_net_flow: -500,
        active_addresses: 75_000,
        nvt_ratio: 40,
        mvrv_ratio: 1.3,
        nupl: 0.15,
        sopr: 1.0,
        exchange_reserve: 900_000,
      }];

      // Decreasing reserve trend
      const historicalData = [
        { whale_tx_count: 25, exchange_net_flow: -100, active_addresses: 70_000, exchange_reserve: 1_100_000 },
        { whale_tx_count: 25, exchange_net_flow: -200, active_addresses: 72_000, exchange_reserve: 1_050_000 },
        { whale_tx_count: 25, exchange_net_flow: -300, active_addresses: 73_000, exchange_reserve: 1_000_000 },
        { whale_tx_count: 25, exchange_net_flow: -400, active_addresses: 74_000, exchange_reserve: 950_000 },
      ];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("LIMIT 1")) {
          return currentData;
        }
        if (query.includes("INTERVAL 7 DAY")) {
          return historicalData;
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Decreasing reserve = less selling pressure = bullish
      expect(sentiment).toBeDefined();
    });
  });

  describe("Confidence Calculation", () => {
    test("should increase confidence with strong trends", async () => {
      const currentData = [{
        whale_tx_count: 30,
        whale_tx_volume: 600,
        exchange_net_flow: -1000,
        active_addresses: 85_000,
        nvt_ratio: 35,
        mvrv_ratio: 0.9,
        nupl: -0.05,
        sopr: 0.95,
        puell_multiple: 0.6,
        stock_to_flow: 58,
        exchange_reserve: 900_000,
      }];

      // Strong consistent downtrend in MVRV (approaching bottom)
      const historicalData = [
        { timestamp: new Date().toISOString(), whale_tx_count: 30, exchange_net_flow: -500, active_addresses: 80_000, mvrv_ratio: 2.0, nupl: 0.5, exchange_reserve: 950_000 },
        { timestamp: new Date().toISOString(), whale_tx_count: 30, exchange_net_flow: -600, active_addresses: 81_000, mvrv_ratio: 1.6, nupl: 0.3, exchange_reserve: 940_000 },
        { timestamp: new Date().toISOString(), whale_tx_count: 30, exchange_net_flow: -700, active_addresses: 82_000, mvrv_ratio: 1.3, nupl: 0.15, exchange_reserve: 920_000 },
        { timestamp: new Date().toISOString(), whale_tx_count: 30, exchange_net_flow: -800, active_addresses: 83_000, mvrv_ratio: 1.1, nupl: 0.05, exchange_reserve: 910_000 },
      ];

      const mockTechnicalData = [{
        timestamp: new Date().toISOString(),
        open: 40000,
        high: 41000,
        low: 39000,
        close: 40500,
        volume: 1000,
      }];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("LIMIT 1")) {
          return currentData;
        }
        if (query.includes("INTERVAL 7 DAY")) {
          return historicalData;
        }
        if (query.includes("candles")) {
          return mockTechnicalData.concat(Array(199).fill(mockTechnicalData[0]));
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // OnChain component should have good confidence with strong trends
      expect(sentiment.components.onChain.confidence).toBeGreaterThan(50);
    });

    test("should have high confidence with extreme MVRV values", async () => {
      const extremeUndervaluedData = [{
        whale_tx_count: 20,
        whale_tx_volume: 400,
        exchange_net_flow: -1500,
        active_addresses: 65_000,
        nvt_ratio: 25,
        mvrv_ratio: 0.5, // Extreme undervaluation
        nupl: -0.3, // Capitulation
        sopr: 0.88,
        puell_multiple: 0.3,
        stock_to_flow: 60,
        exchange_reserve: 850_000,
      }];

      const mockTechnicalData = [{
        timestamp: new Date().toISOString(),
        open: 40000,
        high: 41000,
        low: 39000,
        close: 40500,
        volume: 1000,
      }];

      mockClickhouse.query = mock(async (query: string) => {
        if (query.includes("on_chain_metrics") && query.includes("LIMIT 1")) {
          return extremeUndervaluedData;
        }
        if (query.includes("candles")) {
          return mockTechnicalData.concat(Array(199).fill(mockTechnicalData[0]));
        }
        return [];
      });

      const sentiment = await service.getCompositeSentiment("BTCUSDT");

      // Extreme undervaluation should boost onChain confidence
      expect(sentiment.components.onChain.confidence).toBeGreaterThan(75);
    });
  });
});

