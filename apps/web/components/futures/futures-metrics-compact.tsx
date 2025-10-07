/**
 * Compact Futures Metrics Component
 * Shows quick overview of funding rates and OI in trading header
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { useFundingRate } from "../../hooks/use-funding-rates";
import { useOpenInterest } from "../../hooks/use-open-interest";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

type FuturesMetricsCompactProps = {
  symbol: string;
  exchange?: string;
};

const PERCENTAGE_MULTIPLIER = 100;
const MILLION_DIVIDER = 1_000_000;
const PRECISION_THREE = 3;
const PRECISION_FOUR = 4;
const PRECISION_ONE = 1;
const PRECISION_TWO = 2;

export function FuturesMetricsCompact({
  symbol,
  exchange = "binance",
}: FuturesMetricsCompactProps) {
  const {
    data: fundingData,
    isLoading: fundingLoading,
    error: fundingError,
  } = useFundingRate(symbol, exchange);
  const {
    data: oiData,
    isLoading: oiLoading,
    error: oiError,
  } = useOpenInterest(symbol, exchange);

  if (fundingLoading || oiLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
    );
  }

  if (fundingError && oiError) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {/* Funding Rate */}
      {fundingData && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
                <span className="text-muted-foreground">FR:</span>
                <span
                  className={`font-semibold ${
                    fundingData.fundingRate > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {(fundingData.fundingRate * PERCENTAGE_MULTIPLIER).toFixed(
                    PRECISION_THREE
                  )}
                  %
                </span>
                <Badge
                  className="h-4 px-1 text-[10px]"
                  variant={
                    fundingData.sentiment === "BULLISH"
                      ? "default"
                      : fundingData.sentiment === "BEARISH"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {fundingData.sentiment[0]}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">Funding Rate</div>
                <div className="mt-1 text-muted-foreground">
                  {fundingData.signal}
                </div>
                <div className="mt-1">
                  7d avg:{" "}
                  {(fundingData.avgFunding7d * PERCENTAGE_MULTIPLIER).toFixed(
                    PRECISION_FOUR
                  )}
                  %
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Open Interest */}
      {oiData && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
                <span className="text-muted-foreground">OI:</span>
                <span className="font-semibold">
                  $
                  {(oiData.openInterest / MILLION_DIVIDER).toFixed(
                    PRECISION_ONE
                  )}
                  M
                </span>
                <div
                  className={`flex items-center ${
                    oiData.openInterestChangePct > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {oiData.openInterestChangePct > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span className="ml-0.5 font-semibold">
                    {Math.abs(oiData.openInterestChangePct).toFixed(
                      PRECISION_ONE
                    )}
                    %
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">Open Interest</div>
                <div className="mt-1 text-muted-foreground">
                  {oiData.explanation}
                </div>
                <div className="mt-1">
                  Price 24h:{" "}
                  <span
                    className={
                      oiData.priceChange24h > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {oiData.priceChange24h > 0 ? "+" : ""}
                    {oiData.priceChange24h.toFixed(PRECISION_TWO)}%
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
