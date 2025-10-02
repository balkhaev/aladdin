#!/usr/bin/env bun

/**
 * Redis Cache Performance Test Script
 *
 * Тестирует производительность Redis кэша в Analytics и Market Data сервисах
 *
 * Usage:
 *   bun scripts/test-cache-performance.ts
 */

import "dotenv/config";

const ANALYTICS_BASE_URL =
  process.env.ANALYTICS_BASE_URL || "http://localhost:3014";
const MARKET_DATA_BASE_URL =
  process.env.MARKET_DATA_BASE_URL || "http://localhost:3010";

const COLORS = {
  RESET: "\x1b[0m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  RED: "\x1b[31m",
  CYAN: "\x1b[36m",
  BOLD: "\x1b[1m",
};

type TestResult = {
  endpoint: string;
  firstRequest: number;
  secondRequest: number;
  speedup: number;
  cacheHit: boolean;
};

async function measureRequest(url: string): Promise<number> {
  const start = performance.now();
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`
    );
  }

  await response.json();
  const end = performance.now();

  return end - start;
}

async function testEndpoint(
  name: string,
  url: string,
  warmupRequests = 1
): Promise<TestResult> {
  console.log(`\n${COLORS.BLUE}Testing: ${name}${COLORS.RESET}`);
  console.log(`URL: ${url}`);

  // Warmup
  if (warmupRequests > 0) {
    console.log(`Warming up (${warmupRequests} requests)...`);
    for (let i = 0; i < warmupRequests; i++) {
      await measureRequest(url);
    }
  }

  // First request (cache miss)
  console.log("Request 1 (cache miss)...");
  const firstRequest = await measureRequest(url);
  console.log(`  Time: ${firstRequest.toFixed(2)}ms`);

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Second request (cache hit)
  console.log("Request 2 (cache hit)...");
  const secondRequest = await measureRequest(url);
  console.log(`  Time: ${secondRequest.toFixed(2)}ms`);

  const speedup = firstRequest / secondRequest;
  const cacheHit = secondRequest < firstRequest * 0.5; // если в 2+ раза быстрее

  console.log(`${COLORS.BOLD}Speedup: ${speedup.toFixed(2)}x${COLORS.RESET}`);

  if (cacheHit) {
    console.log(`${COLORS.GREEN}✓ Cache working!${COLORS.RESET}`);
  } else {
    console.log(`${COLORS.YELLOW}⚠ Cache may not be working${COLORS.RESET}`);
  }

  return {
    endpoint: name,
    firstRequest,
    secondRequest,
    speedup,
    cacheHit,
  };
}

async function getCacheStats(
  serviceUrl: string,
  serviceName: string
): Promise<unknown> {
  try {
    const response = await fetch(`${serviceUrl}/cache/stats`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error(`Failed to get cache stats for ${serviceName}:`, error);
    return null;
  }
}

async function main(): Promise<void> {
  console.log(`${COLORS.BOLD}${COLORS.CYAN}
╔═══════════════════════════════════════════════════════════╗
║           Redis Cache Performance Test                    ║
╚═══════════════════════════════════════════════════════════╝
${COLORS.RESET}`);

  const results: TestResult[] = [];

  // Test Analytics Service
  console.log(`\n${COLORS.BOLD}=== Analytics Service ===${COLORS.RESET}`);

  try {
    const analyticsTests = [
      {
        name: "Technical Indicators (BTCUSDT)",
        url: `${ANALYTICS_BASE_URL}/api/analytics/indicators/BTCUSDT?indicators=RSI,MACD&timeframe=1h&limit=100`,
      },
      {
        name: "Market Overview",
        url: `${ANALYTICS_BASE_URL}/api/analytics/market-overview`,
      },
      {
        name: "Combined Sentiment (BTCUSDT)",
        url: `${ANALYTICS_BASE_URL}/api/analytics/combined-sentiment?symbols=BTCUSDT`,
      },
    ];

    for (const test of analyticsTests) {
      try {
        const result = await testEndpoint(test.name, test.url);
        results.push(result);
      } catch (error) {
        console.error(
          `${COLORS.RED}Failed: ${(error as Error).message}${COLORS.RESET}`
        );
      }
    }

    // Get cache stats
    const analyticsStats = await getCacheStats(
      `${ANALYTICS_BASE_URL}/api/analytics`,
      "Analytics"
    );
    if (analyticsStats) {
      console.log(`\n${COLORS.CYAN}Analytics Cache Stats:${COLORS.RESET}`);
      console.log(JSON.stringify(analyticsStats, null, 2));
    }
  } catch (error) {
    console.error(
      `${COLORS.RED}Analytics tests failed: ${(error as Error).message}${COLORS.RESET}`
    );
  }

  // Test Market Data Service
  console.log(`\n${COLORS.BOLD}=== Market Data Service ===${COLORS.RESET}`);

  try {
    const marketDataTests = [
      {
        name: "Aggregated Price (BTCUSDT)",
        url: `${MARKET_DATA_BASE_URL}/api/market-data/aggregated/BTCUSDT`,
      },
      {
        name: "Arbitrage Opportunities",
        url: `${MARKET_DATA_BASE_URL}/api/market-data/arbitrage?minSpread=0.1&limit=20`,
      },
    ];

    for (const test of marketDataTests) {
      try {
        const result = await testEndpoint(test.name, test.url);
        results.push(result);
      } catch (error) {
        console.error(
          `${COLORS.RED}Failed: ${(error as Error).message}${COLORS.RESET}`
        );
      }
    }

    // Get cache stats
    const marketDataStats = await getCacheStats(
      `${MARKET_DATA_BASE_URL}/api/market-data`,
      "Market Data"
    );
    if (marketDataStats) {
      console.log(`\n${COLORS.CYAN}Market Data Cache Stats:${COLORS.RESET}`);
      console.log(JSON.stringify(marketDataStats, null, 2));
    }
  } catch (error) {
    console.error(
      `${COLORS.RED}Market Data tests failed: ${(error as Error).message}${COLORS.RESET}`
    );
  }

  // Summary
  console.log(`\n${COLORS.BOLD}${COLORS.CYAN}
╔═══════════════════════════════════════════════════════════╗
║                     Summary                               ║
╚═══════════════════════════════════════════════════════════╝
${COLORS.RESET}`);

  console.log(
    `\n${"Endpoint".padEnd(40)} ${"1st Req".padStart(10)} ${"2nd Req".padStart(10)} ${"Speedup".padStart(10)} ${"Cache".padStart(8)}`
  );
  console.log("─".repeat(82));

  for (const result of results) {
    const status = result.cacheHit
      ? `${COLORS.GREEN}✓${COLORS.RESET}`
      : `${COLORS.YELLOW}?${COLORS.RESET}`;

    console.log(
      `${result.endpoint.padEnd(40)} ${result.firstRequest.toFixed(2).padStart(10)}ms ${result.secondRequest.toFixed(2).padStart(10)}ms ${(result.speedup.toFixed(2) + "x").padStart(10)} ${status.padStart(8)}`
    );
  }

  const avgSpeedup =
    results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
  const cacheHitRate =
    (results.filter((r) => r.cacheHit).length / results.length) * 100;

  console.log("─".repeat(82));
  console.log(
    `\n${COLORS.BOLD}Average Speedup: ${avgSpeedup.toFixed(2)}x${COLORS.RESET}`
  );
  console.log(
    `${COLORS.BOLD}Cache Hit Rate: ${cacheHitRate.toFixed(0)}%${COLORS.RESET}`
  );

  if (avgSpeedup > 5) {
    console.log(
      `\n${COLORS.GREEN}${COLORS.BOLD}🎉 Excellent! Cache is working great!${COLORS.RESET}`
    );
  } else if (avgSpeedup > 2) {
    console.log(
      `\n${COLORS.YELLOW}${COLORS.BOLD}⚠ Cache is working but could be better${COLORS.RESET}`
    );
  } else {
    console.log(
      `\n${COLORS.RED}${COLORS.BOLD}❌ Cache may not be working properly${COLORS.RESET}`
    );
  }

  console.log(`\n${COLORS.CYAN}Expected speedup: 7-24x${COLORS.RESET}\n`);
}

main().catch((error) => {
  console.error(`${COLORS.RED}Test failed:${COLORS.RESET}`, error);
  process.exit(1);
});

