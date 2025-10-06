-- Bybit Opportunities Table
-- Stores real-time trading opportunities detected from Bybit USDT Perpetual Futures

CREATE TABLE IF NOT EXISTS bybit_opportunities (
    timestamp DateTime64(3),
    symbol String,
    exchange String DEFAULT 'bybit',
    opportunity_type Enum8('BUY' = 1, 'SELL' = 2, 'NEUTRAL' = 3),
    total_score Float32,
    technical_score Float32,
    momentum_score Float32,
    ml_confidence Float32,
    strength Enum8('WEAK' = 1, 'MODERATE' = 2, 'STRONG' = 3),
    confidence Float32,
    price Float64,
    volume_24h Float64,
    price_change_1m Float32,
    price_change_5m Float32,
    price_change_15m Float32,
    rsi Float32,
    macd Float32,
    volume_spike Float32,
    anomaly_types Array(String),
    metadata String -- JSON с дополнительной информацией (indicators, momentum, etc.)
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, symbol)
TTL timestamp + INTERVAL 30 DAY;

-- Индексы для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_opportunity_type ON bybit_opportunities (opportunity_type) TYPE minmax GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_total_score ON bybit_opportunities (total_score) TYPE minmax GRANULARITY 4;
CREATE INDEX IF NOT EXISTS idx_strength ON bybit_opportunities (strength) TYPE minmax GRANULARITY 4;

-- Комментарии
ALTER TABLE bybit_opportunities COMMENT 'Real-time trading opportunities from Bybit USDT Perpetual Futures with technical, momentum, and ML analysis';
