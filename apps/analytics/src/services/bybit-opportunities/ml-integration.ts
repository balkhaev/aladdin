/**
 * ML Integration Service
 * Integrates with ML service for anomaly detection
 */

import type { Logger } from "@aladdin/logger";
import type { MLAnomaly } from "./types";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:3013";

export class MLIntegrationService {
  private cache: Map<string, { anomalies: MLAnomaly[]; timestamp: number }> =
    new Map();
  private cacheTTL = 60_000; // 1 minute cache

  constructor(private logger: Logger) {}

  /**
   * Get ML anomalies for a symbol
   */
  async getAnomalies(symbol: string): Promise<MLAnomaly[] | undefined> {
    // Check cache first
    const cached = this.cache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.anomalies;
    }

    try {
      const response = await fetch(
        `${ML_SERVICE_URL}/api/ml/anomaly/detect/${symbol}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          // No data available for this symbol
          return;
        }
        throw new Error(`ML service error: ${response.statusText}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        data: MLAnomaly[];
      };

      if (result.success && result.data) {
        // Cache the result
        this.cache.set(symbol, {
          anomalies: result.data,
          timestamp: Date.now(),
        });

        return result.data;
      }

      return;
    } catch (error) {
      this.logger.debug("Failed to fetch ML anomalies (graceful degradation)", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }

  /**
   * Clear cache for a symbol
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      this.cache.delete(symbol);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys()),
    };
  }
}
