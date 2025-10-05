-- Migration: Add advanced on-chain metrics columns
-- Date: 2025-10-05
-- Description: Extends on_chain_metrics table with advanced indicators

-- Add new columns for advanced on-chain metrics
ALTER TABLE on_chain_metrics
ADD COLUMN IF NOT EXISTS mvrv_ratio Float64,
ADD COLUMN IF NOT EXISTS sopr Float64,
ADD COLUMN IF NOT EXISTS nupl Float64,
ADD COLUMN IF NOT EXISTS exchange_reserve Float64,
ADD COLUMN IF NOT EXISTS puell_multiple Float64,
ADD COLUMN IF NOT EXISTS stock_to_flow Float64;

-- Add index for better query performance on blockchain and timestamp
CREATE INDEX IF NOT EXISTS idx_blockchain_timestamp 
ON on_chain_metrics (blockchain, timestamp);

-- Comments for documentation
COMMENT ON COLUMN on_chain_metrics.mvrv_ratio IS 'Market Value to Realized Value ratio - measures if asset is over/undervalued';
COMMENT ON COLUMN on_chain_metrics.sopr IS 'Spent Output Profit Ratio - indicates profit-taking or selling at loss';
COMMENT ON COLUMN on_chain_metrics.nupl IS 'Net Unrealized Profit/Loss - network-wide unrealized profit/loss';
COMMENT ON COLUMN on_chain_metrics.exchange_reserve IS 'Total balance on known exchange addresses';
COMMENT ON COLUMN on_chain_metrics.puell_multiple IS 'Mining revenue relative to 365-day MA';
COMMENT ON COLUMN on_chain_metrics.stock_to_flow IS 'Scarcity model - current supply divided by annual production (BTC only)';

