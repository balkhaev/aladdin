-- Funding Rates & Open Interest Migration
-- Date: 2025-10-04
-- Purpose: Store futures market data for sentiment analysis

-- ===== FUNDING RATES TABLE =====

CREATE TABLE IF NOT EXISTS aladdin.funding_rates (
    timestamp DateTime64(3),
    symbol String,
    exchange String,
    
    -- Current funding rate
    funding_rate Decimal(10, 6),      -- e.g., 0.0001 = 0.01%
    funding_interval_hours UInt8,     -- Usually 8 hours
    next_funding_time DateTime,
    
    -- Historical averages for context
    avg_funding_24h Decimal(10, 6),
    avg_funding_7d Decimal(10, 6),
    
    -- Interpretation
    sentiment Enum8('BULLISH' = 1, 'BEARISH' = -1, 'NEUTRAL' = 0),
    signal String                     -- Human-readable explanation
    
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_funding_symbol_time 
ON aladdin.funding_rates(symbol, timestamp) 
TYPE minmax 
GRANULARITY 4;

CREATE INDEX IF NOT EXISTS idx_funding_exchange 
ON aladdin.funding_rates(exchange) 
TYPE set(100) 
GRANULARITY 4;

-- ===== OPEN INTEREST TABLE =====

CREATE TABLE IF NOT EXISTS aladdin.open_interest (
    timestamp DateTime64(3),
    symbol String,
    exchange String,
    
    -- Open Interest data
    open_interest Float64,            -- Total OI in USD
    open_interest_change_24h Float64, -- Absolute change
    open_interest_change_pct Float64, -- Percentage change
    
    -- Price correlation
    price Float64,                    -- Current futures price
    price_change_24h Float64,        -- Price change %
    
    -- Volume (for additional context)
    volume_24h Float64,
    
    -- Interpretation based on OI + Price
    signal Enum8('BULLISH' = 1, 'BEARISH' = -1, 'NEUTRAL' = 0),
    explanation String
    
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_oi_symbol_time 
ON aladdin.open_interest(symbol, timestamp) 
TYPE minmax 
GRANULARITY 4;

CREATE INDEX IF NOT EXISTS idx_oi_exchange 
ON aladdin.open_interest(exchange) 
TYPE set(100) 
GRANULARITY 4;

-- ===== LIQUIDATION ESTIMATES TABLE =====

CREATE TABLE IF NOT EXISTS aladdin.liquidation_estimates (
    timestamp DateTime64(3),
    symbol String,
    
    current_price Float64,
    
    -- Estimated liquidation clusters
    -- Format: Array of (price, estimated_volume_usd)
    long_liq_levels String,     -- JSON array: [{"price": 50000, "volume": 10000000}, ...]
    short_liq_levels String,    -- JSON array
    
    -- Nearest significant liquidations
    next_long_liq_price Float64,
    next_long_liq_volume Float64,
    next_short_liq_price Float64,
    next_short_liq_volume Float64,
    
    -- Risk assessment
    cascade_risk Enum8('LOW' = 1, 'MEDIUM' = 2, 'HIGH' = 3, 'CRITICAL' = 4),
    risk_explanation String
    
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, timestamp)
TTL timestamp + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Index
CREATE INDEX IF NOT EXISTS idx_liq_symbol_time 
ON aladdin.liquidation_estimates(symbol, timestamp) 
TYPE minmax 
GRANULARITY 4;

-- ===== COMBINED FUTURES SENTIMENT =====
-- Materialized view for quick access to combined sentiment

CREATE TABLE IF NOT EXISTS aladdin.futures_sentiment (
    timestamp DateTime64(3),
    symbol String,
    
    -- Individual components
    funding_rate Decimal(10, 6),
    funding_sentiment Enum8('BULLISH' = 1, 'BEARISH' = -1, 'NEUTRAL' = 0),
    
    oi_change_pct Float64,
    price_change_pct Float64,
    oi_sentiment Enum8('BULLISH' = 1, 'BEARISH' = -1, 'NEUTRAL' = 0),
    
    cascade_risk Enum8('LOW' = 1, 'MEDIUM' = 2, 'HIGH' = 3, 'CRITICAL' = 4),
    
    -- Combined analysis
    overall_sentiment Enum8('BULLISH' = 1, 'BEARISH' = -1, 'NEUTRAL' = 0),
    confidence Float32,              -- 0.0 to 1.0
    signal String,                   -- Trading recommendation
    
    -- Metadata
    data_quality Float32             -- 0.0 to 1.0 (based on data freshness)
    
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Index
CREATE INDEX IF NOT EXISTS idx_sentiment_symbol_time 
ON aladdin.futures_sentiment(symbol, timestamp) 
TYPE minmax 
GRANULARITY 4;

-- Verify tables creation
SELECT 
    database,
    name,
    engine,
    total_rows,
    formatReadableSize(total_bytes) as size
FROM system.tables 
WHERE database = 'aladdin' 
  AND name IN ('funding_rates', 'open_interest', 'liquidation_estimates', 'futures_sentiment')
ORDER BY name;


