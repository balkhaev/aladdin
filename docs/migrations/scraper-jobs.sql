-- Scraper Jobs & Results Tables
-- Track all scraper jobs and their execution results

-- Scraper Jobs Table
CREATE TABLE IF NOT EXISTS aladdin.scraper_jobs (
    job_id String,
    queue_name String,
    job_type String,  -- reddit, twitter, news, telegram
    priority Int32,
    job_data String,  -- JSON data
    attempts Int32,
    max_attempts Int32,
    created_at DateTime,
    PRIMARY KEY (job_id, created_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (queue_name, created_at, job_id)
TTL created_at + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Scraper Job Results Table
CREATE TABLE IF NOT EXISTS aladdin.scraper_job_results (
    job_id String,
    queue_name String,
    success UInt8,
    items_processed Int32,
    duration_ms Int32,
    error Nullable(String),
    completed_at DateTime,
    created_at DateTime DEFAULT now(),
    PRIMARY KEY (job_id, completed_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(completed_at)
ORDER BY (queue_name, completed_at, job_id)
TTL completed_at + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Materialized view for job statistics by queue
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.scraper_job_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (queue_name, hour)
AS SELECT
    queue_name,
    toStartOfHour(completed_at) as hour,
    count() as total_jobs,
    countIf(success = 1) as successful_jobs,
    countIf(success = 0) as failed_jobs,
    avgIf(duration_ms, success = 1) as avg_duration_ms,
    sumIf(items_processed, success = 1) as total_items_processed,
    maxIf(duration_ms, success = 1) as max_duration_ms,
    minIf(duration_ms, success = 1) as min_duration_ms
FROM aladdin.scraper_job_results
GROUP BY queue_name, hour;

-- Index for queue lookups
ALTER TABLE aladdin.scraper_jobs 
ADD INDEX IF NOT EXISTS idx_queue_name queue_name 
TYPE bloom_filter GRANULARITY 1;

ALTER TABLE aladdin.scraper_job_results 
ADD INDEX IF NOT EXISTS idx_queue_name queue_name 
TYPE bloom_filter GRANULARITY 1;

