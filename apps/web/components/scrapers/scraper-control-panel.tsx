"use client";

/**
 * Scraper Control Panel
 * Manual controls for triggering scraper jobs
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  Newspaper,
  Play,
  RefreshCw,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getScrapersOverview,
  type ScrapersOverview,
  triggerScraper,
} from "@/lib/api/social";

type ScraperStatus = {
  running: boolean;
  postsLimit?: number;
  sources?: Array<{ name: string; enabled: boolean }>;
  articlesLimit?: number;
  subreddits?: number;
};

type ScraperCardProps = {
  title: string;
  icon: React.ReactNode;
  status: ScraperStatus | null;
  onTrigger: () => void;
  isTriggering: boolean;
};

function ScraperCard({
  title,
  icon,
  status,
  onTrigger,
  isTriggering,
}: ScraperCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {status?.running ? (
            <Badge className="gap-1" variant="default">
              <Activity className="h-3 w-3" />
              Running
            </Badge>
          ) : (
            <Badge className="gap-1" variant="secondary">
              <Clock className="h-3 w-3" />
              Idle
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {status?.postsLimit !== undefined && (
            <div>
              <p className="text-muted-foreground text-xs">Posts Limit</p>
              <p className="font-medium">{status.postsLimit}</p>
            </div>
          )}
          {status?.subreddits !== undefined && (
            <div>
              <p className="text-muted-foreground text-xs">Subreddits</p>
              <p className="font-medium">{status.subreddits}</p>
            </div>
          )}
          {status?.articlesLimit !== undefined && (
            <div>
              <p className="text-muted-foreground text-xs">Articles Limit</p>
              <p className="font-medium">{status.articlesLimit}</p>
            </div>
          )}
          {status?.sources && (
            <div>
              <p className="text-muted-foreground text-xs">Sources</p>
              <p className="font-medium">{status.sources.length}</p>
            </div>
          )}
        </div>

        {/* Manual Trigger Button */}
        <Button
          className="w-full gap-2"
          disabled={isTriggering}
          onClick={onTrigger}
          size="sm"
        >
          {isTriggering ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Triggering...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Trigger Manual Scrape
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ScraperControlPanel() {
  const queryClient = useQueryClient();

  const { data: overview, isLoading } = useQuery<ScrapersOverview, Error>({
    queryKey: ["scrapers-overview"],
    queryFn: getScrapersOverview,
    refetchInterval: 10_000, // Refresh every 10 seconds
  });

  const triggerMutation = useMutation({
    mutationFn: (type: "reddit" | "news") => triggerScraper(type),
    onSuccess: (data, type) => {
      toast.success(
        `${type.charAt(0).toUpperCase() + type.slice(1)} scraper triggered`,
        {
          description: `Job ID: ${data.jobId}`,
        }
      );
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["scrapers-overview"] });
      queryClient.invalidateQueries({ queryKey: ["queue-stats"] });
    },
    onError: (error: Error, type) => {
      toast.error(`Failed to trigger ${type} scraper`, {
        description: error.message,
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">Scraper Control Panel</h3>
          <p className="text-muted-foreground text-sm">
            Manually trigger scraper jobs
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-12">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Scraper Control Panel</h3>
        <p className="text-muted-foreground text-sm">
          Manually trigger scraper jobs and monitor status
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScraperCard
          icon={<Twitter className="h-5 w-5 text-orange-500" />}
          isTriggering={
            triggerMutation.isPending && triggerMutation.variables === "reddit"
          }
          onTrigger={() => triggerMutation.mutate("reddit")}
          status={overview?.reddit || null}
          title="Reddit Scraper"
        />

        <ScraperCard
          icon={<Newspaper className="h-5 w-5 text-purple-500" />}
          isTriggering={
            triggerMutation.isPending && triggerMutation.variables === "news"
          }
          onTrigger={() => triggerMutation.mutate("news")}
          status={overview?.news || null}
          title="News Scraper"
        />
      </div>
    </div>
  );
}
