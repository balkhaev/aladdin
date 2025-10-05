-- AI Analyzed Content Feed
-- Сохраняет все тексты, проанализированные через GPT для отображения в ленте

CREATE TABLE IF NOT EXISTS aladdin.ai_analyzed_content (
    id String,
    content_type String,  -- tweet, reddit_post, telegram_message, news
    source String,        -- twitter, reddit, telegram, news source
    
    -- Original content
    title Nullable(String),
    text String,
    url Nullable(String),
    author Nullable(String),
    
    -- Metadata
    symbols Array(String),
    published_at DateTime,
    engagement Int32 DEFAULT 0,  -- likes, upvotes, etc
    
    -- AI Analysis Results
    ai_sentiment_score Float32,  -- -1 to 1
    ai_confidence Float32,       -- 0 to 1
    ai_method String,            -- keyword, gpt, hybrid
    ai_positive Int32,
    ai_negative Int32,
    ai_neutral Int32,
    ai_magnitude Float32,
    
    -- For news: additional fields
    ai_market_impact Nullable(String),  -- bullish, bearish, neutral, mixed
    ai_summary Nullable(String),
    ai_key_points Array(String),
    ai_affected_coins Array(String),
    
    -- System
    analyzed_at DateTime DEFAULT now(),
    created_at DateTime DEFAULT now(),
    
    PRIMARY KEY (id, analyzed_at)
) ENGINE = ReplacingMergeTree(created_at)
PARTITION BY toYYYYMM(analyzed_at)
ORDER BY (id, analyzed_at, content_type)
TTL analyzed_at + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Index for quick feed queries
ALTER TABLE aladdin.ai_analyzed_content 
ADD INDEX IF NOT EXISTS idx_analyzed_content_type content_type 
TYPE bloom_filter GRANULARITY 1;

-- Index for symbol lookups
ALTER TABLE aladdin.ai_analyzed_content 
ADD INDEX IF NOT EXISTS idx_analyzed_symbols symbols 
TYPE bloom_filter GRANULARITY 1;

-- Index for sentiment queries
ALTER TABLE aladdin.ai_analyzed_content 
ADD INDEX IF NOT EXISTS idx_analyzed_sentiment ai_sentiment_score 
TYPE minmax GRANULARITY 1;

-- Materialized view for feed stats
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.ai_analyzed_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(analyzed_at)
ORDER BY (content_type, toStartOfHour(analyzed_at))
AS SELECT
    content_type,
    toStartOfHour(analyzed_at) as hour,
    count() as total_count,
    countIf(ai_method = 'gpt') as gpt_count,
    countIf(ai_method = 'keyword') as keyword_count,
    avgIf(ai_sentiment_score, ai_sentiment_score IS NOT NULL) as avg_sentiment,
    sum(engagement) as total_engagement,
    analyzed_at
FROM aladdin.ai_analyzed_content
GROUP BY content_type, hour, analyzed_at;

