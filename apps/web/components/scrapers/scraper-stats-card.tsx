"use client";

/**
 * Scraper Statistics Card
 * Shows real-time statistics for scraper queues
 */

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueueStats, type ScraperQueueStats } from "@/lib/api/social";

function QueueStatCard({ queue }: { queue: ScraperQueueStats }) {
  const total = queue.completed + queue.failed;
  const successRate = total > 0 ? (queue.completed / total) * 100 : 0;

  const getQueueLabel = (name: string) => {
    const cleanName = name.replace("scraper.", "");
    return cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-medium text-sm">
            {getQueueLabel(queue.name)}
          </CardTitle>
          {queue.active > 0 ? (
            <Badge className="gap-1" variant="default">
              <Activity className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge className="gap-1" variant="secondary">
              Idle
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Clock className="h-3 w-3" />
              Pending
            </div>
            <p className="font-semibold text-2xl">{queue.pending}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Loader2 className="h-3 w-3" />
              Active
            </div>
            <p className="font-semibold text-2xl">{queue.active}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-green-500 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </div>
            <p className="font-semibold text-2xl">{queue.completed}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-destructive text-xs">
              <XCircle className="h-3 w-3" />
              Failed
            </div>
            <p className="font-semibold text-2xl">{queue.failed}</p>
          </div>
        </div>

        {/* Success Rate */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="font-medium">{successRate.toFixed(1)}%</span>
            </div>
            <Progress className="h-2" value={successRate} />
          </div>
        )}

        {/* Last Processed */}
        {queue.lastProcessedAt && (
          <div className="text-muted-foreground text-xs">
            Last processed:{" "}
            {new Date(queue.lastProcessedAt).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="space-y-2" key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ScraperStatsCard() {
  const {
    data: queues,
    isLoading,
    error,
  } = useQuery<ScraperQueueStats[], Error>({
    queryKey: ["queue-stats"],
    queryFn: getQueueStats,
    refetchInterval: 10_000, // Refresh every 10 seconds
  });

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-muted-foreground text-sm">
              Failed to load queue statistics
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg">Queue Statistics</h3>
        <p className="text-muted-foreground text-sm">
          Real-time monitoring of scraper job queues
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading && (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        )}
        {!isLoading &&
          queues &&
          queues.length > 0 &&
          queues.map((queue) => (
            <QueueStatCard key={queue.name} queue={queue} />
          ))}
        {!isLoading && (!queues || queues.length === 0) && (
          <Card className="col-span-4">
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground text-sm">
                No queue data available
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
