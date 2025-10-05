import type { Logger } from "@aladdin/logger";

/**
 * Sentiment Score: -1 (very bearish) to +1 (very bullish)
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
 * Text with metadata for sentiment analysis
 */
export type SentimentInput = {
  text: string;
  weight?: number; // For weighted averaging
  source?: string; // twitter, reddit, telegram
};

/**
 * Advanced Sentiment Analyzer
 * Uses lexicon-based approach with crypto-specific keywords
 */
// Regex patterns (defined at module level for performance)
const TOKENIZE_REGEX_REPLACE = /[^\p{L}\p{N}\s]/gu;
const TOKENIZE_REGEX_SPLIT = /\s+/;

export class SentimentAnalyzer {

  // Bullish keywords with weights
  private readonly BULLISH_KEYWORDS = new Map<string, number>([
    // Strong bullish (2.0)
    ["moon", 2.0],
    ["lambo", 2.0],
    ["to the moon", 2.0],
    ["🚀", 2.0],
    ["💎", 1.8],
    ["hodl", 1.5],

    // Moderate bullish (1.0-1.5)
    ["bullish", 1.5],
    ["bull", 1.3],
    ["pump", 1.5],
    ["rally", 1.4],
    ["surge", 1.4],
    ["breakout", 1.3],
    ["buy", 1.2],
    ["long", 1.2],
    ["calls", 1.1],
    ["accumulate", 1.3],
    ["buying opportunity", 1.4],

    // Positive sentiment (0.5-1.0)
    ["gains", 1.0],
    ["profit", 0.9],
    ["winning", 0.9],
    ["strong", 0.8],
    ["growth", 0.8],
    ["rise", 0.7],
    ["up", 0.6],
    ["good", 0.6],
    ["great", 0.8],
    ["excellent", 0.9],
    ["bullrun", 1.5],
    ["parabolic", 1.4],

    // Emojis
    ["📈", 1.0],
    ["🔥", 0.8],
    ["💪", 0.7],
    ["✅", 0.6],
    ["🎯", 0.7],
    ["⬆️", 0.8],
  ]);

  // Bearish keywords with weights
  private readonly BEARISH_KEYWORDS = new Map<string, number>([
    // Strong bearish (-2.0)
    ["crash", -2.0],
    ["scam", -2.0],
    ["rug pull", -2.0],
    ["rugpull", -2.0],
    ["rekt", -1.8],
    ["liquidated", -1.5],

    // Moderate bearish (-1.0 to -1.5)
    ["bearish", -1.5],
    ["bear", -1.3],
    ["dump", -1.5],
    ["sell", -1.2],
    ["short", -1.2],
    ["puts", -1.1],
    ["correction", -1.0],
    ["pullback", -0.9],
    ["resistance", -0.8],

    // Negative sentiment (-0.5 to -1.0)
    ["drop", -0.9],
    ["fall", -0.9],
    ["decline", -0.9],
    ["down", -0.7],
    ["loss", -1.0],
    ["losing", -0.9],
    ["weak", -0.8],
    ["bad", -0.7],
    ["terrible", -1.0],
    ["avoid", -0.8],
    ["warning", -0.7],
    ["risky", -0.6],

    // Emojis
    ["📉", -1.0],
    ["⚠️", -0.8],
    ["😰", -0.9],
    ["💀", -1.2],
    ["🔻", -0.8],
    ["⬇️", -0.8],
  ]);

  // Intensifiers (modify the strength of sentiment)
  private readonly INTENSIFIERS = new Map<string, number>([
    ["very", 1.5],
    ["extremely", 2.0],
    ["super", 1.8],
    ["really", 1.4],
    ["so", 1.3],
    ["absolutely", 1.8],
    ["highly", 1.6],
    ["incredibly", 1.9],
    ["massive", 1.7],
    ["huge", 1.6],
  ]);

