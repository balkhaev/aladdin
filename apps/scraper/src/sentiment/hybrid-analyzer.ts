/**
 * Hybrid Sentiment Analyzer
 * Комбинирует keyword-based и GPT-5 анализ для оптимального баланса скорость/качество/стоимость
 */

import type { GPTSentimentAnalyzer } from "@aladdin/ai";
import type { Logger } from "@aladdin/logger";
import type {
  SentimentAnalyzer,
  SentimentInput,
  SentimentScore,
} from "./analyzer";

const HIGH_ENGAGEMENT_THRESHOLD = 50; // likes/retweets/upvotes
const LOW_CONFIDENCE_THRESHOLD = 0.3;
const KEYWORD_SCORE_THRESHOLD = 0.1; // If keyword score is too close to neutral
const MIN_TEXT_LENGTH = 20; // Minimum text length to consider GPT
const MAX_TEXT_LENGTH = 500; // Maximum text length for GPT

export type HybridAnalyzerConfig = {
  /** Enable GPT analysis (can be disabled to fallback to keyword-only) */
  gptEnabled?: boolean;
  /** Force GPT for all texts (for testing) */
  forceGPT?: boolean;
  /** High engagement threshold for auto-GPT */
  highEngagementThreshold?: number;
  /** Low confidence threshold for auto-GPT */
  lowConfidenceThreshold?: number;
};

export type HybridAnalysisResult = {
  sentiment: SentimentScore;
  method: "keyword" | "gpt" | "hybrid";
  keywordResult?: SentimentScore;
  gptResult?: SentimentScore;
  reason: string;
};

export class HybridSentimentAnalyzer {
  private readonly config: Required<HybridAnalyzerConfig>;
  private stats = {
    totalAnalyses: 0,
    keywordOnly: 0,
    gptOnly: 0,
    hybrid: 0,
    gptFallbacks: 0,
  };

  constructor(
    private keywordAnalyzer: SentimentAnalyzer,
    private gptAnalyzer: GPTSentimentAnalyzer | null,
    private logger: Logger,
    config?: HybridAnalyzerConfig
  ) {
    this.config = {
      gptEnabled: config?.gptEnabled ?? true,
      forceGPT: config?.forceGPT ?? false,
      highEngagementThreshold:
        config?.highEngagementThreshold ?? HIGH_ENGAGEMENT_THRESHOLD,
      lowConfidenceThreshold:
        config?.lowConfidenceThreshold ?? LOW_CONFIDENCE_THRESHOLD,
    };

    this.logger.info("Hybrid sentiment analyzer initialized", {
      gptEnabled: this.config.gptEnabled,
      gptAvailable: this.gptAnalyzer !== null,
    });
  }

  /**
   * Analyze sentiment using hybrid approach
   */
  async analyze(input: SentimentInput): Promise<HybridAnalysisResult> {
    this.stats.totalAnalyses++;

    // Quick validation
    if (!input.text || input.text.length < MIN_TEXT_LENGTH) {
      return this.keywordOnlyAnalysis(
        input,
        "Text too short for meaningful analysis"
      );
    }

    // Step 1: Always run keyword analysis first (fast and free)
    const keywordResult = this.keywordAnalyzer.analyzeSingle(input.text);

    // Step 2: Decide if we need GPT
    const shouldUseGPT = this.shouldUseGPT(input, keywordResult);

    if (!shouldUseGPT) {
      return this.keywordOnlyAnalysis(input, "Keyword analysis sufficient");
    }

    // Step 3: Run GPT analysis
    if (!this.gptAnalyzer) {
      return this.keywordOnlyAnalysis(
        input,
        "GPT not available, using keyword fallback"
      );
    }

    if (!this.config.gptEnabled) {
      return this.keywordOnlyAnalysis(
        input,
        "GPT disabled, using keyword fallback"
      );
    }

    try {
      const gptResult = await this.gptAnalyzer.analyzeSingle(input.text);
      this.stats.gptOnly++;

      return {
        sentiment: gptResult,
        method: "gpt",
        keywordResult,
        gptResult,
        reason: "High engagement or low keyword confidence",
      };
    } catch (error) {
      this.logger.error("GPT analysis failed, falling back to keyword", {
        error,
      });
      this.stats.gptFallbacks++;
      return this.keywordOnlyAnalysis(input, "GPT failed, fallback to keyword");
    }
  }

