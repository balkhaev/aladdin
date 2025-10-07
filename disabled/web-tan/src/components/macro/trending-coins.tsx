/**
 * Trending Coins Component
 * Список трендовых монет
 */

import { Flame, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrendingCoins } from "@/hooks/use-macro-data";
import { getPriceChangeColor } from "@/lib/api/macro";

export function TrendingCoins() {
  const { data, isLoading, error } = useTrendingCoins();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Trending Coins
          </CardTitle>
          <CardDescription>Top trending cryptocurrencies</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="flex items-center justify-between" key={i}>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="mb-1 h-4 w-[80px]" />
                    <Skeleton className="h-3 w-[50px]" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="mb-1 h-4 w-[70px]" />
                  <Skeleton className="ml-auto h-3 w-[50px]" />
                </div>
              </div>
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
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Trending Coins
          </CardTitle>
          <CardDescription>Top trending cryptocurrencies</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load trending coins
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Trending Coins
        </CardTitle>
        <CardDescription>Top trending cryptocurrencies</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.slice(0, 10).map((coin) => {
            const changeColor = getPriceChangeColor(coin.priceChange24h);

            return (
              <div
                className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
                key={coin.id}
              >
                <div className="flex items-center gap-3">
                  <Badge className="w-8 justify-center" variant="outline">
                    #{coin.rank}
                  </Badge>
                  <div>
                    <div className="font-medium">
                      {coin.name}
                      <span className="ml-2 text-muted-foreground text-sm">
                        {coin.symbol.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Rank #{coin.marketCapRank}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    $
                    {coin.priceUsd.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </div>
                  <div
                    className={`text-sm ${changeColor} flex items-center justify-end gap-1`}
                  >
                    {coin.priceChange24h >= 0 && (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    {coin.priceChange24h >= 0 ? "+" : ""}
                    {coin.priceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t pt-4 text-center text-muted-foreground text-sm">
          Updates every 30 minutes
        </div>
      </CardContent>
    </Card>
  );
}
