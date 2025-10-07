/**
 * Executor Statistics Card
 * Displays real-time statistics for the strategy executor
 */

import { Activity, CheckCircle, TrendingUp, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutorStats } from "@/hooks/use-executor";

const PERCENT_DECIMALS = 1;
const PERCENT_MULTIPLIER = 100;

export function ExecutorStatsCard() {
  const { data: stats, isLoading, error } = useExecutorStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executor Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executor Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load executor statistics
          </div>
        </CardContent>
      </Card>
    );
  }

  const successRate =
    stats.totalOrdersExecuted > 0
      ? (stats.totalOrdersSuccessful / stats.totalOrdersExecuted) *
        PERCENT_MULTIPLIER
      : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Executor Statistics</CardTitle>
          <div className="flex gap-2">
            <Badge
              className="text-xs"
              variant={stats.mode === "LIVE" ? "destructive" : "secondary"}
            >
              {stats.mode}
            </Badge>
            <Badge
              className="text-xs"
              variant={stats.autoExecute ? "default" : "outline"}
            >
              {stats.autoExecute ? "AUTO" : "MANUAL"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div className="text-muted-foreground text-xs">
                Signals Received
              </div>
            </div>
            <div className="mt-2 font-bold text-2xl">
              {stats.totalSignalsReceived}
            </div>
            <div className="text-muted-foreground text-xs">
              {stats.totalSignalsProcessed} processed
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <div className="text-muted-foreground text-xs">
                Orders Executed
              </div>
            </div>
            <div className="mt-2 font-bold text-2xl">
              {stats.totalOrdersExecuted}
            </div>
            <div className="text-muted-foreground text-xs">
              {successRate.toFixed(PERCENT_DECIMALS)}% success rate
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div className="text-muted-foreground text-xs">Successful</div>
            </div>
            <div className="mt-2 font-bold text-2xl text-green-500">
              {stats.totalOrdersSuccessful}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <div className="text-muted-foreground text-xs">Failed</div>
            </div>
            <div className="mt-2 font-bold text-2xl text-red-500">
              {stats.totalOrdersFailed}
            </div>
          </div>
        </div>

        {/* Active Positions */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="text-muted-foreground text-xs">Open Positions</div>
            <div className="mt-2 font-bold text-xl">
              {stats.currentOpenPositions}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="text-muted-foreground text-xs">
              Algorithmic Executions
            </div>
            <div className="mt-2 font-bold text-xl">
              {stats.activeAlgorithmicExecutions}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
