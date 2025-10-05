-- Reddit Posts Table
-- Stores scraped Reddit posts for sentiment analysis

CREATE TABLE IF NOT EXISTS aladdin.reddit_posts
(
    id String,
    title String,
    text String,
    author String,
    subreddit String,
    score Int64,
    upvote_ratio Float64,
    num_comments Int32,
    datetime DateTime,
    url String,
    flair Nullable(String),
    is_stickied UInt8,
    is_locked UInt8,
    symbols Array(String), -- Extracted crypto symbols
    analyzed_symbol Nullable(String), -- Symbol this was specifically analyzed for
    created_at DateTime DEFAULT now(),
    INDEX symbols_idx symbols TYPE bloom_filter GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(datetime)
ORDER BY (subreddit, datetime, score)
TTL datetime + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;

-- Reddit Comments Table
CREATE TABLE IF NOT EXISTS aladdin.reddit_comments
(
    id String,
    post_id String,
    parent_id Nullable(String),
    author String,
    text String,
    score Int64,
    datetime DateTime,
    depth Int32,
    is_submitter UInt8,
    created_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(datetime)
ORDER BY (post_id, datetime, score)
TTL datetime + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;

-- Reddit Sentiment Aggregation (Materialized View)
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.reddit_sentiment_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (subreddit, symbols, hour)
AS
SELECT
    subreddit,
    symbols,
    toStartOfHour(datetime) AS hour,
    count() AS posts_count,
    sum(score) AS total_score,
    avg(score) AS avg_score,
    sum(num_comments) AS total_comments
FROM aladdin.reddit_posts
WHERE length(symbols) > 0
GROUP BY subreddit, symbols, hour;

