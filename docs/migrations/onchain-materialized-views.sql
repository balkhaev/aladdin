-- On-Chain Metrics Materialized Views
-- Date: 2025-10-06
-- Description: Pre-aggregated views for faster queries

-- Hourly Aggregated Metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS on_chain_metrics_hourly
ENGINE = AggregatingMergeTree()
PARTITION BY (blockchain, toYYYYMM(hour))
ORDER BY (blockchain, hour)
TTL hour + INTERVAL 90 DAY
AS SELECT
    blockchain,
    toStartOfHour(timestamp) as hour,
    avgState(whale_tx_count) as avg_whale_count,
    sumState(whale_tx_volume) as total_whale_volume,
    avgState(exchange_net_flow) as avg_net_flow,
    avgState(active_addresses) as avg_active_addresses,
    avgState(nvt_ratio) as avg_nvt,
    avgState(mvrv_ratio) as avg_mvrv,
    avgState(nupl) as avg_nupl,
    avgState(sopr) as avg_sopr,
    avgState(reserve_risk) as avg_reserve_risk,
    avgState(accumulation_score) as avg_accumulation,
    minState(reserve_risk) as min_reserve_risk,
    maxState(reserve_risk) as max_reserve_risk,
    countState() as data_points
FROM on_chain_metrics
GROUP BY blockchain, hour;

-- Daily Aggregated Metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS on_chain_metrics_daily
ENGINE = AggregatingMergeTree()
PARTITION BY (blockchain, toYear(day))
ORDER BY (blockchain, day)
TTL day + INTERVAL 2 YEAR
AS SELECT
    blockchain,
    toStartOfDay(timestamp) as day,
    avgState(whale_tx_count) as avg_whale_count,
    sumState(whale_tx_volume) as total_whale_volume,
    avgState(exchange_net_flow) as avg_net_flow,
    sumState(exchange_inflow) as total_inflow,
    sumState(exchange_outflow) as total_outflow,
    avgState(active_addresses) as avg_active_addresses,
    avgState(nvt_ratio) as avg_nvt,
    avgState(mvrv_ratio) as avg_mvrv,
    avgState(nupl) as avg_nupl,
    avgState(sopr) as avg_sopr,
    avgState(puell_multiple) as avg_puell,
    avgState(reserve_risk) as avg_reserve_risk,
    avgState(accumulation_score) as avg_accumulation,
    avgState(hodl_over5y) as avg_long_term_holders,
    minState(mvrv_ratio) as min_mvrv,
    maxState(mvrv_ratio) as max_mvrv,
    minState(nupl) as min_nupl,
    maxState(nupl) as max_nupl,
    sumState(binary_cdd) as cdd_events_count,
    countState() as data_points
FROM on_chain_metrics
GROUP BY blockchain, day;

-- Weekly Metrics Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS on_chain_metrics_weekly
ENGINE = AggregatingMergeTree()
PARTITION BY (blockchain, toYear(week))
ORDER BY (blockchain, week)
TTL week + INTERVAL 3 YEAR
AS SELECT
    blockchain,
    toMonday(timestamp) as week,
    avgState(whale_tx_count) as avg_whale_count,
    sumState(whale_tx_volume) as total_whale_volume,
    avgState(exchange_net_flow) as avg_net_flow,
    avgState(mvrv_ratio) as avg_mvrv,
    avgState(nupl) as avg_nupl,
    avgState(reserve_risk) as avg_reserve_risk,
    avgState(accumulation_score) as avg_accumulation,
    avgState(accumulation_trend_7d) as avg_trend_7d,
    avgState(accumulation_trend_30d) as avg_trend_30d,
    minState(reserve_risk) as min_reserve_risk,
    maxState(reserve_risk) as max_reserve_risk,
    countState() as data_points
FROM on_chain_metrics
GROUP BY blockchain, week;

-- Correlation Matrix Pre-calculation (Daily)
-- This view helps quickly calculate correlations between metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS on_chain_correlations_daily
ENGINE = AggregatingMergeTree()
PARTITION BY (blockchain, toYear(day))
ORDER BY (blockchain, day)
TTL day + INTERVAL 1 YEAR
AS SELECT
    blockchain,
    toStartOfDay(timestamp) as day,
    -- Store values for correlation calculation
    groupArrayState(mvrv_ratio) as mvrv_values,
    groupArrayState(nupl) as nupl_values,
    groupArrayState(sopr) as sopr_values,
    groupArrayState(reserve_risk) as reserve_risk_values,
    groupArrayState(accumulation_score) as accumulation_values,
    groupArrayState(exchange_net_flow) as net_flow_values,
    groupArrayState(whale_tx_count) as whale_count_values,
    groupArrayState(active_addresses) as active_addr_values,
    countState() as sample_count
FROM on_chain_metrics
WHERE mvrv_ratio IS NOT NULL 
  AND nupl IS NOT NULL
  AND reserve_risk IS NOT NULL
GROUP BY blockchain, day;

-- Extreme Events Tracking
CREATE MATERIALIZED VIEW IF NOT EXISTS on_chain_extreme_events
ENGINE = MergeTree()
PARTITION BY (blockchain, toYYYYMM(timestamp))
ORDER BY (blockchain, timestamp)
TTL timestamp + INTERVAL 180 DAY
AS SELECT
    timestamp,
    blockchain,
    -- MVRV extremes
    if(mvrv_ratio < 0.8, 'mvrv_undervalued', 
       if(mvrv_ratio > 3.7, 'mvrv_overvalued', '')) as mvrv_signal,
    -- NUPL extremes
    if(nupl < -0.25, 'nupl_capitulation',
       if(nupl > 0.75, 'nupl_euphoria', '')) as nupl_signal,
    -- Reserve Risk extremes
    if(reserve_risk < 0.002, 'reserve_accumulation',
       if(reserve_risk > 0.02, 'reserve_distribution', '')) as reserve_signal,
    -- Binary CDD events
    if(binary_cdd = 1, 'old_coins_moving', '') as cdd_signal,
    -- Values
    mvrv_ratio,
    nupl,
    reserve_risk,
    accumulation_score,
    binary_cdd
FROM on_chain_metrics
WHERE (mvrv_ratio < 0.8 OR mvrv_ratio > 3.7)
   OR (nupl < -0.25 OR nupl > 0.75)
   OR (reserve_risk < 0.002 OR reserve_risk > 0.02)
   OR binary_cdd = 1;

-- Alert Statistics (for monitoring alert frequency)
CREATE MATERIALIZED VIEW IF NOT EXISTS whale_alert_stats_hourly
ENGINE = SummingMergeTree()
PARTITION BY (blockchain, toYYYYMM(hour))
ORDER BY (blockchain, alert_type, hour)
TTL hour + INTERVAL 90 DAY
AS SELECT
    blockchain,
    alert_type,
    toStartOfHour(timestamp) as hour,
    count() as alert_count,
    sum(value) as total_value,
    avg(value) as avg_value,
    max(value) as max_value
FROM whale_alerts
GROUP BY blockchain, alert_type, hour;

