/**
 * Screener Page
 * Find trading opportunities based on technical analysis
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { ScreenerFilters } from "@/components/screener-filters";
import { ScreenerResultsTable } from "@/components/screener-results-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getScreenerResults, type ScreenerResult } from "@/lib/api/screener";

export const Route = createFileRoute("/_auth/screener")({
  component: ScreenerPage,
});

function ScreenerPage() {
  const navigate = useNavigate();
  const [filteredResults, setFilteredResults] = useState<ScreenerResult[]>([]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["screener", "results"],
    queryFn: () => getScreenerResults(100),
    refetchInterval: 30_000, // Refetch every 30 seconds
  });

  const handleSymbolClick = (symbol: string) => {
    navigate({ to: "/trading", search: { symbol } });
  };

  return (
    <div className="flex-1 space-y-3 p-3">
      {/* Info Cards */}
      {!isLoading && results && (
        <div className="grid gap-2 md:grid-cols-4">
          <Card>
            <CardHeader className="pt-2 pb-1">
              <CardTitle className="trading-heading text-muted-foreground">
                ВСЕГО СИГНАЛОВ
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="font-bold text-xl">{results.length}</div>
              <p className="text-[10px] text-muted-foreground">
                Актуальные возможности
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pt-2 pb-1">
              <CardTitle className="trading-heading text-muted-foreground">
                СИЛЬНЫЕ ПОКУПКИ
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="font-bold text-green-500 text-xl">
                {
                  results.filter(
                    (r) => r.signals.recommendation === "STRONG_BUY"
                  ).length
                }
              </div>
              <p className="text-[10px] text-muted-foreground">STRONG_BUY</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pt-2 pb-1">
              <CardTitle className="trading-heading text-muted-foreground">
                ПОКУПКИ
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="font-bold text-green-400 text-xl">
                {
                  results.filter((r) => r.signals.recommendation === "BUY")
                    .length
                }
              </div>
              <p className="text-[10px] text-muted-foreground">BUY</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pt-2 pb-1">
              <CardTitle className="trading-heading text-muted-foreground">
                БЫЧИЙ ТРЕНД
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="font-bold text-xl">
                {results.filter((r) => r.signals.trend === "BULLISH").length}
              </div>
              <p className="text-[10px] text-muted-foreground">BULLISH</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Results */}
      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      )}

      {!isLoading && results && (
        <>
          <ScreenerFilters
            onFilteredResults={setFilteredResults}
            results={results}
          />
          <Card>
            <CardHeader className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="trading-heading text-muted-foreground">
                  РЕЗУЛЬТАТЫ
                </CardTitle>
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <TrendingUp className="size-3" />
                  <span>
                    {filteredResults.length > 0
                      ? filteredResults.length
                      : results.length}{" "}
                    возможностей
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScreenerResultsTable
                onSymbolClick={handleSymbolClick}
                results={filteredResults.length > 0 ? filteredResults : results}
              />
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && results === undefined && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Не удалось загрузить результаты скринера
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
