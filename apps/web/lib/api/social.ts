/**
 * Social/Scraper API Client
 */

import { API_BASE_URL } from "../runtime-env";

export type ScraperQueueStats = {
  pending: number;
  active: number;
  completed: number;
  failed: number;
};

export type RedditStatus = {
  subreddits: string[];
  lastScraped: string | null;
  postsCollected: number;
};

export type NewsStatus = {
  sources: string[];
  lastScraped: string | null;
  articlesCollected: number;
};

export type ScrapersOverview = {
  queues: Record<string, ScraperQueueStats> | null;
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
export async function getQueueStats(): Promise<
  Record<string, ScraperQueueStats>
> {
  const response = await fetch(`${API_BASE_URL}/api/social/queues/stats`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to get queue stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}
