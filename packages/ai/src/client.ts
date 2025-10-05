/**
 * OpenAI Client Configuration
 * Клиент для работы с OpenAI GPT-5 API
 */

import type { Logger } from "@aladdin/logger";
import OpenAI from "openai";
import type { OpenAIConfig } from "./types";

const DEFAULT_MODEL = "gpt-4o"; // Will be updated to gpt-5 when available
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_REQUESTS_PER_HOUR = 100;
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 10;

export class OpenAIClientWrapper {
  private client: OpenAI;
  private config: Required<OpenAIConfig>;
  private requestCount = 0;
  private requestTimestamps: number[] = [];
  private logger: Logger;

  constructor(config: OpenAIConfig, logger: Logger) {
    this.logger = logger;
    this.config = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_MODEL,
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      timeout: config.timeout || DEFAULT_TIMEOUT_MS,
      rateLimit: {
        maxRequestsPerHour:
          config.rateLimit?.maxRequestsPerHour || DEFAULT_MAX_REQUESTS_PER_HOUR,
        maxRequestsPerMinute:
          config.rateLimit?.maxRequestsPerMinute ||
          DEFAULT_MAX_REQUESTS_PER_MINUTE,
      },
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });

    this.logger.info("OpenAI client initialized", {
      model: this.config.model,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Check rate limits before making request
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    const oneMinuteAgo = now - 60_000;

    // Clean old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > oneHourAgo
    );

    // Check hour limit
    const requestsLastHour = this.requestTimestamps.length;
    if (requestsLastHour >= this.config.rateLimit.maxRequestsPerHour) {
      this.logger.warn("Rate limit exceeded (hour)", {
        requestsLastHour,
        limit: this.config.rateLimit.maxRequestsPerHour,
      });
      return false;
    }

    // Check minute limit
    const requestsLastMinute = this.requestTimestamps.filter(
      (ts) => ts > oneMinuteAgo
    ).length;
    if (requestsLastMinute >= this.config.rateLimit.maxRequestsPerMinute) {
      this.logger.warn("Rate limit exceeded (minute)", {
        requestsLastMinute,
        limit: this.config.rateLimit.maxRequestsPerMinute,
      });
      return false;
    }

    return true;
  }

  /**
   * Record request timestamp
   */
  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
    this.requestCount++;
  }

  /**
   * Make completion request to GPT
   */
  async completion(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<string> {
    // Check rate limits
    if (!this.checkRateLimit()) {
      throw new Error("Rate limit exceeded");
    }

    const startTime = Date.now();

    try {
      this.logger.debug("Making OpenAI completion request", {
        model: this.config.model,
        promptLength: prompt.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          ...(options?.systemPrompt
            ? [{ role: "system" as const, content: options.systemPrompt }]
            : []),
          { role: "user" as const, content: prompt },
        ],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 500,
      });

      this.recordRequest();

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const latency = Date.now() - startTime;
      this.logger.debug("OpenAI completion success", {
        latency,
        tokensUsed: response.usage?.total_tokens,
      });

      return content;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.logger.error("OpenAI completion failed", {
        error,
        latency,
      });
      throw error;
    }
  }

  /**
   * Get client statistics
   */
  getStats(): {
    totalRequests: number;
    requestsLastHour: number;
    requestsLastMinute: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3_600_000;
    const oneMinuteAgo = now - 60_000;

    return {
      totalRequests: this.requestCount,
      requestsLastHour: this.requestTimestamps.filter((ts) => ts > oneHourAgo)
        .length,
      requestsLastMinute: this.requestTimestamps.filter(
        (ts) => ts > oneMinuteAgo
      ).length,
    };
  }
}
