"use client";

/**
 * Scrapers Admin Page
 * Monitor and manage all scraper jobs and queues
 */

import { Activity } from "lucide-react";
import { ScraperControlPanel } from "@/components/scrapers/scraper-control-panel";
import { ScraperStatsCard } from "@/components/scrapers/scraper-stats-card";

export default function ScrapersAdminPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <Activity className="size-6 text-purple-500" />
          </div>
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              Scraper Management
            </h1>
            <p className="text-muted-foreground">
              Monitor and control all data scraping operations
            </p>
          </div>
        </div>
      </div>

      {/* Queue Statistics */}
      <ScraperStatsCard />

      {/* Control Panel */}
      <ScraperControlPanel />

      {/* Additional Info */}
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
        <h4 className="mb-2 font-medium text-sm">About Scraper Queues</h4>
        <p className="text-muted-foreground text-xs leading-relaxed">
          All scrapers use NATS JetStream queues for reliable job processing.
          Jobs are automatically retried up to 3 times on failure with
          exponential backoff. Reddit scraper monitors 8 crypto subreddits every
          15 minutes, while News scraper checks CoinDesk every 10 minutes.
        </p>
      </div>
    </div>
  );
}
