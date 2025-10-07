/**
 * Cache Monitoring Card
 * Displays cache statistics and controls
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Database,
  Loader2,
  RefreshCw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useCacheStats, useFlushCache } from "../hooks/use-cache-monitoring";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Progress } from "./ui/progress";

const PERCENTAGE_MULTIPLIER = 100;

function getHitRateVariant(hitRate: number) {
  if (hitRate > 80) return "default";
  if (hitRate > 50) return "secondary";
  return "destructive";
}

function getHitRateMessage(hitRate: number) {
  if (hitRate > 80) return "✓ Excellent cache performance";
  if (hitRate > 50) return "⚠ Moderate cache performance";
  return "✗ Poor cache performance";
}

export function CacheMonitoringCard() {
  const [showFlushDialog, setShowFlushDialog] = useState(false);
  const { data: stats, isLoading, error, refetch } = useCacheStats();
  const flushMutation = useFlushCache();

  const handleFlush = async () => {
    await flushMutation.mutateAsync();
    setShowFlushDialog(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cache Monitoring
            </CardTitle>
            <div className="flex gap-2">
              <Button
                disabled={isLoading}
                onClick={() => refetch()}
                size="sm"
                variant="ghost"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                disabled={!stats?.enabled}
                onClick={() => setShowFlushDialog(true)}
                size="sm"
                variant="destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Flush Cache
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>Error: {error.message}</span>
            </div>
          )}

          {stats && !stats.enabled && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Redis cache is not configured or disabled</span>
            </div>
          )}

          {stats?.enabled && (
            <div className="space-y-6">
              {/* Hit Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Cache Hit Rate</span>
                  <Badge variant={getHitRateVariant(stats.hitRate)}>
                    {(stats.hitRate * PERCENTAGE_MULTIPLIER).toFixed(1)}%
                  </Badge>
                </div>
                <Progress
                  className="h-2"
                  value={stats.hitRate * PERCENTAGE_MULTIPLIER}
                />
                <p className="text-slate-400 text-xs">
                  {getHitRateMessage(stats.hitRate)}
                </p>
              </div>

              {/* Statistics Grid */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Hits */}
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-slate-400 text-sm">Cache Hits</span>
                  </div>
                  <p className="font-bold font-mono text-2xl text-green-400">
                    {stats.hits.toLocaleString()}
                  </p>
                </div>

                {/* Misses */}
                <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-400" />
                    <span className="text-slate-400 text-sm">Cache Misses</span>
                  </div>
                  <p className="font-bold font-mono text-2xl text-orange-400">
                    {stats.misses.toLocaleString()}
                  </p>
                </div>

                {/* Total Operations */}
                <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-400" />
                    <span className="text-slate-400 text-sm">
                      Total Operations
                    </span>
                  </div>
                  <p className="font-bold font-mono text-2xl text-blue-400">
                    {(stats.hits + stats.misses).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <span className="text-slate-400 text-sm">Sets</span>
                  <span className="font-mono font-semibold">
                    {stats.sets.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <span className="text-slate-400 text-sm">Deletes</span>
                  <span className="font-mono font-semibold">
                    {stats.deletes.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <span className="text-slate-400 text-sm">Errors</span>
                  <Badge
                    variant={stats.errors > 0 ? "destructive" : "secondary"}
                  >
                    {stats.errors}
                  </Badge>
                </div>
              </div>

              {/* Info Box */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h3 className="mb-2 font-semibold text-sm">
                  Cache Performance Guide
                </h3>
                <ul className="space-y-1 text-slate-400 text-sm">
                  <li>
                    • <strong>{">"} 80%:</strong> Excellent - Most requests
                    served from cache
                  </li>
                  <li>
                    • <strong>50-80%:</strong> Good - Consider optimizing cache
                    keys
                  </li>
                  <li>
                    • <strong>{"<"} 50%:</strong> Poor - Review cache strategy
                    or TTL settings
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flush Confirmation Dialog */}
      <Dialog onOpenChange={setShowFlushDialog} open={showFlushDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flush Cache</DialogTitle>
            <DialogDescription>
              Are you sure you want to flush the entire cache? This action
              cannot be undone and will temporarily reduce performance until the
              cache is rebuilt.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
            <p className="text-sm text-yellow-400">
              ⚠️ Warning: This will clear all cached data across all services.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFlushDialog(false)} variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={flushMutation.isPending}
              onClick={handleFlush}
              variant="destructive"
            >
              {flushMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Flush Cache
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
