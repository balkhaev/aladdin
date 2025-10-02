import type { Logger } from "@aladdin/shared/logger";

type FearGreedConfig = {
  apiUrl: string;
  logger: Logger;
};

export type FearGreedData = {
  value: number; // 0-100
  value_classification: string; // Extreme Fear, Fear, Neutral, Greed, Extreme Greed
  timestamp: number;
  time_until_update: number;
};

const REQUEST_TIMEOUT_MS = 10_000;

export class FearGreedProvider {
  constructor(private config: FearGreedConfig) {}

  /**
   * Получить текущий Fear & Greed Index
   */
  async getCurrentIndex(): Promise<FearGreedData> {
    const url = `${this.config.apiUrl}/fng/`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Fear & Greed API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        name: string;
        data: Array<{
          value: string;
          value_classification: string;
          timestamp: string;
          time_until_update: string;
        }>;
        metadata: {
          error: null | string;
        };
      };

      if (data.metadata.error) {
        throw new Error(`Fear & Greed API error: ${data.metadata.error}`);
      }

      const latest = data.data[0];

      return {
        value: Number.parseInt(latest.value, 10),
        value_classification: latest.value_classification,
        timestamp: Number.parseInt(latest.timestamp, 10) * 1000, // Convert to ms
        time_until_update: Number.parseInt(latest.time_until_update, 10),
      };
    } catch (error) {
      this.config.logger.error("Fear & Greed API request failed", {
        url,
        error,
      });
      throw error;
    }
  }

  /**
   * Получить историю Fear & Greed Index
   */
  async getHistory(limit = 30): Promise<FearGreedData[]> {
    const url = `${this.config.apiUrl}/fng/?limit=${limit}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Fear & Greed API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        name: string;
        data: Array<{
          value: string;
          value_classification: string;
          timestamp: string;
          time_until_update: string;
        }>;
        metadata: {
          error: null | string;
        };
      };

      if (data.metadata.error) {
        throw new Error(`Fear & Greed API error: ${data.metadata.error}`);
      }

      return data.data.map((item) => ({
        value: Number.parseInt(item.value, 10),
        value_classification: item.value_classification,
        timestamp: Number.parseInt(item.timestamp, 10) * 1000,
        time_until_update: Number.parseInt(item.time_until_update, 10),
      }));
    } catch (error) {
      this.config.logger.error("Fear & Greed history request failed", {
        url,
        error,
      });
      throw error;
    }
  }

  /**
   * Интерпретация значения Fear & Greed
   */
  static interpretValue(value: number): {
    classification: string;
    description: string;
    recommendation: string;
  } {
    if (value >= 75) {
      return {
        classification: "Extreme Greed",
        description: "Market is extremely bullish, possible correction ahead",
        recommendation: "Consider taking profits",
      };
    }
    if (value >= 55) {
      return {
        classification: "Greed",
        description: "Market is bullish",
        recommendation: "Be cautious, monitor closely",
      };
    }
    if (value >= 45) {
      return {
        classification: "Neutral",
        description: "Market sentiment is balanced",
        recommendation: "Wait for clearer signals",
      };
    }
    if (value >= 25) {
      return {
        classification: "Fear",
        description: "Market is bearish",
        recommendation: "Look for buying opportunities",
      };
    }

    return {
      classification: "Extreme Fear",
      description: "Market is extremely bearish, potential bottom",
      recommendation: "Good buying opportunity for long-term",
    };
  }
}
