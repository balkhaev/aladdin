/**
 * Category Performance Component
 * Производительность категорий криптовалют
 */

import { Layers, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategoryStats } from "@/hooks/use-macro-data";
import { formatMarketCap, getPriceChangeColor } from "@/lib/api/macro";

const CATEGORY_ICONS: Record<string, string> = {
  DeFi: "🏦",
  "Layer 1": "🔷",
  "Layer 2": "⚡",
  Gaming: "🎮",
  Meme: "🐕",
  Infrastructure: "🏗️",
  Exchange: "🔄",
};

export function CategoryPerformance() {
  const { data, isLoading, error } = useCategoryStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Category Performance
          </CardTitle>
          <CardDescription>Market performance by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                className="flex items-center justify-between rounded-lg border p-3"
                key={i}
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div>
                    <Skeleton className="mb-1 h-4 w-[100px]" />
                    <Skeleton className="h-3 w-[80px]" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="mb-1 h-4 w-[80px]" />
                  <Skeleton className="ml-auto h-3 w-[60px]" />
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
            <Layers className="h-5 w-5" />
            Category Performance
          </CardTitle>
          <CardDescription>Market performance by category</CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          Failed to load category data
        </CardContent>
      </Card>
    );
  }

  // Filter out empty categories and sort by total market cap
  const sortedData = [...data]
    .filter((cat) => cat.category && cat.category.trim() !== "")
    .sort((a, b) => b.totalMarketCap - a.totalMarketCap);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Category Performance
        </CardTitle>
        <CardDescription>Market performance by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedData.map((category) => {
            const change24hColor = getPriceChangeColor(
              category.avgPriceChange24h
            );
            const change7dColor = getPriceChangeColor(
              category.avgPriceChange7d
            );
            const icon = CATEGORY_ICONS[category.category] || "📊";
            const ChangeIcon24h =
              category.avgPriceChange24h >= 0 ? TrendingUp : TrendingDown;
            const ChangeIcon7d =
              category.avgPriceChange7d >= 0 ? TrendingUp : TrendingDown;

            return (
              <div
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                key={category.category}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{icon}</div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {category.category}
                      <Badge className="text-xs" variant="secondary">
                        {category.coinsCount} coins
                      </Badge>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatMarketCap(category.totalMarketCap)}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-right">
                  <div
                    className={`text-sm ${change24hColor} flex items-center justify-end gap-1`}
                  >
                    <ChangeIcon24h className="h-3 w-3" />
                    {category.avgPriceChange24h >= 0 ? "+" : ""}
                    {category.avgPriceChange24h.toFixed(2)}% (24h)
                  </div>
                  <div
                    className={`text-xs ${change7dColor} flex items-center justify-end gap-1`}
                  >
                    <ChangeIcon7d className="h-3 w-3" />
                    {category.avgPriceChange7d >= 0 ? "+" : ""}
                    {category.avgPriceChange7d.toFixed(2)}% (7d)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Total Volume (24h)</div>
              <div className="font-medium">
                {formatMarketCap(
                  data.reduce((sum, cat) => sum + cat.totalVolume24h, 0)
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">Avg Performance (24h)</div>
              <div
                className={`font-medium ${getPriceChangeColor(
                  data.reduce((sum, cat) => sum + cat.avgPriceChange24h, 0) /
                    data.length
                )}`}
              >
                {(
                  data.reduce((sum, cat) => sum + cat.avgPriceChange24h, 0) /
                  data.length
                ).toFixed(2)}
                %
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
