import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, TrendingUp } from "lucide-react";
import { useState } from "react";
import { BacktestForm } from "../components/backtest-form";
import { BacktestResults } from "../components/backtest-results";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { useBacktest } from "../hooks/use-backtest";
import type { BacktestParams, BacktestResult } from "../lib/api/backtest";

export const Route = createFileRoute("/_auth/backtest")({
  component: BacktestPage,
});

function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const backtest = useBacktest();

  const handleSubmit = (params: BacktestParams) => {
    backtest.mutate(params, {
      onSuccess: (data) => {
        setResult(data);
      },
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Configuration Form */}
        <div className="lg:col-span-1">
          <BacktestForm
            isLoading={backtest.isPending}
            onSubmit={handleSubmit}
          />

          {/* Error Display */}
          {backtest.isError && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {backtest.error instanceof Error
                  ? backtest.error.message
                  : "Failed to run backtest"}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Results Display */}
        <div className="lg:col-span-2">
          {backtest.isPending && (
            <div className="flex h-64 items-center justify-center">
              <div className="space-y-2 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                <p className="text-muted-foreground text-sm">
                  Running backtest...
                </p>
              </div>
            </div>
          )}

          {result && !backtest.isPending && <BacktestResults result={result} />}

          {!(result || backtest.isPending) && (
            <div className="flex h-64 items-center justify-center rounded-lg border-2 border-border border-dashed">
              <div className="space-y-2 text-center">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  Configure and run a backtest to see results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
