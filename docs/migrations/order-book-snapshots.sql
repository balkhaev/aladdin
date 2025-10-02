-- Order Book Snapshots Migration
-- Date: 2025-10-04
-- Purpose: Store order book snapshots for liquidity analysis

-- Drop existing table if exists (for development)
-- DROP TABLE IF EXISTS aladdin.order_book_snapshots;

CREATE TABLE IF NOT EXISTS aladdin.order_book_snapshots (
    timestamp DateTime64(3),
    symbol String,
    exchange String,
    
    -- Best bid/ask
    best_bid Decimal(20, 8),
    best_ask Decimal(20, 8),
    bid_ask_spread Decimal(20, 8),
    spread_percent Decimal(10, 4),
    
    -- Depth metrics
    bid_depth_1pct Float64,  -- Объем покупок в пределах 1% от цены (USD)
    ask_depth_1pct Float64,  -- Объем продаж в пределах 1% (USD)
    bid_depth_5pct Float64,  -- В пределах 5%
    ask_depth_5pct Float64,
    
    -- Imbalance
    bid_ask_imbalance Decimal(10, 4), -- -1 (все на sell) до 1 (все на buy)
    
    -- Raw data (optional, for deep analysis)
    bid_levels String,  -- JSON array of top 20 levels
    ask_levels String   -- JSON array of top 20 levels
    
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_symbol_time 
ON aladdin.order_book_snapshots(symbol, timestamp) 
TYPE minmax 
GRANULARITY 4;

-- Create index for exchange filtering
CREATE INDEX IF NOT EXISTS idx_exchange 
ON aladdin.order_book_snapshots(exchange) 
TYPE set(100) 
GRANULARITY 4;

-- Verify table creation
SELECT 
    name,
    engine,
    total_rows,
    total_bytes,
    formatReadableSize(total_bytes) as size
FROM system.tables 
WHERE database = 'aladdin' 
  AND name = 'order_book_snapshots';




