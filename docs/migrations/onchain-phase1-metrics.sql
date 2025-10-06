-- Add Phase 1 Advanced Metrics to On-Chain Metrics Table
-- Date: 2025-10-06
-- Description: Adds Reserve Risk, Accumulation Trend, HODL Waves, and Binary CDD metrics

-- Add new columns to existing table
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS reserve_risk Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS accumulation_score Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS accumulation_trend_7d Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS accumulation_trend_30d Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS accumulation_trend_90d Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_under1m Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_m1to3 Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_m3to6 Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_m6to12 Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_y1to2 Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_y2to3 Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_y3to5 Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS hodl_over5y Nullable(Float64);
ALTER TABLE on_chain_metrics ADD COLUMN IF NOT EXISTS binary_cdd Nullable(UInt8);

-- Add indexes for new metrics
ALTER TABLE on_chain_metrics ADD INDEX IF NOT EXISTS idx_reserve_risk reserve_risk TYPE minmax GRANULARITY 4;
ALTER TABLE on_chain_metrics ADD INDEX IF NOT EXISTS idx_accumulation accumulation_score TYPE minmax GRANULARITY 4;
ALTER TABLE on_chain_metrics ADD INDEX IF NOT EXISTS idx_binary_cdd binary_cdd TYPE set(0) GRANULARITY 1;

