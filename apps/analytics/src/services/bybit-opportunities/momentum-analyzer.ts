/**
 * Momentum Analyzer Service
 * Analyzes price momentum and volatility
 */

import type { Logger } from "@aladdin/logger";
import type { MomentumMetrics, PriceData } from "./types";

export class MomentumAnalyzer {
  constructor(private logger: Logger) {}

  /**
   * Calculate momentum metrics
   */
  calculateMomentum(priceData: PriceData[]): MomentumMetrics | null {
    if (priceData.length < 15) {
      return null;
    }

    try {
      const currentPrice = priceData.at(-1)?.price || 0;
      const price1mAgo = priceData.at(-2)?.price || currentPrice;
      const price5mAgo = priceData.at(-6)?.price || currentPrice;
      const price15mAgo = priceData.at(-16)?.price || currentPrice;

      const priceChange1m = ((currentPrice - price1mAgo) / price1mAgo) * 100;
      const priceChange5m = ((currentPrice - price5mAgo) / price5mAgo) * 100;
      const priceChange15m = ((currentPrice - price15mAgo) / price15mAgo) * 100;

      // Calculate volume spike
      const currentVolume = priceData.at(-1)?.volume || 0;
      const avgVolume =
        priceData.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20;
      const volumeSpike = avgVolume > 0 ? currentVolume / avgVolume : 1;

      // Calculate acceleration (change in momentum)
      const momentum1m = priceChange1m;
      const momentum5m = priceChange5m / 5;
      const acceleration = momentum1m - momentum5m;

      // Calculate volatility
      const prices = priceData.slice(-20).map((d) => d.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const variance =
        prices.reduce((sum, p) => sum + (p - avgPrice) ** 2, 0) / prices.length;
      const volatility = (Math.sqrt(variance) / avgPrice) * 100;

      return {
        priceChange1m,
        priceChange5m,
        priceChange15m,
        volumeSpike,
        acceleration,
        volatility,
      };
    } catch (error) {
      this.logger.error("Failed to calculate momentum", { error });
      return null;
    }
  }

  /**
   * Calculate momentum score (0-100)
   */
  calculateScore(metrics: MomentumMetrics): number {
    let score = 50; // Neutral

    // Price change scoring
    if (Math.abs(metrics.priceChange1m) > 2)
      score += 20; // Strong 1m move
    else if (Math.abs(metrics.priceChange1m) > 1) score += 10;

    if (Math.abs(metrics.priceChange5m) > 5)
      score += 15; // Strong 5m move
    else if (Math.abs(metrics.priceChange5m) > 2) score += 7;

    if (Math.abs(metrics.priceChange15m) > 10) score += 10; // Strong 15m move

    // Volume spike scoring
    if (metrics.volumeSpike > 3)
      score += 20; // Massive volume
    else if (metrics.volumeSpike > 2) score += 15;
    else if (metrics.volumeSpike > 1.5) score += 10;

    // Acceleration scoring
    if (Math.abs(metrics.acceleration) > 1) score += 10; // Accelerating

    // Volatility scoring
    if (metrics.volatility > 5)
      score += 10; // High volatility = opportunity
    else if (metrics.volatility > 3) score += 5;

    // Directional bias
    if (metrics.priceChange5m < 0) {
      score = 100 - score; // Invert for downward momentum
    }

    return Math.max(0, Math.min(100, score));
  }
}