  /**
   * Analyze multiple inputs in batch
   */
  async analyzeBatch(
    inputs: SentimentInput[]
  ): Promise<HybridAnalysisResult[]> {
    if (inputs.length === 0) {
      return [];
    }

    // Step 1: Run keyword analysis for all inputs
    const keywordResults = inputs.map((input) =>
      this.keywordAnalyzer.analyzeSingle(input.text)
    );

    // Step 2: Identify which texts need GPT
    const needsGPT: number[] = [];
    for (let i = 0; i < inputs.length; i++) {
      if (this.shouldUseGPT(inputs[i], keywordResults[i])) {
        needsGPT.push(i);
      }
    }

    this.logger.debug("Batch analysis", {
      total: inputs.length,
      needsGPT: needsGPT.length,
      keywordOnly: inputs.length - needsGPT.length,
    });

    // Step 3: If no GPT needed, return keyword results
    if (needsGPT.length === 0) {
      return inputs.map((_input, i) => ({
        sentiment: keywordResults[i],
        method: "keyword" as const,
        keywordResult: keywordResults[i],
        reason: "Keyword analysis sufficient",
      }));
    }

    // Step 4: Run GPT for selected texts
    if (!this.gptAnalyzer) {
      this.logger.warn("GPT needed but not available, using keyword for all");
      return inputs.map((_input, i) => ({
        sentiment: keywordResults[i],
        method: "keyword" as const,
        keywordResult: keywordResults[i],
        reason: "GPT not available",
      }));
    }

    if (!this.config.gptEnabled) {
      this.logger.warn("GPT disabled, using keyword for all");
      return inputs.map((_input, i) => ({
        sentiment: keywordResults[i],
        method: "keyword" as const,
        keywordResult: keywordResults[i],
        reason: "GPT disabled",
      }));
    }

    try {
      const textsForGPT = needsGPT.map((i) => inputs[i].text);
      const gptResults = await this.gptAnalyzer.analyzeBatch(textsForGPT);

      // Combine results
      const results: HybridAnalysisResult[] = [];
      let gptIndex = 0;

      for (let i = 0; i < inputs.length; i++) {
        const isGPTAnalysis = needsGPT.includes(i);

        if (isGPTAnalysis) {
          results.push({
            sentiment: gptResults[gptIndex],
            method: "gpt",
            keywordResult: keywordResults[i],
            gptResult: gptResults[gptIndex],
            reason: "High engagement or low keyword confidence",
          });
          gptIndex++;
          this.stats.gptOnly++;
        } else {
          results.push({
            sentiment: keywordResults[i],
            method: "keyword",
            keywordResult: keywordResults[i],
            reason: "Keyword analysis sufficient",
          });
          this.stats.keywordOnly++;
        }
      }

      return results;
    } catch (error) {
      this.logger.error("Batch GPT analysis failed, using keyword for all", {
        error,
      });
      this.stats.gptFallbacks += needsGPT.length;

      return inputs.map((_input, i) => ({
        sentiment: keywordResults[i],
        method: "keyword" as const,
        keywordResult: keywordResults[i],
        reason: "GPT failed, fallback to keyword",
      }));
    }
  }

  /**
   * Decide if GPT analysis should be used
   */
  private shouldUseGPT(
    input: SentimentInput,
    keywordResult: SentimentScore
  ): boolean {
    // Force GPT if configured (for testing)
    if (this.config.forceGPT) {
      return true;
    }

    // Skip if GPT not available
    if (!this.gptAnalyzer) {
      return false;
    }

    if (!this.config.gptEnabled) {
      return false;
    }

    // Skip if text is too long (expensive)
    if (input.text.length > MAX_TEXT_LENGTH) {
      return false;
    }

    // Use GPT for high engagement content
    const engagement = input.engagement ?? 0;
    if (engagement >= this.config.highEngagementThreshold) {
      this.logger.debug("Using GPT for high engagement", { engagement });
      return true;
    }

    // Use GPT for low keyword confidence
    if (keywordResult.confidence < this.config.lowConfidenceThreshold) {
      this.logger.debug("Using GPT for low keyword confidence", {
        confidence: keywordResult.confidence,
      });
      return true;
    }

    // Use GPT when keyword score is near neutral (ambiguous)
    if (Math.abs(keywordResult.score) < KEYWORD_SCORE_THRESHOLD) {
      this.logger.debug("Using GPT for neutral keyword score", {
        score: keywordResult.score,
      });
      return true;
    }

    return false;
  }

  /**
   * Return keyword-only result
   */
  private keywordOnlyAnalysis(
    _input: SentimentInput,
    reason: string
  ): HybridAnalysisResult {
    const sentiment = this.keywordAnalyzer.analyzeSingle(_input.text);
    this.stats.keywordOnly++;

    return {
      sentiment,
      method: "keyword",
      keywordResult: sentiment,
      reason,
    };
  }

  /**
   * Get analyzer statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalAnalyses: 0,
      keywordOnly: 0,
      gptOnly: 0,
      hybrid: 0,
      gptFallbacks: 0,
    };
  }
}
