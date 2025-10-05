/**
 * News Analyzer
 * Анализирует крипто-новости через GPT для извлечения sentiment, impact, key points
 */

import type { Logger } from "@aladdin/logger";
import type { OpenAIClientWrapper } from "./client";
import type { AICacheService } from "./cache";

const TEMPERATURE = 0.3;
const MAX_TOKENS = 1000;

// Regex for extracting JSON from response
const JSON_EXTRACT_REGEX = /\{[\s\S]*\}/;

export type NewsAnalysisResult = {
  sentimentScore: number; // -1 to 1
  marketImpact: "bullish" | "bearish" | "neutral" | "mixed";
  summary: string;
  keyPoints: string[];
  affectedCoins: string[];
  confidence: number; // 0 to 1
  reasoning: string;
};

export type NewsInput = {
  title: string;
  content: string;
  source?: string;
  publishedAt?: Date;
};

const SYSTEM_PROMPT = `You are a cryptocurrency market analyst. Analyze news articles and extract:
1. Sentiment score (-1 to 1): How positive/negative for crypto market
2. Market impact: bullish, bearish, neutral, or mixed
3. Brief summary (2-3 sentences)
4. Key points (3-5 bullet points)
5. Most affected coins (list of symbols)
6. Confidence in analysis (0-1)
7. Brief reasoning for your assessment

Return ONLY a JSON object with this structure:
{
  "sentimentScore": <number -1 to 1>,
  "marketImpact": "<bullish|bearish|neutral|mixed>",
  "summary": "<2-3 sentence summary>",
  "keyPoints": ["<point 1>", "<point 2>", ...],
  "affectedCoins": ["BTC", "ETH", ...],
  "confidence": <number 0-1>,
  "reasoning": "<brief explanation>"
}

Guidelines:
- Consider regulatory news, adoption, technology developments, market movements
- Identify which specific cryptocurrencies are mentioned or affected
- Be objective and balanced in your analysis
- Higher confidence for clear, factual news; lower for speculation`;

