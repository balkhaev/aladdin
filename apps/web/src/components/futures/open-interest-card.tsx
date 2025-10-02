/**
 * Open Interest Card Component
 * Displays open interest across exchanges with OI+Price correlation analysis
 */

import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from "lucide-react";
import { useAllOpenInterest } from "../../hooks/use-open-interest";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

type OpenInterestCardProps = {
  symbol: string;
};

const MILLION_DIVIDER = 1_000_000;
const SKELETON_COUNT = 3;
const HIGH_VOL_OI_THRESHOLD = 3;
const PRECISION_ONE = 1;
const PRECISION_TWO = 2;

export function OpenInterestCard({ symbol }: OpenInterestCardProps) {
  const { data, isLoading, error } = useAllOpenInterest(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-medium text-sm">Open Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton className="h-20 w-full" key={i} />
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
          <CardTitle className="font-medium text-sm">Open Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Failed to load open interest
          </p>
        </CardContent>
      </Card>
    );
  }

  const exchanges = Object.entries(data);
  const totalOI = exchanges.reduce(
    (sum, [, oiData]) => sum + oiData.openInterest,
    0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-medium text-sm">Open Interest</CardTitle>
        <p className="text-muted-foreground text-xs">
          Общий OI: ${(totalOI / MILLION_DIVIDER).toFixed(PRECISION_ONE)}M
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {exchanges.map(([exchange, oiData]) => {
            const oiInMillions = oiData.openInterest / MILLION_DIVIDER;
            const oiChangeIsPositive = oiData.openInterestChangePct > 0;
            const priceChangeIsPositive = oiData.priceChange24h > 0;
            const volumeOIRatio = oiData.volume24h / oiData.openInterest;

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
                        oiData.signal === "BULLISH"
                          ? "default"
                          : oiData.signal === "BEARISH"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {oiData.signal}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-sm">
                      ${oiInMillions.toFixed(PRECISION_ONE)}M
                    </div>
                    <div
                      className={`flex items-center gap-0.5 text-xs ${
                        oiChangeIsPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {oiChangeIsPositive ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.abs(oiData.openInterestChangePct).toFixed(
                        PRECISION_ONE
                      )}
                      %
                    </div>
                  </div>
                </div>

                <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-muted/50 p-2">
                    <div className="text-muted-foreground">Price 24h</div>
                    <div
                      className={`flex items-center gap-1 font-medium ${
                        priceChangeIsPositive
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {priceChangeIsPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(oiData.priceChange24h).toFixed(PRECISION_TWO)}%
                    </div>
                  </div>
                  <div className="rounded bg-muted/50 p-2">
                    <div className="text-muted-foreground">Vol/OI Ratio</div>
                    <div
                      className={`font-medium ${volumeOIRatio > HIGH_VOL_OI_THRESHOLD ? "text-orange-600" : ""}`}
                    >
                      {volumeOIRatio.toFixed(PRECISION_TWO)}x
                      {volumeOIRatio > HIGH_VOL_OI_THRESHOLD && " ⚠️"}
                    </div>
                  </div>
                </div>

                <div className="rounded-md bg-muted/30 p-2 text-muted-foreground text-xs">
                  {oiData.explanation}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-3 text-muted-foreground text-xs">
          <p className="font-medium">Интерпретация OI + Price:</p>
          <ul className="mt-2 space-y-1">
            <li>• OI↑ + Price↑ = 🟢 Лонги входят</li>
            <li>• OI↑ + Price↓ = 🔴 Шорты доминируют</li>
            <li>• OI↓ + Price↑ = 🟡 Шорты закрываются (squeeze)</li>
            <li>• OI↓ + Price↓ = 🟡 Лонги ликвидируются</li>
            <li>• Vol/OI &gt; 3 = Высокая волатильность</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
