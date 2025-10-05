-- Crypto News Storage
-- Stores crypto news articles for AI-powered analysis

CREATE TABLE IF NOT EXISTS aladdin.crypto_news (
    id String,
    title String,
    content String,
    summary Nullable(String),
    source String,  -- CoinDesk, Cointelegraph, Bitcoin.com, etc.
    author Nullable(String),
    url String,
    published_at DateTime,
    scraped_at DateTime DEFAULT now(),
    
    -- Extracted metadata
    symbols Array(String),  -- Mentioned crypto symbols
    categories Array(String),  -- regulation, adoption, technology, market, etc.
    
    -- AI Analysis (filled by GPT)
    ai_sentiment_score Nullable(Float32),  -- -1 to 1
    ai_market_impact Nullable(String),  -- bullish, bearish, neutral, mixed
    ai_summary Nullable(String),  -- GPT-generated summary
    ai_key_points Array(String),  -- Key takeaways
    ai_affected_coins Array(String),  -- Coins most affected
    ai_confidence Nullable(Float32),  -- 0 to 1
    ai_analyzed_at Nullable(DateTime),
    
    PRIMARY KEY (id, published_at)
) ENGINE = ReplacingMergeTree(scraped_at)
PARTITION BY toYYYYMM(published_at)
ORDER BY (source, published_at, id)
TTL published_at + INTERVAL 180 DAY
SETTINGS index_granularity = 8192;

-- Index for quick symbol lookups
CREATE INDEX IF NOT EXISTS idx_news_symbols 
ON aladdin.crypto_news (symbols) 
TYPE bloom_filter GRANULARITY 1;

-- Index for source lookups
CREATE INDEX IF NOT EXISTS idx_news_source 
ON aladdin.crypto_news (source) 
TYPE bloom_filter GRANULARITY 1;

-- Index for categories
CREATE INDEX IF NOT EXISTS idx_news_categories 
ON aladdin.crypto_news (categories) 
TYPE bloom_filter GRANULARITY 1;

-- Materialized view for news stats by source
CREATE MATERIALIZED VIEW IF NOT EXISTS aladdin.crypto_news_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(published_at)
ORDER BY (source, toStartOfDay(published_at))
AS SELECT
    source,
    toStartOfDay(published_at) as day,
    count() as articles_count,
    countIf(ai_analyzed_at IS NOT NULL) as analyzed_count,
    avgIf(ai_sentiment_score, ai_sentiment_score IS NOT NULL) as avg_sentiment,
    countIf(ai_market_impact = 'bullish') as bullish_count,
    countIf(ai_market_impact = 'bearish') as bearish_count,
    countIf(ai_market_impact = 'neutral') as neutral_count
FROM aladdin.crypto_news
GROUP BY source, day;

