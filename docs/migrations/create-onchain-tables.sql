-- Create On-Chain Metrics and Whale Transactions Tables
-- Date: 2025-10-05
-- Description: Creates tables for on-chain metrics and whale transaction tracking

-- On-Chain Metrics Table
CREATE TABLE IF NOT EXISTS on_chain_metrics (
    timestamp DateTime64(3) CODEC(DoubleDelta, LZ4),
    blockchain LowCardinality(String),
    whale_tx_count UInt32,
    whale_tx_volume Float64,
    exchange_inflow Float64,
    exchange_outflow Float64,
    exchange_net_flow Float64,
    active_addresses UInt64,
    nvt_ratio Float64,
    market_cap Nullable(Float64),
    transaction_volume Float64,
    -- Advanced metrics (optional)
    mvrv_ratio Nullable(Float64),
    sopr Nullable(Float64),
    nupl Nullable(Float64),
    exchange_reserve Nullable(Float64),
    puell_multiple Nullable(Float64),
    stock_to_flow Nullable(Float64),
    -- New Phase 1 metrics
    reserve_risk Nullable(Float64),
    accumulation_score Nullable(Float64),
    accumulation_trend_7d Nullable(Float64),
    accumulation_trend_30d Nullable(Float64),
    accumulation_trend_90d Nullable(Float64),
    hodl_under1m Nullable(Float64),
    hodl_m1to3 Nullable(Float64),
    hodl_m3to6 Nullable(Float64),
    hodl_m6to12 Nullable(Float64),
    hodl_y1to2 Nullable(Float64),
    hodl_y2to3 Nullable(Float64),
    hodl_y3to5 Nullable(Float64),
    hodl_over5y Nullable(Float64),
    binary_cdd Nullable(UInt8),
    INDEX idx_blockchain_timestamp (blockchain, timestamp) TYPE minmax GRANULARITY 4
) ENGINE = MergeTree()
PARTITION BY (blockchain, toYYYYMM(timestamp))
ORDER BY (blockchain, timestamp)
TTL timestamp + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- Whale Transactions Table
CREATE TABLE IF NOT EXISTS whale_transactions (
    timestamp DateTime64(3) CODEC(DoubleDelta, LZ4),
    blockchain LowCardinality(String),
    transaction_hash String,
    value Float64 CODEC(LZ4),
    from_address String,
    to_address String,
    INDEX idx_blockchain_timestamp (blockchain, timestamp) TYPE minmax GRANULARITY 4,
    INDEX idx_hash transaction_hash TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree(timestamp)
PARTITION BY (blockchain, toYYYYMM(timestamp))
ORDER BY (blockchain, transaction_hash, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Whale Alerts Table (for notifications)
CREATE TABLE IF NOT EXISTS whale_alerts (
    timestamp DateTime64(3) CODEC(DoubleDelta, LZ4),
    blockchain LowCardinality(String),
    alert_type LowCardinality(String), -- 'whale_tx', 'exchange_inflow', 'exchange_outflow', 'large_transfer'
    transaction_hash String,
    value Float64 CODEC(LZ4),
    from_address String,
    to_address String,
    exchange Nullable(String),
    is_inflow Nullable(UInt8),
    INDEX idx_blockchain_timestamp (blockchain, timestamp) TYPE minmax GRANULARITY 4,
    INDEX idx_alert_type alert_type TYPE set(0) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY (blockchain, toYYYYMM(timestamp))
ORDER BY (blockchain, alert_type, timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;
