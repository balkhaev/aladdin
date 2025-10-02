#!/usr/bin/env bun

/**
 * Скрипт для импорта исторических свечей с Binance в ClickHouse
 * Использование: bun run scripts/import-historical-candles.ts [symbol] [timeframe] [days]
 */

import path from "node:path";
import type { Candle } from "@aladdin/shared/types";
import { config } from "dotenv";
import { ClickHouseService } from "../../../packages/shared/src/clickhouse";

// Загружаем .env из корня проекта
config({ path: path.resolve(__dirname, "../../../.env") });

const MILLISECONDS_TO_SECONDS = 1000;
const DELAY_BETWEEN_REQUESTS = 200; // 200ms между запросами
const MAX_CANDLES_PER_REQUEST = 1000; // Binance лимит

// Получаем параметры из командной строки
const symbol = process.argv[2]?.toUpperCase() || "BTCUSDT";
const timeframe = process.argv[3] || "15m";
const days = Number(process.argv[4]) || 7;

// Маппинг timeframe в миллисекунды
const TIMEFRAME_MS: Record<string, number> = {
  "1m": 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCandlesFromBinance(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${MAX_CANDLES_PER_REQUEST}`;

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

  return data.map((item) => ({
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
}

async function main() {
  console.log("🚀 Импорт исторических свечей с Binance");
  console.log(`📊 Символ: ${symbol}`);
  console.log(`⏱️ Таймфрейм: ${timeframe}`);
  console.log(`📅 Дней: ${days}`);
  console.log("");

  const clickhouse = new ClickHouseService({
    host: process.env.CLICKHOUSE_HOST || "localhost",
    port: process.env.CLICKHOUSE_PORT
      ? Number(process.env.CLICKHOUSE_PORT)
      : undefined,
    username: process.env.CLICKHOUSE_USER || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
    database: process.env.CLICKHOUSE_DATABASE || "aladdin",
  });

  console.log("✅ Подключение к ClickHouse установлено");
  console.log("");

  const timeframeMs = TIMEFRAME_MS[timeframe];
  if (!timeframeMs) {
    console.error(`❌ Неизвестный таймфрейм: ${timeframe}`);
    process.exit(1);
  }

  // Вычисляем временные рамки
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;

  // Количество свечей, которое мы ожидаем получить
  const expectedCandles = Math.floor((endTime - startTime) / timeframeMs);
  console.log(`📈 Ожидается примерно ${expectedCandles} свечей`);
  console.log("");

  let totalCandles = 0;
  let requestCount = 0;
  let currentStartTime = startTime;

  // Загружаем данные порциями
  while (currentStartTime < endTime) {
    requestCount++;
    const currentEndTime = Math.min(
      currentStartTime + MAX_CANDLES_PER_REQUEST * timeframeMs,
      endTime
    );

    try {
      console.log(
        `📥 [${requestCount}] Запрос свечей с ${new Date(currentStartTime).toISOString()} по ${new Date(currentEndTime).toISOString()}...`
      );

      const candles = await fetchCandlesFromBinance(
        symbol,
        timeframe,
        currentStartTime,
        currentEndTime
      );

      if (candles.length > 0) {
        // Фильтруем пустые свечи
        const validCandles = candles.filter(
          (c) => c.volume > 0 && c.trades > 0
        );

        if (validCandles.length > 0) {
          await clickhouse.insert("candles", validCandles);
          totalCandles += validCandles.length;
          console.log(
            `✅ Сохранено ${validCandles.length} свечей (пропущено пустых: ${candles.length - validCandles.length})`
          );
        } else {
          console.log(`⚠️ Все ${candles.length} свечей пустые, пропущено`);
        }

        // Двигаемся к следующему интервалу на основе последней полученной свечи
        const lastCandleTime = candles[candles.length - 1].timestamp * 1000;
        currentStartTime = lastCandleTime + timeframeMs;
      } else {
        console.log("⚠️ Нет данных, переход к следующему интервалу");
        currentStartTime = currentEndTime;
      }

      // Задержка между запросами
      if (currentStartTime < endTime) {
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      console.error(
        `❌ Ошибка при загрузке данных с ${new Date(currentStartTime).toISOString()}:`,
        error
      );
      // Переходим к следующему интервалу даже при ошибке
      currentStartTime = currentEndTime;
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  console.log("");
  console.log("=".repeat(50));
  console.log("✅ Импорт завершен!");
  console.log(`📊 Всего запросов: ${requestCount}`);
  console.log(`📈 Всего свечей импортировано: ${totalCandles}`);
  console.log(`⏱️ Ожидалось примерно: ${expectedCandles}`);
  console.log(
    `📉 Процент охвата: ${Math.round((totalCandles / expectedCandles) * 100)}%`
  );
  console.log("=".repeat(50));

  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Ошибка:", error);
  process.exit(1);
});
