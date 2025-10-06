#!/usr/bin/env bun

/**
 * Diagnostic script to check if ML service has enough data for backtesting
 */

const CLICKHOUSE_HOST = "http://49.13.216.63:8123";
const CLICKHOUSE_USER = "default";
const CLICKHOUSE_PASSWORD = "j6tiT8DWCzoG7V4PiGxHptP6clqT20jlcerSFTIUdod2be4yz3WM4y0nwS1hUM1T";
const CLICKHOUSE_DB = "aladdin";

async function queryClickHouse(query: string) {
  const url = `${CLICKHOUSE_HOST}/?database=${CLICKHOUSE_DB}&query=${encodeURIComponent(query)}`;
  const authHeader = `Basic ${btoa(`${CLICKHOUSE_USER}:${CLICKHOUSE_PASSWORD}`)}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader,
    },
  });
  
  if (!response.ok) {
    throw new Error(`ClickHouse query failed: ${response.statusText}`);
  }
  
  return response.text();
}

async function checkData() {
  console.log("🔍 Checking ML Service Data Requirements\n");
  
  const symbols = ["BTCUSDT", "ETHUSDT"];
  
  for (const symbol of symbols) {
    console.log(`\n📊 ${symbol}:`);
    console.log("─".repeat(50));
    
    try {
      // Total candles
      const totalQuery = `SELECT COUNT(*) FROM candles WHERE symbol = '${symbol}' AND interval = '1h'`;
      const total = await queryClickHouse(totalQuery);
      console.log(`Total 1h candles: ${total.trim()}`);
      
      // Last 30 days
      const last30Query = `SELECT COUNT(*) FROM candles WHERE symbol = '${symbol}' AND interval = '1h' AND timestamp > now() - INTERVAL 30 DAY`;
      const last30 = await queryClickHouse(last30Query);
      console.log(`Last 30 days: ${last30.trim()} (minimum: 720 for backtest)`);
      
      // Last 7 days
      const last7Query = `SELECT COUNT(*) FROM candles WHERE symbol = '${symbol}' AND interval = '1h' AND timestamp > now() - INTERVAL 7 DAY`;
      const last7 = await queryClickHouse(last7Query);
      console.log(`Last 7 days: ${last7.trim()} (minimum: 168)`);
      
      // Latest timestamp
      const latestQuery = `SELECT max(timestamp) as latest FROM candles WHERE symbol = '${symbol}' AND interval = '1h'`;
      const latest = await queryClickHouse(latestQuery);
      const latestDate = new Date(parseInt(latest.trim()));
      console.log(`Latest data: ${latestDate.toISOString()}`);
      
      // Oldest timestamp
      const oldestQuery = `SELECT min(timestamp) as oldest FROM candles WHERE symbol = '${symbol}' AND interval = '1h'`;
      const oldest = await queryClickHouse(oldestQuery);
      const oldestDate = new Date(parseInt(oldest.trim()));
      console.log(`Oldest data: ${oldestDate.toISOString()}`);
      
      // Check for gaps
      const gapsQuery = `
        SELECT COUNT(*) as gaps
        FROM (
          SELECT timestamp, 
                 timestamp - lagInFrame(timestamp) OVER (ORDER BY timestamp) as diff
          FROM candles 
          WHERE symbol = '${symbol}' 
            AND interval = '1h'
            AND timestamp > now() - INTERVAL 30 DAY
        )
        WHERE diff > 3600000 * 2
      `;
      const gaps = await queryClickHouse(gapsQuery);
      console.log(`Data gaps (>2h): ${gaps.trim()}`);
      
      // Data quality check
      const qualityQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(IF(close > 0, 1, NULL)) as valid_prices,
          COUNT(IF(close IS NULL OR close <= 0, 1, NULL)) as invalid_prices
        FROM candles 
        WHERE symbol = '${symbol}' 
          AND interval = '1h'
          AND timestamp > now() - INTERVAL 30 DAY
        FORMAT JSON
      `;
      const quality = await queryClickHouse(qualityQuery);
      const qualityData = JSON.parse(quality);
      const row = qualityData.data[0];
      console.log(`Valid prices: ${row.valid_prices}/${row.total}`);
      console.log(`Invalid prices: ${row.invalid_prices}`);
      
      // Assessment
      const last30Count = parseInt(last30.trim());
      console.log("\n✅ Assessment:");
      
      if (last30Count >= 720) {
        console.log("  ✓ Sufficient data for 30-day backtest");
      } else if (last30Count >= 168) {
        console.log("  ⚠️  Only enough for 7-day backtest");
      } else {
        console.log("  ❌ Insufficient data for backtesting");
      }
      
      if (parseInt(gaps.trim()) > 5) {
        console.log("  ⚠️  Warning: Data has significant gaps");
      }
      
      if (row.invalid_prices > 0) {
        console.log(`  ⚠️  Warning: ${row.invalid_prices} invalid prices found`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error checking ${symbol}:`, error);
    }
  }
  
  console.log("\n" + "─".repeat(50));
  console.log("\n📝 Recommendations:");
  console.log("  • For reliable backtesting, ensure 720+ candles (30 days)");
  console.log("  • Check that market-data service is running and collecting data");
  console.log("  • Use shorter date ranges if data is limited (7-14 days)");
  console.log("  • Try 'horizon: 1h' instead of '24h' for initial testing\n");
}

// Run check
checkData().catch((error) => {
  console.error("❌ Check failed:", error);
  process.exit(1);
});
