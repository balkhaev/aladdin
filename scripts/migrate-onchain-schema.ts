/**
 * Script to migrate on-chain metrics schema in ClickHouse
 * Adds advanced metrics columns to on_chain_metrics table
 */

import { createClickHouseClient } from "@aladdin/shared/clickhouse";
import { createLogger } from "@aladdin/shared/logger";

const logger = createLogger("migrate-onchain-schema");

const clickhouse = createClickHouseClient({ logger });

async function migrate() {
  try {
    logger.info("Starting on-chain schema migration...");

    // Add new columns for advanced metrics
    const alterQuery = `
      ALTER TABLE on_chain_metrics
      ADD COLUMN IF NOT EXISTS mvrv_ratio Float64,
      ADD COLUMN IF NOT EXISTS sopr Float64,
      ADD COLUMN IF NOT EXISTS nupl Float64,
      ADD COLUMN IF NOT EXISTS exchange_reserve Float64,
      ADD COLUMN IF NOT EXISTS puell_multiple Float64,
      ADD COLUMN IF NOT EXISTS stock_to_flow Float64
    `;

    await clickhouse.command(alterQuery);
    logger.info("✓ Added advanced metrics columns");

    // Verify columns were added
    const result = await clickhouse.query<{ name: string; type: string }>(
      "DESCRIBE TABLE on_chain_metrics"
    );

    const advancedColumns = [
      "mvrv_ratio",
      "sopr",
      "nupl",
      "exchange_reserve",
      "puell_multiple",
      "stock_to_flow",
    ];

    const existingColumns = result.map((r) => r.name);
    const missingColumns = advancedColumns.filter(
      (col) => !existingColumns.includes(col)
    );

    if (missingColumns.length === 0) {
      logger.info("✓ All advanced metrics columns successfully added");
      logger.info("Available columns:", existingColumns);
    } else {
      logger.error("✗ Some columns were not added:", missingColumns);
      process.exit(1);
    }
  } catch (error) {
    logger.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
