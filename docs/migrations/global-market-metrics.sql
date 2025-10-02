-- Global Market Metrics Tables
-- Глобальные рыночные метрики и макро данные

-- ===========================================
-- Таблица для глобальных рыночных метрик
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.global_market_metrics (
    timestamp DateTime CODEC(DoubleDelta, LZ4),
    
    -- Market Cap
    total_market_cap_usd Decimal(38, 2) CODEC(LZ4),
    market_cap_change_24h Decimal(10, 4) CODEC(LZ4),
    
    -- Volume
    total_volume_24h_usd Decimal(38, 2) CODEC(LZ4),
    
    -- Dominance
    btc_dominance Decimal(10, 4) CODEC(LZ4),
    eth_dominance Decimal(10, 4) CODEC(LZ4),
    altcoin_dominance Decimal(10, 4) CODEC(LZ4),
    
    -- Counts
    active_cryptocurrencies UInt32,
    markets UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY timestamp
TTL timestamp + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- ===========================================
-- Таблица для Fear & Greed Index
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.fear_greed_index (
    timestamp DateTime CODEC(DoubleDelta, LZ4),
    value UInt8, -- 0-100
    classification LowCardinality(String), -- Extreme Fear, Fear, Neutral, Greed, Extreme Greed
    time_until_update UInt32
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY timestamp
TTL timestamp + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- ===========================================
-- Таблица для трендовых монет
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.trending_coins (
    timestamp DateTime CODEC(DoubleDelta, LZ4),
    coin_id LowCardinality(String),
    symbol LowCardinality(String),
    name String,
    market_cap_rank UInt32,
    price_usd Decimal(20, 8) CODEC(LZ4),
    price_btc Decimal(20, 12) CODEC(LZ4),
    volume_24h Decimal(38, 2) CODEC(LZ4),
    price_change_24h Decimal(10, 4) CODEC(LZ4),
    market_cap Decimal(38, 2) CODEC(LZ4),
    rank UInt8 -- Position in trending (1-10)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, rank)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- ===========================================
-- Таблица для топ монет по категориям
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.top_coins (
    timestamp DateTime CODEC(DoubleDelta, LZ4),
    coin_id LowCardinality(String),
    symbol LowCardinality(String),
    name String,
    market_cap_rank UInt32,
    price_usd Decimal(20, 8) CODEC(LZ4),
    market_cap Decimal(38, 2) CODEC(LZ4),
    volume_24h Decimal(38, 2) CODEC(LZ4),
    price_change_24h Decimal(10, 4) CODEC(LZ4),
    price_change_7d Decimal(10, 4) CODEC(LZ4),
    market_cap_change_24h Decimal(10, 4) CODEC(LZ4),
    category LowCardinality(String), -- DeFi, Layer 1, Layer 2, Gaming, Meme
    sector LowCardinality(String) -- Infrastructure, DeFi, Exchange, Other
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, market_cap_rank)
TTL timestamp + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

-- ===========================================
-- Материализованные представления
-- ===========================================

-- Дневная статистика по категориям
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.category_daily_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (category, day)
AS SELECT
    toDate(timestamp) AS day,
    category,
    count() AS coins_count,
    sum(market_cap) AS total_market_cap,
    sum(volume_24h) AS total_volume_24h,
    avg(price_change_24h) AS avg_price_change_24h,
    avg(price_change_7d) AS avg_price_change_7d,
    max(market_cap) AS largest_coin_market_cap,
    min(market_cap) AS smallest_coin_market_cap
FROM aladdin.top_coins
WHERE category IS NOT NULL
  AND category != ''
GROUP BY day, category;

-- Дневная статистика Fear & Greed
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.feargreed_daily_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY day
AS SELECT
    toDate(timestamp) AS day,
    avg(value) AS avg_value,
    max(value) AS max_value,
    min(value) AS min_value,
    argMax(classification, timestamp) AS end_classification,
    argMin(classification, timestamp) AS start_classification,
    count() AS readings
FROM aladdin.fear_greed_index
GROUP BY day;

-- ===========================================
-- Индексы для быстрого поиска
-- ===========================================
ALTER TABLE aladdin.global_market_metrics ADD INDEX IF NOT EXISTS idx_timestamp timestamp TYPE minmax GRANULARITY 4;
ALTER TABLE aladdin.fear_greed_index ADD INDEX IF NOT EXISTS idx_timestamp timestamp TYPE minmax GRANULARITY 4;
ALTER TABLE aladdin.trending_coins ADD INDEX IF NOT EXISTS idx_coin_id coin_id TYPE bloom_filter GRANULARITY 1;
ALTER TABLE aladdin.top_coins ADD INDEX IF NOT EXISTS idx_coin_id coin_id TYPE bloom_filter GRANULARITY 1;
ALTER TABLE aladdin.top_coins ADD INDEX IF NOT EXISTS idx_category category TYPE bloom_filter GRANULARITY 1;

-- ===========================================
-- Примеры полезных запросов
-- ===========================================

-- Текущее состояние рынка
-- SELECT 
--     total_market_cap_usd,
--     total_volume_24h_usd,
--     btc_dominance,
--     eth_dominance,
--     market_cap_change_24h
-- FROM aladdin.global_market_metrics
-- ORDER BY timestamp DESC
-- LIMIT 1;

-- История Fear & Greed за последний месяц
-- SELECT 
--     toDate(timestamp) as day,
--     avg(value) as avg_fg,
--     max(value) as max_fg,
--     min(value) as min_fg
-- FROM aladdin.fear_greed_index
-- WHERE timestamp > now() - INTERVAL 30 DAY
-- GROUP BY day
-- ORDER BY day DESC;

-- Топ категорий по росту за 24ч
-- SELECT 
--     category,
--     total_market_cap,
--     total_volume_24h,
--     avg_price_change_24h,
--     coins_count
-- FROM aladdin.category_daily_stats_mv
-- WHERE day = today()
-- ORDER BY avg_price_change_24h DESC;

-- Трендовые монеты за последний час
-- SELECT 
--     symbol,
--     name,
--     price_usd,
--     price_change_24h,
--     market_cap,
--     rank
-- FROM aladdin.trending_coins
-- WHERE timestamp > now() - INTERVAL 1 HOUR
-- ORDER BY timestamp DESC, rank ASC
-- LIMIT 10;

-- Топ DeFi монет
-- SELECT 
--     symbol,
--     name,
--     price_usd,
--     market_cap,
--     volume_24h,
--     price_change_24h
-- FROM aladdin.top_coins
-- WHERE category = 'DeFi'
--   AND timestamp > now() - INTERVAL 1 HOUR
-- ORDER BY timestamp DESC, market_cap_rank ASC
-- LIMIT 20;

-- Корреляция Fear & Greed с изменением рынка
-- SELECT 
--     g.day,
--     g.avg_value as avg_feargreed,
--     m.market_cap_change_24h
-- FROM aladdin.feargreed_daily_stats_mv as g
-- JOIN (
--     SELECT 
--         toDate(timestamp) as day,
--         avg(market_cap_change_24h) as market_cap_change_24h
--     FROM aladdin.global_market_metrics
--     GROUP BY day
-- ) as m ON g.day = m.day
-- WHERE g.day > today() - INTERVAL 30 DAY
-- ORDER BY g.day DESC;

