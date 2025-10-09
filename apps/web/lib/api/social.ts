/**
 * Social/Scraper API Client
 */

import { API_BASE_URL } from "../runtime-env";

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

/**
 * Get scrapers overview
 */
export async function getScrapersOverview(): Promise<ScrapersOverview> {
  const response = await fetch(`${API_BASE_URL}/api/social/scrapers/overview`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to get scrapers overview: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<ScraperQueueStats[]> {
  const response = await fetch(`${API_BASE_URL}/api/social/queues/stats`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to get queue stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Trigger a scraper job manually
 */
export async function triggerScraper(
  type: "reddit" | "news"
): Promise<{ jobId: string; queued: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/social/queues/trigger`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ type }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to trigger ${type} scraper: ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.data;
}