  // Negators (flip sentiment)
  private readonly NEGATORS = new Set<string>([
    "not",
    "no",
    "never",
    "none",
    "nothing",
    "neither",
    "nowhere",
    "dont",
    "don't",
    "doesnt",
    "doesn't",
    "didnt",
    "didn't",
    "wont",
    "won't",
    "cant",
    "can't",
  ]);

  constructor(readonly _logger: Logger) {}

  /**
   * Analyze sentiment of a single text
   */
  analyzeSingle(text: string): SentimentScore {
    const tokens = this.tokenize(text);
    let totalScore = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let score = 0;

      // Check for bullish keywords
      for (const [keyword, weight] of this.BULLISH_KEYWORDS.entries()) {
        if (token.includes(keyword)) {
          score += weight;
        }
      }

      // Check for bearish keywords
      for (const [keyword, weight] of this.BEARISH_KEYWORDS.entries()) {
        if (token.includes(keyword)) {
          score += weight; // Already negative
        }
      }

      // Apply intensifiers (look at previous token)
      if (i > 0) {
        const prevToken = tokens[i - 1];
        for (const [intensifier, multiplier] of this.INTENSIFIERS.entries()) {
          if (prevToken.includes(intensifier)) {
            score *= multiplier;
          }
        }
      }

      // Apply negators (look at previous 2 tokens)
      const hasNegator =
        (i > 0 && this.NEGATORS.has(tokens[i - 1])) ||
        (i > 1 && this.NEGATORS.has(tokens[i - 2]));

      if (hasNegator) {
        score *= -1; // Flip sentiment
      }

      totalScore += score;

      if (score > 0.1) {
        positiveCount++;
      } else if (score < -0.1) {
        negativeCount++;
      } else if (score !== 0) {
        neutralCount++;
      }
    }

    // Normalize score to -1..1 range
    const normalizedScore = Math.max(-1, Math.min(1, totalScore / 10));

    // Calculate magnitude (strength of sentiment regardless of direction)
    const magnitude = Math.abs(normalizedScore);

    // Calculate confidence based on number of sentiment words found
    const totalSentimentWords = positiveCount + negativeCount;
    const confidence = Math.min(1, totalSentimentWords / 5); // Max confidence at 5 words

    return {
      score: normalizedScore,
      confidence,
      positive: positiveCount,
      negative: negativeCount,
      neutral: neutralCount,
      magnitude,
    };
  }

  /**
   * Analyze sentiment of multiple texts
   */
  analyzeMultiple(inputs: SentimentInput[]): SentimentScore {
    if (inputs.length === 0) {
      return {
        score: 0,
        confidence: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
        magnitude: 0,
      };
    }

    let totalScore = 0;
    let totalWeight = 0;
    let totalPositive = 0;
    let totalNegative = 0;
    let totalNeutral = 0;
    let totalMagnitude = 0;
    let totalConfidence = 0;

    for (const input of inputs) {
      const weight = input.weight || 1;
      const sentiment = this.analyzeSingle(input.text);

      totalScore += sentiment.score * weight;
      totalWeight += weight;
      totalPositive += sentiment.positive;
      totalNegative += sentiment.negative;
      totalNeutral += sentiment.neutral;
      totalMagnitude += sentiment.magnitude * weight;
      totalConfidence += sentiment.confidence * weight;
    }

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgMagnitude = totalWeight > 0 ? totalMagnitude / totalWeight : 0;
    const avgConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;

    return {
      score: avgScore,
      confidence: avgConfidence,
      positive: totalPositive,
      negative: totalNegative,
      neutral: totalNeutral,
      magnitude: avgMagnitude,
    };
  }

  /**
   * Tokenize text into lowercase words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(TOKENIZE_REGEX_REPLACE, " ") // Keep letters, numbers, spaces
      .split(TOKENIZE_REGEX_SPLIT)
      .filter((t) => t.length > 0);
  }
}

