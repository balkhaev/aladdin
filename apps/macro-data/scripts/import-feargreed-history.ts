#!/usr/bin/env bun

/**
 * Скрипт для импорта исторических данных Fear & Greed Index
 * Использование: bun run scripts/import-feargreed-history.ts [days]
 */

import path from "node:path";
import { config } from "dotenv";
import { ClickHouseService } from "../../../packages/shared/src/clickhouse";

// Загружаем .env из корня проекта
config({ path: path.resolve(__dirname, "../.env") });

// Константы
const DEFAULT_DAYS = 365;
const DAYS_TO_IMPORT = Number(process.argv[2]) || DEFAULT_DAYS;
const DELAY_BETWEEN_REQUESTS = 1000;
const REQUEST_TIMEOUT_MS = 10_000;

// Типы
type FearGreedData = {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update: string;
};

type FearGreedResponse = {
  name: string;
  data: FearGreedData[];
  metadata: {
    error: null | string;
  };
};

// Инициализация ClickHouse
const clickhouse = new ClickHouseService({
  host: process.env.CLICKHOUSE_HOST || "http://localhost:8123",
  user: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "",
  database: process.env.CLICKHOUSE_DATABASE || "aladdin",
  request_timeout: 60_000,
});

/**
 * Получить исторические данные Fear & Greed Index
 */
async function fetchFearGreedHistory(limit: number): Promise<FearGreedData[]> {
  const apiUrl = "https://api.alternative.me";
  const url = `${apiUrl}/fng/?limit=${limit}`;

  console.log(`Fetching Fear & Greed history: ${limit} days...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Fear & Greed API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FearGreedResponse;

    if (data.metadata.error) {
      throw new Error(`Fear & Greed API error: ${data.metadata.error}`);
    }

    console.log(`Fetched ${data.data.length} Fear & Greed records`);
    return data.data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Failed to fetch Fear & Greed history:", error);
    throw error;
  }
}

/**
 * Импортировать данные в ClickHouse
 */
async function importData(data: FearGreedData[]): Promise<void> {
  console.log(`\nImporting ${data.length} records to ClickHouse...`);

  let imported = 0;
  let skipped = 0;

  for (const record of data) {
    try {
      const timestamp = Number.parseInt(record.timestamp, 10);
      const value = Number.parseInt(record.value, 10);
      const timeUntilUpdate = Number.parseInt(record.time_until_update, 10);

      // Validate timeUntilUpdate to avoid NaN/null
      const safeTimeUntilUpdate = Number.isFinite(timeUntilUpdate)
        ? timeUntilUpdate
        : 0;

      // Check if this timestamp already exists
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM aladdin.fear_greed_index
        WHERE timestamp = FROM_UNIXTIME(${timestamp})
      `;

      const existing = await clickhouse.query<{ count: number }>(checkQuery);

      if (existing.length > 0 && existing[0].count > 0) {
        skipped++;
        continue;
      }

      const insertQuery = `
        INSERT INTO aladdin.fear_greed_index (
          timestamp,
          value,
          classification,
          time_until_update
        ) VALUES (
          FROM_UNIXTIME(${timestamp}),
          ${value},
          '${record.value_classification}',
          ${safeTimeUntilUpdate}
        )
      `;

      await clickhouse.command(insertQuery);
      imported++;

      if (imported % 10 === 0) {
        console.log(`Imported ${imported} records...`);
      }

      // Небольшая задержка между запросами
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_REQUESTS)
      );
    } catch (error) {
      console.error(
        `Failed to import record for timestamp ${record.timestamp}:`,
        error
      );
    }
  }

  console.log(
    `\nImport completed: ${imported} imported, ${skipped} skipped (already exist)`
  );
}

/**
 * Основная функция
 */
async function main() {
  try {
    console.log("=== Fear & Greed Historical Data Import ===");
    console.log(`Days to import: ${DAYS_TO_IMPORT}`);
    console.log("\nConnecting to ClickHouse...");
    console.log(`Host: ${process.env.CLICKHOUSE_HOST}`);
    console.log(`Database: ${process.env.CLICKHOUSE_DATABASE}\n`);

    // Fetch data from Fear & Greed API
    const data = await fetchFearGreedHistory(DAYS_TO_IMPORT);

    if (data.length === 0) {
      console.log("No data to import");
      process.exit(0);
    }

    // Import data to ClickHouse
    await importData(data);

    console.log("\n✅ Import completed successfully!");
  } catch (error) {
    console.error("\n❌ Import failed:", error);
    process.exit(1);
  }
}

// Запускаем импорт
main();
