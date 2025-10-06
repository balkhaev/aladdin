/**
 * Scoring Engine Service
 * Combines technical, momentum, and ML scores with weighted scoring
 */

import type {
  MLAnomaly,
  MomentumMetrics,
  OpportunityScore,
  OpportunitySignal,
  OpportunityStrength,
  TechnicalIndicators,
} from "./types";

// Weights for scoring (must sum to 100)
const TECHNICAL_WEIGHT = 40;
const MOMENTUM_WEIGHT = 30;
const ML_WEIGHT = 30;

const ML_CONFIDENCE_THRESHOLD = process.env.ML_CONFIDENCE_THRESHOLD
  ? Number(process.env.ML_CONFIDENCE_THRESHOLD)
  : 70;
const SCORE_THRESHOLD_BUY = process.env.SCORE_THRESHOLD_BUY
  ? Number(process.env.SCORE_THRESHOLD_BUY)
  : 60;
const SCORE_THRESHOLD_SELL = process.env.SCORE_THRESHOLD_SELL
  ? Number(process.env.SCORE_THRESHOLD_SELL)
  : 40;

export class ScoringEngine {
  /**
   * Calculate combined opportunity score
   */
  calculateScore(params: {
    technicalScore: number;
    momentumScore: number;
    mlAnomalies?: MLAnomaly[];
    technicalIndicators: TechnicalIndicators;
    momentumMetrics: MomentumMetrics;
  }): OpportunityScore {
    const {
      technicalScore,
      momentumScore,
      mlAnomalies,
      technicalIndicators,
      momentumMetrics,
    } = params;

    // Calculate ML confidence
    const mlConfidence = this.calculateMLConfidence(mlAnomalies);

    // Decide whether to include ML score
    const includeML = mlConfidence >= ML_CONFIDENCE_THRESHOLD;

    // Calculate weighted total score
    let total: number;
    if (includeML) {
      total =
        (technicalScore * TECHNICAL_WEIGHT +
          momentumScore * MOMENTUM_WEIGHT +
          mlConfidence * ML_WEIGHT) /
        100;
    } else {
      // If ML not available, redistribute weights
      const adjustedTechnicalWeight = TECHNICAL_WEIGHT + ML_WEIGHT / 2;
      const adjustedMomentumWeight = MOMENTUM_WEIGHT + ML_WEIGHT / 2;
      total =
        (technicalScore * adjustedTechnicalWeight +
          momentumScore * adjustedMomentumWeight) /
        (adjustedTechnicalWeight + adjustedMomentumWeight);
    }

    // Determine signal
    const signal = this.determineSignal(total);

    // Determine strength
    const strength = this.determineStrength(
      total,
      technicalIndicators,
      momentumMetrics,
      mlAnomalies
    );

    // Calculate overall confidence
    const confidence = this.calculateConfidence(
      technicalScore,
      momentumScore,
      mlConfidence,
      includeML
    );

    return {
      total: Math.round(total * 100) / 100,
      technical: Math.round(technicalScore * 100) / 100,
      momentum: Math.round(momentumScore * 100) / 100,
      mlConfidence: Math.round(mlConfidence * 100) / 100,
      signal,
      strength,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /**
   * Determine trading signal from total score
   */
  private determineSignal(totalScore: number): OpportunitySignal {
    if (totalScore >= SCORE_THRESHOLD_BUY) {
      return "BUY";
    }
    if (totalScore <= SCORE_THRESHOLD_SELL) {
      return "SELL";
    }
    return "NEUTRAL";
  }

  /**
   * Determine signal strength based on multiple factors
   */
  private determineStrength(
    totalScore: number,
    technicalIndicators: TechnicalIndicators,
    momentumMetrics: MomentumMetrics,
    mlAnomalies?: MLAnomaly[]
  ): OpportunityStrength {
    let strengthScore = 0;

    // Score is far from neutral
    if (totalScore > 80 || totalScore < 20) {
      strengthScore += 2;
    } else if (totalScore > 70 || totalScore < 30) {
      strengthScore += 1;
    }

    // Technical indicators show strong signals
    if (technicalIndicators.rsi < 30 || technicalIndicators.rsi > 70) {
      strengthScore += 1;
    }
    if (technicalIndicators.adx > 25) {
      strengthScore += 1;
    }

    // Strong momentum
    if (Math.abs(momentumMetrics.priceChange5m) > 2) {
      strengthScore += 1;
    }
    if (momentumMetrics.volumeSpike > 2) {
      strengthScore += 1;
    }

    // ML anomalies detected
    if (mlAnomalies && mlAnomalies.length > 0) {
      const hasCritical = mlAnomalies.some((a) => a.severity === "CRITICAL");
      const hasHigh = mlAnomalies.some((a) => a.severity === "HIGH");
      if (hasCritical) {
        strengthScore += 2;
      } else if (hasHigh) {
        strengthScore += 1;
      }
    }

    // Determine strength category
    if (strengthScore >= 5) return "STRONG";
    if (strengthScore >= 3) return "MODERATE";
    return "WEAK";
  }

  /**
   * Calculate ML confidence from anomalies
   */
  private calculateMLConfidence(mlAnomalies?: MLAnomaly[]): number {
    if (!mlAnomalies || mlAnomalies.length === 0) {
      return 0;
    }

    // Weight anomalies by severity
    let totalWeight = 0;
    let weightedConfidence = 0;

    for (const anomaly of mlAnomalies) {
      let weight = 1;
      switch (anomaly.severity) {
        case "CRITICAL":
          weight = 4;
          break;
        case "HIGH":
          weight = 3;
          break;
        case "MEDIUM":
          weight = 2;
          break;
        case "LOW":
          weight = 1;
          break;
        default:
          weight = 1;
          break;
      }

      totalWeight += weight;
      weightedConfidence += anomaly.confidence * weight;
    }

    return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
  }

  /**
   * Calculate overall confidence (0-100)
   */
  private calculateConfidence(
    technicalScore: number,
    momentumScore: number,
    mlConfidence: number,
    includeML: boolean
  ): number {
    // Confidence is higher when scores agree
    const scores = includeML
      ? [technicalScore, momentumScore, mlConfidence]
      : [technicalScore, momentumScore];

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Calculate variance (how much scores disagree)
    const variance =
      scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) /
      scores.length;
    const stdDev = Math.sqrt(variance);

    // Lower variance = higher confidence
    // Normalize: stdDev of 0 = 100% confidence, stdDev of 50 = 0% confidence
    const maxStdDev = 50;
    const normalizedConfidence = Math.max(
      0,
      Math.min(100, 100 - (stdDev / maxStdDev) * 100)
    );

    // Also factor in how extreme the mean score is
    const extremeness = Math.abs(mean - 50) / 50; // 0 to 1
    const extremenessBonus = extremeness * 20; // Up to 20 points

    return Math.min(100, normalizedConfidence + extremenessBonus);
  }

  /**
   * Check if score meets minimum thresholds for opportunity
   */
  isValidOpportunity(score: OpportunityScore): boolean {
    // Must have a clear signal (not neutral)
    if (score.signal === "NEUTRAL") {
      return false;
    }

    // Must meet minimum score threshold
    if (score.signal === "BUY" && score.total < SCORE_THRESHOLD_BUY) {
      return false;
    }
    if (score.signal === "SELL" && score.total > SCORE_THRESHOLD_SELL) {
      return false;
    }

    // Minimum confidence requirement
    if (score.confidence < 50) {
      return false;
    }

    return true;
  }
}
