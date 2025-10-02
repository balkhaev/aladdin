/**
 * Top Movers Card Component
 * Топ растущих и падающих монет за 24 часа
 */

import { ArrowDown, ArrowUp } from "lucide-react";
import { useMarketOverview } from "../hooks/use-analytics";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function TopMoversCard() {
  const { data: marketData, isLoading } = useMarketOverview();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Топ движения</CardTitle>
          <CardDescription>Лучшие и худшие за 24 часа</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!marketData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Топ движения</CardTitle>
          <CardDescription>Лучшие и худшие за 24 часа</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Нет данных</p>
        </CardContent>
      </Card>
    );
  }

  const { topGainers, topLosers } = marketData;

  const THOUSAND = 1000;
  const MIN_FRACTION_DIGITS = 2;
  const MAX_FRACTION_DIGITS = 2;
  const SMALL_VALUE_DECIMALS = 6;

  const formatPrice = (value: number) => {
    if (value >= THOUSAND) {
      return `$${value.toLocaleString("en-US", { minimumFractionDigits: MIN_FRACTION_DIGITS, maximumFractionDigits: MAX_FRACTION_DIGITS })}`;
    }
    if (value >= 1) {
      return `$${value.toFixed(MIN_FRACTION_DIGITS)}`;
    }
    return `$${value.toFixed(SMALL_VALUE_DECIMALS)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Топ движения</CardTitle>
        <CardDescription>Лучшие и худшие за 24 часа</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="gainers">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gainers">Растут</TabsTrigger>
            <TabsTrigger value="losers">Падают</TabsTrigger>
          </TabsList>

          {/* Top Gainers */}
          <TabsContent className="space-y-2" value="gainers">
            {topGainers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            ) : (
              topGainers.map((coin) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={coin.symbol}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{coin.symbol}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatPrice(coin.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-green-600">
                        <ArrowUp className="h-4 w-4" />
                        <span className="font-semibold text-sm">
                          {coin.changePercent24h.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {coin.change24h > 0 ? "+" : ""}
                        {formatPrice(coin.change24h)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Top Losers */}
          <TabsContent className="space-y-2" value="losers">
            {topLosers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет данных</p>
            ) : (
              topLosers.map((coin) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={coin.symbol}
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{coin.symbol}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatPrice(coin.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-red-600">
                        <ArrowDown className="h-4 w-4" />
                        <span className="font-semibold text-sm">
                          {Math.abs(coin.changePercent24h).toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {formatPrice(coin.change24h)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
