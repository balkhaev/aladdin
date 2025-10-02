-- Multi-Exchange Aggregation and Futures Metrics
-- Добавляет поддержку агрегации данных с нескольких бирж и futures метрики

-- ===========================================
-- Таблица для агрегированных цен с нескольких бирж
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.aggregated_prices (
    timestamp DateTime64(3) CODEC(DoubleDelta, LZ4),
    symbol LowCardinality(String),
    
    -- Средневзвешенная цена по объемам
    vwap Decimal(20, 8) CODEC(LZ4),
    
    -- Цены с разных бирж
    binance_price Decimal(20, 8) CODEC(LZ4),
    bybit_price Decimal(20, 8) CODEC(LZ4),
    okx_price Decimal(20, 8) CODEC(LZ4),
    
    -- Объемы с разных бирж
    binance_volume Float64 CODEC(LZ4),
    bybit_volume Float64 CODEC(LZ4),
    okx_volume Float64 CODEC(LZ4),
    
    -- Общий объем и средняя цена
    total_volume Float64 CODEC(LZ4),
    avg_price Decimal(20, 8) CODEC(LZ4),
    
    -- Спреды между биржами (арбитраж)
    max_spread_percent Decimal(10, 4) CODEC(LZ4),
    max_spread_exchange_high LowCardinality(String),
    max_spread_exchange_low LowCardinality(String),
    
    -- Количество бирж с данными
    exchanges_count UInt8
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, timestamp)
TTL timestamp + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Индексы для быстрого поиска
ALTER TABLE aladdin.aggregated_prices ADD INDEX IF NOT EXISTS idx_timestamp timestamp TYPE minmax GRANULARITY 4;
ALTER TABLE aladdin.aggregated_prices ADD INDEX IF NOT EXISTS idx_symbol_timestamp (symbol, timestamp) TYPE minmax GRANULARITY 1;

-- ===========================================
-- Таблица для futures метрик (funding rates, open interest)
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.futures_metrics (
    timestamp DateTime CODEC(DoubleDelta, LZ4),
    symbol LowCardinality(String),
    exchange LowCardinality(String),
    
    -- Funding Rate (фондирование)
    funding_rate Decimal(10, 8) CODEC(LZ4),
    funding_rate_8h Decimal(10, 8) CODEC(LZ4), -- Ставка на 8 часов
    next_funding_time DateTime CODEC(LZ4),
    
    -- Open Interest (открытый интерес)
    open_interest Decimal(38, 8) CODEC(LZ4),
    open_interest_value Decimal(38, 8) CODEC(LZ4), -- В USD
    
    -- Long/Short Ratio
    long_short_ratio Decimal(10, 4) CODEC(LZ4),
    long_percentage Decimal(10, 4) CODEC(LZ4),
    short_percentage Decimal(10, 4) CODEC(LZ4),
    
    -- Liquidations (ликвидации)
    liquidations_24h Decimal(38, 8) CODEC(LZ4),
    long_liquidations_24h Decimal(38, 8) CODEC(LZ4),
    short_liquidations_24h Decimal(38, 8) CODEC(LZ4),
    
    -- Mark Price vs Index Price
    mark_price Decimal(20, 8) CODEC(LZ4),
    index_price Decimal(20, 8) CODEC(LZ4),
    basis Decimal(20, 8) CODEC(LZ4), -- Разница между mark и index
    basis_percentage Decimal(10, 4) CODEC(LZ4)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 1 YEAR
SETTINGS index_granularity = 8192;

-- Индексы
ALTER TABLE aladdin.futures_metrics ADD INDEX IF NOT EXISTS idx_timestamp timestamp TYPE minmax GRANULARITY 4;
ALTER TABLE aladdin.futures_metrics ADD INDEX IF NOT EXISTS idx_symbol_timestamp (symbol, timestamp) TYPE minmax GRANULARITY 1;

-- ===========================================
-- Материализованное представление: дневная статистика futures
-- ===========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.futures_daily_stats_mv
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(day)
ORDER BY (symbol, exchange, day)
AS SELECT
    toDate(timestamp) AS day,
    symbol,
    exchange,
    avg(funding_rate) AS avg_funding_rate,
    max(funding_rate) AS max_funding_rate,
    min(funding_rate) AS min_funding_rate,
    avgWeighted(funding_rate, open_interest) AS weighted_avg_funding_rate,
    
    argMax(open_interest, timestamp) AS end_open_interest,
    argMin(open_interest, timestamp) AS start_open_interest,
    end_open_interest - start_open_interest AS oi_change,
    (oi_change / start_open_interest) * 100 AS oi_change_percent,
    
    sum(liquidations_24h) AS total_liquidations,
    sum(long_liquidations_24h) AS total_long_liquidations,
    sum(short_liquidations_24h) AS total_short_liquidations,
    
    avg(long_short_ratio) AS avg_long_short_ratio,
    count() AS snapshots
FROM aladdin.futures_metrics
GROUP BY day, symbol, exchange;

-- ===========================================
-- Материализованное представление: арбитражные возможности
-- ===========================================
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.arbitrage_opportunities_mv
ENGINE = ReplacingMergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, timestamp)
AS SELECT
    timestamp,
    symbol,
    max_spread_percent AS spread_percent,
    max_spread_exchange_high AS high_exchange,
    max_spread_exchange_low AS low_exchange,
    vwap,
    total_volume,
    exchanges_count
