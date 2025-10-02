-- Twitter Tweets Storage
-- Stores tweets collected from crypto influencers for sentiment analysis

CREATE TABLE IF NOT EXISTS twitter_tweets (
    tweet_id String,
    username String,
    display_name String,
    text String,
    url String,
    datetime DateTime64(3),
    replies UInt32,
    retweets UInt32,
    likes UInt32,
    scraped_at DateTime64(3) DEFAULT now64(),
    symbols Array(String), -- Extracted crypto symbols from text
    sentiment_keywords Array(String), -- Extracted sentiment keywords
    PRIMARY KEY (tweet_id, username, datetime)
) ENGINE = ReplacingMergeTree(scraped_at)
PARTITION BY toYYYYMM(datetime)
ORDER BY (username, datetime, tweet_id)
TTL datetime + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Index for quick symbol lookups
CREATE INDEX IF NOT EXISTS idx_symbols ON twitter_tweets (symbols) TYPE bloom_filter GRANULARITY 1;

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_username ON twitter_tweets (username) TYPE bloom_filter GRANULARITY 1;

-- Materialized view for quick stats
CREATE MATERIALIZED VIEW IF NOT EXISTS twitter_tweets_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(datetime)
ORDER BY (username, toStartOfHour(datetime))
AS SELECT
    username,
    toStartOfHour(datetime) as hour,
    count() as tweet_count,
    sum(likes) as total_likes,
    sum(retweets) as total_retweets,
    sum(replies) as total_replies
FROM twitter_tweets
GROUP BY username, hour;

-- Table for tracking scraping runs
CREATE TABLE IF NOT EXISTS twitter_scrape_runs (
    run_id UUID DEFAULT generateUUIDv4(),
    started_at DateTime64(3),
    completed_at DateTime64(3),
    status Enum8('running' = 1, 'completed' = 2, 'failed' = 3),
    influencers_scraped UInt16,
    tweets_collected UInt32,
    error_message String,
    PRIMARY KEY (run_id, started_at)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(started_at)
ORDER BY (started_at, run_id)
TTL started_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

