/**
 * Social/Scraper API Client
 * Unified API client using apiGet/apiPost
 */

import { apiGet, apiPost } from "./client";

// ==================== Types ====================

export type ScraperQueueStats = {
  name: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
};

export type RedditStatus = {
  running: boolean;
  postsLimit: number;
  subreddits: number;
};

export type NewsStatus = {
  running: boolean;
  sources: Array<{ name: string; enabled: boolean }>;
  articlesLimit: number;
};

export type ScrapersOverview = {
  queues: ScraperQueueStats[] | null;
  reddit: RedditStatus | null;
  news: NewsStatus | null;
  timestamp: string;
};

export type TriggerScraperResult = {
  jobId: string;
  queued: boolean;
};

// ==================== API Functions ====================

/**
 * Get scrapers overview
 */
export function getScrapersOverview(): Promise<ScrapersOverview> {
  return apiGet<ScrapersOverview>("/api/social/scrapers/overview");
}

/**
 * Get queue statistics
 */
export function getQueueStats(): Promise<ScraperQueueStats[]> {
  return apiGet<ScraperQueueStats[]>("/api/social/queues/stats");
}

/**
 * Trigger a scraper job manually
 */
export function triggerScraper(
  type: "reddit" | "news"
): Promise<TriggerScraperResult> {
  return apiPost<TriggerScraperResult>("/api/social/queues/trigger", { type });
}
