/**
 * AI Package
 * OpenAI GPT-5 integration для sentiment analysis и других AI задач
 */

// biome-ignore lint/performance/noBarrelFile: Centralized export point for package API
export { AICacheService } from "./cache";
export { OpenAIClientWrapper } from "./client";
export { GPTSentimentAnalyzer } from "./sentiment";
export { NewsAnalyzer } from "./news-analyzer";

export type {
  AIMetrics,
  CachedSentiment,
  GPTSentimentOptions,
  OpenAIConfig,
  SentimentInput,
  SentimentMode,
  SentimentScore,
} from "./types";

export type { NewsAnalysisResult, NewsInput } from "./news-analyzer";