FROM aladdin.aggregated_prices
WHERE max_spread_percent > 0.1 -- Только спреды больше 0.1%
ORDER BY timestamp DESC;

-- ===========================================
-- Таблица для Exchange Flow Tracking (приток/отток с бирж)
-- ===========================================
CREATE TABLE IF NOT EXISTS aladdin.exchange_flows (
    timestamp DateTime CODEC(DoubleDelta, LZ4),
    symbol LowCardinality(String),
    exchange LowCardinality(String),
    
    -- Балансы на биржах
    exchange_balance Decimal(38, 8) CODEC(LZ4),
    exchange_balance_usd Decimal(38, 8) CODEC(LZ4),
    
    -- Изменения за периоды
    inflow_24h Decimal(38, 8) CODEC(LZ4),
    outflow_24h Decimal(38, 8) CODEC(LZ4),
    net_flow_24h Decimal(38, 8) CODEC(LZ4), -- положительный = приток (bearish), отрицательный = отток (bullish)
    
    inflow_7d Decimal(38, 8) CODEC(LZ4),
    outflow_7d Decimal(38, 8) CODEC(LZ4),
    net_flow_7d Decimal(38, 8) CODEC(LZ4),
    
    -- Reserve (резервы биржи)
    reserve_percentage Decimal(10, 4) CODEC(LZ4), -- % от общего supply
    reserve_change_24h Decimal(10, 4) CODEC(LZ4)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (symbol, exchange, timestamp)
TTL timestamp + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

-- ===========================================
-- Примеры полезных запросов
-- ===========================================

-- Получить текущие арбитражные возможности (спред > 0.2%)
-- SELECT 
--     symbol,
--     spread_percent,
--     high_exchange,
--     low_exchange,
--     vwap,
--     total_volume
-- FROM aladdin.arbitrage_opportunities_mv
-- WHERE timestamp > now() - INTERVAL 5 MINUTE
--   AND spread_percent > 0.2
-- ORDER BY spread_percent DESC
-- LIMIT 20;

-- Топ символов по funding rate (высокий фондинг = много лонгов)
-- SELECT 
--     symbol,
--     exchange,
--     funding_rate * 100 AS funding_rate_percent,
--     open_interest_value,
--     long_short_ratio,
--     timestamp
-- FROM aladdin.futures_metrics
-- WHERE timestamp > now() - INTERVAL 1 HOUR
-- ORDER BY abs(funding_rate) DESC
-- LIMIT 20;

-- Символы с высоким притоком на биржи (возможна распродажа)
-- SELECT 
--     symbol,
--     exchange,
--     net_flow_24h,
--     exchange_balance,
--     reserve_change_24h,
--     timestamp
-- FROM aladdin.exchange_flows
-- WHERE timestamp > now() - INTERVAL 1 HOUR
--   AND net_flow_24h > 0
-- ORDER BY net_flow_24h DESC
-- LIMIT 20;

-- Агрегированная цена по символу с разных бирж
-- SELECT 
--     timestamp,
--     symbol,
--     vwap,
--     binance_price,
--     bybit_price,
--     okx_price,
--     max_spread_percent,
--     total_volume
-- FROM aladdin.aggregated_prices
-- WHERE symbol = 'BTCUSDT'
--   AND timestamp > now() - INTERVAL 1 DAY
-- ORDER BY timestamp DESC;

-- Изменение open interest за день
-- SELECT 
--     symbol,
--     exchange,
--     end_open_interest,
--     start_open_interest,
--     oi_change,
--     oi_change_percent,
--     avg_funding_rate,
--     total_liquidations
-- FROM aladdin.futures_daily_stats_mv
-- WHERE day = today()
-- ORDER BY abs(oi_change_percent) DESC
-- LIMIT 20;