export class NewsAnalyzer {
  private metrics = {
    totalAnalyses: 0,
    successfulAnalyses: 0,
    failedAnalyses: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(
    private client: OpenAIClientWrapper,
    private cache: AICacheService,
    private logger: Logger
  ) {}

  /**
   * Analyze a single news article
   */
  async analyze(news: NewsInput): Promise<NewsAnalysisResult> {
    this.metrics.totalAnalyses++;

    // Create cache key from title + content
    const cacheKey = `${news.title}:${news.content.substring(0, 100)}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      this.logger.debug("News analysis cache hit", {
        title: news.title.substring(0, 50),
      });
      // Return cached result as NewsAnalysisResult
      return this.sentimentToNewsResult(cached);
    }

    this.metrics.cacheMisses++;

    try {
      const prompt = this.buildPrompt(news);

      const response = await this.client.completion(prompt, {
        systemPrompt: SYSTEM_PROMPT,
        temperature: TEMPERATURE,
        maxTokens: MAX_TOKENS,
      });

      const result = this.parseResponse(response);

      // Cache the result (convert to SentimentScore format for cache)
      this.cache.set(
        cacheKey,
        {
          score: result.sentimentScore,
          confidence: result.confidence,
          positive: result.marketImpact === "bullish" ? 1 : 0,
          negative: result.marketImpact === "bearish" ? 1 : 0,
          neutral: result.marketImpact === "neutral" ? 1 : 0,
          magnitude: Math.abs(result.sentimentScore),
        },
        "gpt-news-analyzer"
      );

      this.metrics.successfulAnalyses++;

      this.logger.info("News analyzed successfully", {
        title: news.title.substring(0, 50),
        sentiment: result.sentimentScore,
        impact: result.marketImpact,
        coins: result.affectedCoins.length,
      });

      return result;
    } catch (error) {
      this.metrics.failedAnalyses++;
      this.logger.error("News analysis failed", {
        error,
        title: news.title.substring(0, 50),
      });
      throw error;
    }
  }

  /**
   * Analyze multiple news articles in batch
   */
  async analyzeBatch(newsItems: NewsInput[]): Promise<NewsAnalysisResult[]> {
    if (newsItems.length === 0) {
      return [];
    }

    this.logger.info("Batch analyzing news", { count: newsItems.length });

    // Process in parallel but with a reasonable limit
    const CONCURRENT_LIMIT = 3;
    const results: NewsAnalysisResult[] = [];

    for (let i = 0; i < newsItems.length; i += CONCURRENT_LIMIT) {
      const batch = newsItems.slice(i, i + CONCURRENT_LIMIT);
      const batchResults = await Promise.allSettled(
        batch.map((news) => this.analyze(news))
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          this.logger.error("Batch analysis item failed", {
            error: result.reason,
          });
          // Push neutral result on failure
          results.push(this.createNeutralResult());
        }
      }
    }

    return results;
  }

  /**
   * Build prompt for GPT
   */
  private buildPrompt(news: NewsInput): string {
    const sourceInfo = news.source ? `Source: ${news.source}\n` : "";
    const dateInfo = news.publishedAt
      ? `Published: ${news.publishedAt.toISOString()}\n`
      : "";

    return `Analyze this cryptocurrency news article:

${sourceInfo}${dateInfo}
Title: ${news.title}

Content:
${news.content}

Provide your analysis in JSON format.`;
  }

  /**
   * Parse GPT response to NewsAnalysisResult
   */
  private parseResponse(response: string): NewsAnalysisResult {
    try {
      const jsonMatch = response.match(JSON_EXTRACT_REGEX);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        sentimentScore: number;
        marketImpact: string;
        summary: string;
        keyPoints: string[];
        affectedCoins: string[];
        confidence: number;
        reasoning: string;
      };

      // Validate required fields
      if (
        parsed.sentimentScore === undefined ||
        !parsed.marketImpact ||
        !parsed.summary
      ) {
        throw new Error("Missing required fields in response");
      }

      // Normalize and validate
      const impact = this.normalizeMarketImpact(parsed.marketImpact);

      return {
        sentimentScore: Math.max(-1, Math.min(1, parsed.sentimentScore)),
        marketImpact: impact,
        summary: parsed.summary.trim(),
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.slice(0, 10)
          : [],
        affectedCoins: Array.isArray(parsed.affectedCoins)
          ? parsed.affectedCoins
              .slice(0, 20)
              .map((c) => c.toUpperCase().trim())
          : [],
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        reasoning: parsed.reasoning || "",
      };
    } catch (error) {
      this.logger.error("Failed to parse news analysis response", {
        error,
        response: response.substring(0, 200),
      });
      throw new Error("Failed to parse news analysis response");
    }
  }

  /**
   * Normalize market impact string
   */
  private normalizeMarketImpact(
    impact: string
  ): "bullish" | "bearish" | "neutral" | "mixed" {
    const normalized = impact.toLowerCase().trim();
    if (["bullish", "bearish", "neutral", "mixed"].includes(normalized)) {
      return normalized as "bullish" | "bearish" | "neutral" | "mixed";
    }
    return "neutral";
  }

  /**
   * Convert SentimentScore to NewsAnalysisResult (for cached results)
   */
  private sentimentToNewsResult(sentiment: {
    score: number;
    confidence: number;
  }): NewsAnalysisResult {
    let impact: "bullish" | "bearish" | "neutral" | "mixed" = "neutral";
    if (sentiment.score > 0.3) impact = "bullish";
    else if (sentiment.score < -0.3) impact = "bearish";

    return {
      sentimentScore: sentiment.score,
      marketImpact: impact,
      summary: "[Cached result - summary not available]",
      keyPoints: [],
      affectedCoins: [],
      confidence: sentiment.confidence,
      reasoning: "Cached analysis result",
    };
  }

  /**
   * Create neutral result for failed analyses
   */
  private createNeutralResult(): NewsAnalysisResult {
    return {
      sentimentScore: 0,
      marketImpact: "neutral",
      summary: "Analysis failed",
      keyPoints: [],
      affectedCoins: [],
      confidence: 0,
      reasoning: "Analysis failed or unavailable",
    };
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
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }
}

