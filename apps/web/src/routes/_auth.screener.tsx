import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScreenerFilters } from "@/components/screener-filters";
import { ScreenerResultsTable } from "@/components/screener-results-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getQueueStats,
  getScreenerResults,
  getTopSignals,
  runScreening,
  type ScreenerResult,
} from "@/lib/api/screener";

const RESULTS_LIMIT = 500;
const TOP_SIGNALS_LIMIT = 20;
const RESULTS_REFETCH_INTERVAL = 30_000; // 30 seconds
const STATS_REFETCH_INTERVAL = 5000; // 5 seconds
const RESULTS_DELAY = 10_000; // 10 seconds
const PERCENTAGE_MULTIPLIER = 100;

export const Route = createFileRoute("/_auth/screener")({
  component: ScreenerPage,
});

function ScreenerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filteredResults, setFilteredResults] = useState<ScreenerResult[]>([]);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch screener results
  const {
    data: results = [],
    isLoading: isLoadingResults,
    refetch: refetchResults,
  } = useQuery({
    queryKey: ["screener-results"],
    queryFn: () => getScreenerResults(RESULTS_LIMIT),
    refetchInterval: RESULTS_REFETCH_INTERVAL,
  });

  // Fetch top signals
  const { data: strongBuySignals = [] } = useQuery({
    queryKey: ["screener-signals", "STRONG_BUY"],
    queryFn: () => getTopSignals("STRONG_BUY", TOP_SIGNALS_LIMIT),
    refetchInterval: RESULTS_REFETCH_INTERVAL,
  });

  const { data: strongSellSignals = [] } = useQuery({
    queryKey: ["screener-signals", "STRONG_SELL"],
    queryFn: () => getTopSignals("STRONG_SELL", TOP_SIGNALS_LIMIT),
    refetchInterval: RESULTS_REFETCH_INTERVAL,
  });

  // Fetch queue stats
  const { data: queueStats } = useQuery({
    queryKey: ["screener-queue-stats"],
    queryFn: getQueueStats,
    refetchInterval: STATS_REFETCH_INTERVAL,
  });

  // Run screening mutation
  const runScreeningMutation = useMutation({
    mutationFn: runScreening,
    onSuccess: (data) => {
      toast.success("Screening started", {
        description: `Processing ${data.jobCount} symbols...`,
      });
      // Refetch after a delay to allow processing
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["screener-results"] });
        queryClient.invalidateQueries({ queryKey: ["screener-signals"] });
      }, RESULTS_DELAY);
    },
    onError: (error) => {
      toast.error("Failed to start screening", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const handleRunScreening = () => {
    runScreeningMutation.mutate("15m");
  };

  const handleRefresh = () => {
    refetchResults();
    queryClient.invalidateQueries({ queryKey: ["screener-signals"] });
    queryClient.invalidateQueries({ queryKey: ["screener-queue-stats"] });
    toast.success("Refreshed");
  };

  const handleSymbolClick = (symbol: string) => {
    navigate({ to: "/trading", search: { symbol } });
  };

  const displayResults = filteredResults.length > 0 ? filteredResults : results;

  const stats = {
    total: results.length,
    bullish: results.filter((r) => r.signals.trend === "BULLISH").length,
    bearish: results.filter((r) => r.signals.trend === "BEARISH").length,
    strongBuy: results.filter((r) => r.signals.recommendation === "STRONG_BUY")
      .length,
    strongSell: results.filter(
      (r) => r.signals.recommendation === "STRONG_SELL"
    ).length,
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={isLoadingResults}
          onClick={handleRefresh}
          size="sm"
          variant="outline"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isLoadingResults ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <Button
          disabled={runScreeningMutation.isPending}
          onClick={handleRunScreening}
          size="sm"
        >
          {runScreeningMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-2 h-4 w-4" />
          )}
          Run Screening
        </Button>
      </div>

      {/* Queue Stats */}
      {queueStats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Waiting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{queueStats.waiting}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <Activity className="h-4 w-4 text-blue-500" />
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-blue-500">
                {queueStats.active}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-green-500">
                {queueStats.completed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-red-500">
                {queueStats.failed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <Clock className="h-4 w-4 text-orange-500" />
                Delayed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-orange-500">
                {queueStats.delayed}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Market Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Total Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Bullish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-green-500">
              {stats.bullish}
            </div>
            <p className="text-muted-foreground text-xs">
              {stats.total > 0
                ? `${((stats.bullish / stats.total) * PERCENTAGE_MULTIPLIER).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Bearish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-red-500">
              {stats.bearish}
            </div>
            <p className="text-muted-foreground text-xs">
              {stats.total > 0
                ? `${((stats.bearish / stats.total) * PERCENTAGE_MULTIPLIER).toFixed(1)}%`
                : "0%"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Strong Buy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-green-600">
              {stats.strongBuy}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Strong Sell</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-red-600">
              {stats.strongSell}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger value="all">All Results ({results.length})</TabsTrigger>
          <TabsTrigger className="text-green-600" value="strong-buy">
            Strong Buy ({strongBuySignals.length})
          </TabsTrigger>
          <TabsTrigger className="text-red-600" value="strong-sell">
            Strong Sell ({strongSellSignals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="all">
          {isLoadingResults ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <ScreenerFilters
                onFilteredResults={setFilteredResults}
                results={results}
              />
              <ScreenerResultsTable
                onSymbolClick={handleSymbolClick}
                results={displayResults}
              />
            </>
          )}
        </TabsContent>

        <TabsContent className="space-y-4" value="strong-buy">
          <ScreenerResultsTable
            onSymbolClick={handleSymbolClick}
            results={strongBuySignals}
          />
        </TabsContent>

        <TabsContent className="space-y-4" value="strong-sell">
          <ScreenerResultsTable
            onSymbolClick={handleSymbolClick}
            results={strongSellSignals}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
