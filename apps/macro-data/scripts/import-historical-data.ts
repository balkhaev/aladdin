#!/usr/bin/env bun

/**
 * Скрипт для импорта исторических данных top_coins из CoinGecko
 * Использование: bun run scripts/import-historical-data.ts [days]
 */

import path from "node:path";
import { config } from "dotenv";
import { ClickHouseService } from "../../../packages/shared/src/clickhouse";

// Загружаем .env из корня проекта
config({ path: path.resolve(__dirname, "../.env") });

console.log(process.env.CLICKHOUSE_HOST);
console.log(process.env.CLICKHOUSE_USER);
console.log(process.env.CLICKHOUSE_PASSWORD);
console.log(process.env.CLICKHOUSE_DATABASE);
console.log(process.env.COINGECKO_API_KEY);
console.log(process.env.COINGECKO_API_URL);

// Константы
const DEFAULT_DAYS = 30;
const DAYS_TO_IMPORT = Number(process.argv[2]) || DEFAULT_DAYS;
const COINS_LIMIT = 100;
const DELAY_BETWEEN_REQUESTS = 12_000; // 12 секунд = 5 запросов/минуту (безопасно для free tier)
const DELAY_DIVISOR = 1000; // Для конвертации мс в секунды
const NOON_HOUR = 12; // Полдень
const ZERO_MINUTES = 0;
const ZERO_SECONDS = 0;
const ZERO_MS = 0;
const FIRST_ARRAY_ELEMENT = 0;
const TIMESTAMP_ISO_LENGTH = 19;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_API_URL =
  process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";

