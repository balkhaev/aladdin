/**
 * AI Package Types
 * Типы для работы с OpenAI GPT-5 и sentiment analysis
 */

/**
 * Sentiment Score from -1 (bearish) to +1 (bullish)
 */
export type SentimentScore = {
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  positive: number;
  negative: number;
  neutral: number;
  magnitude: number; // Overall strength of sentiment
};

/**
 * Input for sentiment analysis
 */
export type SentimentInput = {
  text: string;
  weight?: number; // For weighted averaging
  source?: string; // twitter, reddit, telegram
  engagement?: number; // likes, upvotes, retweets
};

/**
 * Sentiment analysis mode
 */
export type SentimentMode = "keyword" | "ai" | "hybrid";

/**
 * GPT sentiment analysis options
 */
export type GPTSentimentOptions = {
  /** Use batch processing for multiple texts */
  batch?: boolean;
  /** Force GPT analysis even for low engagement */
  forceGPT?: boolean;
  /** Maximum texts per batch request */
  maxBatchSize?: number;
  /** Cache TTL in seconds */
  cacheTTL?: number;
};

/**
 * OpenAI client configuration
 */
export type OpenAIConfig = {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
  rateLimit?: {
    maxRequestsPerHour?: number;
    maxRequestsPerMinute?: number;
  };
};

/**
 * AI service metrics
 */
export type AIMetrics = {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  totalTokensUsed: number;
  estimatedCost: number;
  averageLatency: number;
  rateLimitHits: number;
};

/**
 * Cache entry for sentiment results
 */
export type CachedSentiment = {
  sentiment: SentimentScore;
  timestamp: number;
  model: string;
};
