/**
 * Bybit Opportunities Page
 * Real-time trading opportunities on Bybit USDT Perpetual Futures
 */

import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { OpportunitiesTable } from "@/components/bybit/opportunities-table";

export const Route = createFileRoute("/_auth/bybit-opportunities")({
  component: BybitOpportunitiesPage,
});

function BybitOpportunitiesPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <TrendingUp className="size-6 text-purple-500" />
          </div>
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              Bybit Opportunities
            </h1>
            <p className="text-muted-foreground">
              Real-time trading opportunities on USDT Perpetual Futures
            </p>
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <OpportunitiesTable />
    </div>
  );
}