// Типы
type CoinData = {
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

// Категоризация токенов (из CoinGeckoProvider)
function categorizeToken(id: string): string | null {
  const defi = [
    "uniswap",
    "aave",
    "curve-dao-token",
    "compound-governance-token",
    "maker",
    "sushi",
    "pancakeswap-token",
  ];

  const layer1 = [
    "ethereum",
    "binancecoin",
    "solana",
    "cardano",
    "avalanche-2",
    "polkadot",
    "near",
    "cosmos",
    "algorand",
    "hedera-hashgraph",
    "aptos",
    "sui",
  ];

  const layer2 = [
    "polygon",
    "optimism",
    "arbitrum",
    "immutablex",
    "starknet",
    "loopring",
  ];

  const meme = ["dogecoin", "shiba-inu", "pepe", "floki", "bonk", "dogwifcoin"];

  if (defi.includes(id)) return "DeFi";
  if (layer1.includes(id)) return "Layer 1";
  if (layer2.includes(id)) return "Layer 2";
  if (meme.includes(id)) return "Meme";

  return null;
}

function getSector(): string | null {
  // Упрощенная версия - можно расширить
  return null;
}

// Утилита для безопасных чисел
function safeNumber(value: number): string {
  if (!Number.isFinite(value)) return "NULL";
  return value.toString();
}

// Функция задержки
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Запрос к CoinGecko API
async function fetchCoinGeckoData(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<unknown> {
  const url = new URL(`${COINGECKO_API_URL}${endpoint}`);

  // Добавляем параметры
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  // Добавляем API ключ если есть
  if (COINGECKO_API_KEY) {
    url.searchParams.append("x_cg_pro_api_key", COINGECKO_API_KEY);
  }

  console.log(`📡 Запрос: ${url.pathname}${url.search}`);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `CoinGecko API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

// Получить топ монеты
async function getTopCoins(limit: number): Promise<CoinData[]> {
  const data = (await fetchCoinGeckoData("/coins/markets", {
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: limit.toString(),
    page: "1",
    sparkline: "false",
    price_change_percentage: "7d",
  })) as Array<{
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number | null;
    total_volume: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d_in_currency: number;
    market_cap_change_percentage_24h: number;
  }>;

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
    category: categorizeToken(coin.id),
    sector: getSector(),
  }));
}

// Вставить данные в ClickHouse
async function insertCoins(
  clickhouse: ClickHouseService,
  coins: CoinData[],
  timestamp: Date
): Promise<void> {
  const timestampStr = timestamp
    .toISOString()
    .replace("T", " ")
    .slice(FIRST_ARRAY_ELEMENT, TIMESTAMP_ISO_LENGTH);

  for (const coin of coins) {
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
      ) VALUES (
        '${timestampStr}',
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
      )
    `;

    await clickhouse.command(query);
  }
}

// Главная функция
async function main() {
  console.log("🚀 Импорт исторических данных из CoinGecko");
  console.log(`📅 Дней для импорта: ${DAYS_TO_IMPORT}`);
  console.log(`🪙 Монет на запрос: ${COINS_LIMIT}`);
  console.log(
    `⏱️ Задержка между запросами: ${DELAY_BETWEEN_REQUESTS / DELAY_DIVISOR}с`
  );
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

  let successCount = 0;
  let errorCount = 0;

  // Импортируем данные за каждый день
  for (let i = DAYS_TO_IMPORT - 1; i >= 0; i--) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - i);
    targetDate.setHours(NOON_HOUR, ZERO_MINUTES, ZERO_SECONDS, ZERO_MS); // Полдень каждого дня

    const dateStr = targetDate.toISOString().split("T")[FIRST_ARRAY_ELEMENT];

    try {
      console.log(
        `📥 [${DAYS_TO_IMPORT - i}/${DAYS_TO_IMPORT}] Импорт данных за ${dateStr}...`
      );

      // Получаем данные
      const coins = await getTopCoins(COINS_LIMIT);

      // Вставляем в ClickHouse
      await insertCoins(clickhouse, coins, targetDate);

      successCount++;
      console.log(
        `✅ Успешно импортировано ${coins.length} монет за ${dateStr}`
      );

      // Показываем категории
      const categories = coins.reduce(
        (acc, coin) => {
          if (coin.category) {
            acc[coin.category] = (acc[coin.category] || 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>
      );
      console.log("   Категории:", categories);
      console.log("");

      // Задержка перед следующим запросом (кроме последнего)
      if (i > 0) {
        console.log(
          `⏳ Ожидание ${DELAY_BETWEEN_REQUESTS / DELAY_DIVISOR}с...`
        );
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Ошибка при импорте данных за ${dateStr}:`, error);

      // Продолжаем со следующей датой
      if (i > 0) {
        console.log(
          `⏳ Ожидание ${DELAY_BETWEEN_REQUESTS / DELAY_DIVISOR}с перед следующей попыткой...`
        );
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }
  }

  const SEPARATOR_LENGTH = 50;
  console.log("");
  console.log("=".repeat(SEPARATOR_LENGTH));
  console.log("📊 Итоги импорта:");
  console.log(`✅ Успешно: ${successCount} дней`);
  console.log(`❌ Ошибок: ${errorCount}`);
  console.log("=".repeat(SEPARATOR_LENGTH));

  // Проверяем результат
  console.log("");
  console.log("🔍 Проверка данных в ClickHouse...");

  const statsQuery = `
    SELECT 
      count(*) as total_records,
      count(DISTINCT toDate(timestamp)) as unique_days,
      count(DISTINCT category) as unique_categories,
      min(toDate(timestamp)) as earliest_date,
      max(toDate(timestamp)) as latest_date
    FROM aladdin.top_coins
    WHERE category IS NOT NULL AND category != ''
  `;

  const stats = await clickhouse.query(statsQuery);
  console.log("");
  console.log("📈 Статистика:");
  console.log(`   Всего записей: ${stats[0].total_records}`);
  console.log(`   Уникальных дней: ${stats[0].unique_days}`);
  console.log(`   Категорий: ${stats[0].unique_categories}`);
  console.log(`   Период: ${stats[0].earliest_date} → ${stats[0].latest_date}`);
  console.log("");

  const categoriesQuery = `
    SELECT 
      category,
      count(*) as count
    FROM aladdin.top_coins
    WHERE category IS NOT NULL AND category != ''
    GROUP BY category
    ORDER BY count DESC
  `;

  const categoryStats = await clickhouse.query<{
    category: string;
    count: number;
  }>(categoriesQuery);
  console.log("📊 Распределение по категориям:");
  for (const cat of categoryStats) {
    console.log(`   ${cat.category}: ${cat.count} записей`);
  }

  console.log("");
  console.log("✅ Импорт завершен!");
  console.log("");
  console.log("💡 Следующие шаги:");
  console.log("   1. Перезапустите frontend для обновления данных");
  console.log(
    "   2. Проверьте Correlation Matrix - должны быть реалистичные значения"
  );
  console.log("   3. Предупреждение о недостатке данных должно исчезнуть");

  process.exit(0);
}

// Запускаем
main().catch((error) => {
  console.error("❌ Критическая ошибка:", error);
  process.exit(1);
});
