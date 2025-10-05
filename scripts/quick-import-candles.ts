#!/usr/bin/env bun

import { createClickHouseClient } from "../packages/shared/src/clickhouse";

const CLICKHOUSE_URL =
  "http://default:j6tiT8DWCzoG7V4PiGxHptP6clqT20jlcerSFTIUdod2be4yz3WM4y0nwS1hUM1T@49.13.216.63:8123/aladdin";

async function fetchFromBinance(
  symbol: string,
  interval: string,
  limit: number
) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.statusText}`);
  }

  const data = (await response.json()) as Array<any>;

  return data.map((item: any) => ({
    timestamp: Math.floor(item[0] / 1000), // Convert to seconds
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
  console.log("🚀 Quick import candles from Binance");

  const clickhouse = createClickHouseClient({
    url: CLICKHOUSE_URL,
  });

  console.log("✅ Connected to ClickHouse");

  // Fetch last 1000 1h candles
  console.log("📥 Fetching 1000 candles (1h) for BTCUSDT...");
  const candles = await fetchFromBinance("BTCUSDT", "1h", 1000);

  console.log(`📊 Got ${candles.length} candles`);
  console.log(`📅 From ${new Date(candles[0].timestamp * 1000).toISOString()}`);
  console.log(
    `📅 To ${new Date(candles[candles.length - 1].timestamp * 1000).toISOString()}`
  );

  // Insert to ClickHouse
  console.log("💾 Inserting to ClickHouse...");
  await clickhouse.insert("candles", candles);

  console.log("✅ Done!");
}

main().catch(console.error);
