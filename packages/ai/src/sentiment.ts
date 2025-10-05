/**
 * GPT-5 Sentiment Analyzer
 * Использует OpenAI GPT для анализа sentiment криптовалютных текстов
 */

import type { Logger } from "@aladdin/logger";
import type { AICacheService } from "./cache";
import type { OpenAIClientWrapper } from "./client";
import type { GPTSentimentOptions, SentimentScore } from "./types";

const DEFAULT_MAX_BATCH_SIZE = 10;
const DEFAULT_CACHE_TTL = 86_400; // 24 hours in seconds
const TEMPERATURE = 0.3; // Low temperature for consistent results
const MAX_TOKENS = 500;

// Regex for extracting JSON from response
const JSON_EXTRACT_REGEX = /\{[\s\S]*\}/;

const SYSTEM_PROMPT = `You are a cryptocurrency sentiment analyzer. Analyze the sentiment of crypto-related social media posts.

Return ONLY a JSON object with this exact structure:
{
  "sentiments": [
    {
      "score": <number between -1 and 1>,
      "confidence": <number between 0 and 1>,
      "positive": <count of positive signals>,
      "negative": <count of negative signals>,
      "neutral": <count of neutral signals>,
      "magnitude": <number between 0 and 1>
    }
  ]
}

Scoring guidelines:
- score: -1 (very bearish) to +1 (very bullish)
- confidence: How confident you are in the analysis (0-1)
- magnitude: Strength of sentiment regardless of direction (0-1)
- Consider crypto-specific terms, emojis, and context
- Be aware of sarcasm and irony`;

export class GPTSentimentAnalyzer {
  private readonly maxBatchSize: number;
  private readonly cacheTTL: number;
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(
    private client: OpenAIClientWrapper,
    private cache: AICacheService,
    private logger: Logger,
    options?: GPTSentimentOptions
  ) {
    this.maxBatchSize = options?.maxBatchSize || DEFAULT_MAX_BATCH_SIZE;
    this.cacheTTL = options?.cacheTTL || DEFAULT_CACHE_TTL;
  }

  /**
   * Analyze sentiment of a single text
   */
  async analyzeSingle(
    text: string,
    options?: { skipCache?: boolean }
  ): Promise<SentimentScore> {
    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cache.get(text);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    const results = await this.analyzeBatch([text]);
    return results[0];
  }

  /**
   * Analyze sentiment of multiple texts in batch
   */
  async analyzeBatch(texts: string[]): Promise<SentimentScore[]> {
    if (texts.length === 0) {
      return [];
    }

    // Split into batches if needed
    if (texts.length > this.maxBatchSize) {
      return this.processBatches(texts);
    }

    this.metrics.totalRequests++;

    try {
      // Check cache for all texts
      const results: (SentimentScore | null)[] = texts.map((text) =>
        this.cache.get(text)
      );

      const uncachedIndices: number[] = [];
      for (let i = 0; i < results.length; i++) {
        if (results[i] === null) {
          uncachedIndices.push(i);
        } else {
          this.metrics.cacheHits++;
        }
      }

      // If all cached, return early
      if (uncachedIndices.length === 0) {
        return results as SentimentScore[];
      }

      this.metrics.cacheMisses += uncachedIndices.length;

      // Analyze uncached texts
      const uncachedTexts = uncachedIndices.map((i) => texts[i]);
      const prompt = this.buildPrompt(uncachedTexts);

      const response = await this.client.completion(prompt, {
        systemPrompt: SYSTEM_PROMPT,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
      });

      const parsedResults = this.parseResponse(response, uncachedTexts.length);

      // Cache results
      for (let i = 0; i < uncachedIndices.length; i++) {
        const textIndex = uncachedIndices[i];
        const sentiment = parsedResults[i];
        results[textIndex] = sentiment;
        this.cache.set(texts[textIndex], sentiment, "gpt-5");
      }

      this.metrics.successfulRequests++;
      return results as SentimentScore[];
    } catch (error) {
      this.metrics.failedRequests++;
      this.logger.error("GPT sentiment analysis failed", { error });
      throw error;
    }
  }

  /**
   * Process texts in multiple batches
   */
  private async processBatches(texts: string[]): Promise<SentimentScore[]> {
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      batches.push(texts.slice(i, i + this.maxBatchSize));
    }

    this.logger.info("Processing multiple batches", {
      totalTexts: texts.length,
      batches: batches.length,
    });

    const results: SentimentScore[] = [];
    for (const batch of batches) {
      const batchResults = await this.analyzeBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Build prompt for GPT
   */
  private buildPrompt(texts: string[]): string {
    const textList = texts
      .map((text, i) => `${i + 1}. "${text.replace(/"/g, '\\"')}"`)
      .join("\n");

    return `Analyze the sentiment of these ${texts.length} crypto social media post(s):

${textList}

Return a JSON object with "sentiments" array containing ${texts.length} sentiment object(s), one for each post in order.`;
  }

  /**
   * Parse GPT response to SentimentScore array
   */
  private parseResponse(
    response: string,
    expectedCount: number
  ): SentimentScore[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(JSON_EXTRACT_REGEX);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        sentiments: Array<{
          score: number;
          confidence: number;
          positive: number;
          negative: number;
          neutral: number;
          magnitude: number;
        }>;
      };

      if (!Array.isArray(parsed.sentiments)) {
        throw new Error(
          "Invalid response structure: sentiments must be an array"
        );
      }

      if (parsed.sentiments.length !== expectedCount) {
        this.logger.warn("Sentiment count mismatch", {
          expected: expectedCount,
          received: parsed.sentiments.length,
        });
      }

      // Validate and normalize each sentiment
      return parsed.sentiments.map((s) => {
        const score = s.score ?? 0;
        const confidence = s.confidence ?? 0;
        const positive = s.positive ?? 0;
        const negative = s.negative ?? 0;
        const neutral = s.neutral ?? 0;
        const magnitude = s.magnitude ?? 0;

        return {
          score: Math.max(-1, Math.min(1, score)),
          confidence: Math.max(0, Math.min(1, confidence)),
          positive: Math.max(0, Math.round(positive)),
          negative: Math.max(0, Math.round(negative)),
          neutral: Math.max(0, Math.round(neutral)),
          magnitude: Math.max(0, Math.min(1, magnitude)),
        };
      });
    } catch (error) {
      this.logger.error("Failed to parse GPT response", { error, response });
      throw new Error("Failed to parse sentiment analysis response");
    }
  }

  /**
   * Get analyzer metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }
}
