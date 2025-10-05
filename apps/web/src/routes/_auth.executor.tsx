/**
 * Strategy Executor Page
 * Automated trading execution and monitoring
 */

import { createFileRoute } from "@tanstack/react-router";
import { Info, Zap } from "lucide-react";
import { ExecutorControlPanel } from "../components/executor/executor-control-panel";
import { ExecutorStatsCard } from "../components/executor/executor-stats-card";
import { PendingSignalsTable } from "../components/executor/pending-signals-table";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";

export const Route = createFileRoute("/_auth/executor")({
  component: ExecutorPage,
});

function ExecutorPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-bold text-3xl">
            <Zap className="h-8 w-8 text-yellow-500" />
            Strategy Executor
          </h1>
          <p className="text-muted-foreground">
            Automated trading execution and signal monitoring
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About Strategy Executor</AlertTitle>
        <AlertDescription>
          The Strategy Executor automatically monitors trading signals from the
          screener and executes orders based on your configuration. You can run
          in PAPER mode for testing or LIVE mode for real trading. Supports
          algorithmic execution strategies like VWAP, TWAP, and Iceberg.
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Left Column - Stats (2/3 width) */}
        <div className="space-y-4 md:col-span-2">
          <ExecutorStatsCard />
          <PendingSignalsTable />
        </div>

        {/* Right Column - Control Panel (1/3 width) */}
        <div className="space-y-4">
          <ExecutorControlPanel />
        </div>
      </div>
    </div>
  );
}
