-- On-Chain Alerts Table
-- Date: 2025-10-06
-- Description: Stores on-chain metric alerts for MVRV, NUPL, Reserve Risk, etc.

CREATE TABLE IF NOT EXISTS on_chain_alerts (
    timestamp DateTime64(3) CODEC(DoubleDelta, LZ4),
    blockchain LowCardinality(String),
    alert_type LowCardinality(String), -- 'mvrv', 'nupl', 'reserve_risk', 'accumulation', 'hodl_wave', 'cdd'
    severity LowCardinality(String), -- 'info', 'warning', 'critical'
    signal LowCardinality(String), -- 'bullish', 'bearish', 'neutral'
    message String CODEC(LZ4),
    value Nullable(Float64),
    threshold Nullable(Float64),
    metadata String CODEC(LZ4), -- JSON metadata
    INDEX idx_blockchain_timestamp (blockchain, timestamp) TYPE minmax GRANULARITY 4,
    INDEX idx_alert_type alert_type TYPE set(0) GRANULARITY 1,
    INDEX idx_severity severity TYPE set(0) GRANULARITY 1,
    INDEX idx_signal signal TYPE set(0) GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY (blockchain, toYYYYMM(timestamp))
ORDER BY (blockchain, alert_type, severity, timestamp)
TTL timestamp + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

