/**
 * Funding Rates Card Component
 * Displays current funding rates across exchanges with sentiment analysis
 */

import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from "lucide-react";
import { useAllFundingRates } from "../../hooks/use-funding-rates";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

type FundingRatesCardProps = {
  symbol: string;
};

const PERCENTAGE_MULTIPLIER = 100;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const SKELETON_COUNT = 3;
const EXTREME_THRESHOLD = 0.01;
const PRECISION_FOUR = 4;
const PRECISION_THREE = 3;
const PRECISION_TWO = 2;

export function FundingRatesCard({ symbol }: FundingRatesCardProps) {
  const { data, isLoading, error } = useAllFundingRates(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-medium text-sm">Funding Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton className="h-16 w-full" key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-medium text-sm">Funding Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Failed to load funding rates
          </p>
        </CardContent>
      </Card>
    );
  }

  const exchanges = Object.entries(data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-medium text-sm">Funding Rates</CardTitle>
        <p className="text-muted-foreground text-xs">
          Лонги платят шортам когда ставка положительная
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {exchanges.map(([exchange, fundingData]) => {
            const rate = fundingData.fundingRate * PERCENTAGE_MULTIPLIER;
            const dailyRate =
              (rate * HOURS_PER_DAY) / fundingData.fundingIntervalHours;
            const monthlyRate = dailyRate * DAYS_PER_MONTH;
            const isPositive = rate > 0;
            const isExtreme = Math.abs(rate) > EXTREME_THRESHOLD;

            return (
              <div
                className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                key={exchange}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm capitalize">
                      {exchange}
                    </span>
                    <Badge
                      className="text-xs"
                      variant={
                        fundingData.sentiment === "BULLISH"
                          ? "default"
                          : fundingData.sentiment === "BEARISH"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {fundingData.sentiment}
                    </Badge>
                  </div>
                  <div
                    className={`flex items-center gap-1 font-semibold text-sm ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {rate.toFixed(PRECISION_FOUR)}%
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded bg-muted/50 p-2">
                    <div className="text-muted-foreground">24h</div>
                    <div
                      className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
                    >
                      {dailyRate.toFixed(PRECISION_THREE)}%
                    </div>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <div className="text-muted-foreground">30d</div>
                    <div
                      className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
                    >
                      {monthlyRate.toFixed(PRECISION_TWO)}%
                    </div>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <div className="text-muted-foreground">7d Avg</div>
                    <div className="font-medium">
                      {(
                        fundingData.avgFunding7d * PERCENTAGE_MULTIPLIER
                      ).toFixed(PRECISION_FOUR)}
                      %
                    </div>
                  </div>
                </div>

                {isExtreme && (
                  <div className="mt-2 flex items-start gap-2 rounded-md bg-orange-500/10 p-2 text-orange-600 text-xs dark:text-orange-400">
                    {isPositive ? (
                      <ArrowUp className="mt-0.5 h-3 w-3 shrink-0" />
                    ) : (
                      <ArrowDown className="mt-0.5 h-3 w-3 shrink-0" />
                    )}
                    <span>{fundingData.signal}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-3 text-muted-foreground text-xs">
          <p className="font-medium">Что это значит?</p>
          <ul className="mt-2 space-y-1">
            <li>• Положительная ставка: лонги переполнены</li>
            <li>• Отрицательная ставка: шорты переполнены</li>
            <li>• &gt;0.1%: экстремальное значение, возможен разворот</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
