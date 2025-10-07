/**
 * Market Heatmap Component
 * Визуализация всего рынка с цветовой индикацией
 */

import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useTopCoins } from "@/hooks/use-macro-data";
import { formatMarketCap } from "@/lib/api/macro";

const MIN_TILE_SIZE = 60;
const MAX_TILE_SIZE = 200;
const PADDING = 2;
const PRICE_CHANGE_THRESHOLD_LARGE = 10;
const PRICE_CHANGE_THRESHOLD_MEDIUM = 5;
const PRICE_CHANGE_THRESHOLD_SMALL = 2;
const TILE_SIZE_MEDIUM = 80;
const TILE_SIZE_LARGE = 120;

type FilterOption = "all" | "DeFi" | "Layer 1" | "Layer 2" | "Gaming" | "Meme";

/**
 * Получить цвет плитки по изменению цены
 */
function getTileColor(priceChange: number): string {
  const absChange = Math.abs(priceChange);

  if (priceChange > 0) {
    // Зеленые оттенки для роста
    if (absChange > PRICE_CHANGE_THRESHOLD_LARGE) return "bg-green-600";
    if (absChange > PRICE_CHANGE_THRESHOLD_MEDIUM) return "bg-green-500";
    if (absChange > PRICE_CHANGE_THRESHOLD_SMALL) return "bg-green-400";
    return "bg-green-300";
  }

  // Красные оттенки для падения
  if (absChange > PRICE_CHANGE_THRESHOLD_LARGE) return "bg-red-600";
  if (absChange > PRICE_CHANGE_THRESHOLD_MEDIUM) return "bg-red-500";
  if (absChange > PRICE_CHANGE_THRESHOLD_SMALL) return "bg-red-400";
  return "bg-red-300";
}

/**
 * Вычислить размер плитки на основе market cap
 */
function calculateTileSize(marketCap: number, maxMarketCap: number): number {
  const ratio = marketCap / maxMarketCap;
  const size =
    MIN_TILE_SIZE + (MAX_TILE_SIZE - MIN_TILE_SIZE) * Math.sqrt(ratio);
  return Math.floor(size);
}

export function MarketHeatmap() {
  const [filter, setFilter] = useState<FilterOption>("all");
  const { data, isLoading, error } = useTopCoins({
    category: filter === "all" ? undefined : filter,
    limit: 100,
  });

  const tiles = useMemo(() => {
    if (!data || data.length === 0) return [];

    const maxMarketCap = Math.max(...data.map((coin) => coin.marketCap));

    return data.map((coin) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      priceChange: coin.priceChange24h,
      marketCap: coin.marketCap,
      size: calculateTileSize(coin.marketCap, maxMarketCap),
      color: getTileColor(coin.priceChange24h),
    }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Heatmap
          </CardTitle>
          <CardDescription>
            Visual representation of the entire crypto market
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || (!isLoading && (!data || data.length === 0))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Heatmap
          </CardTitle>
          <CardDescription>
            Visual representation of the entire crypto market
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error
            ? "Failed to load market data"
            : "No market data available. Data collection in progress..."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Market Heatmap
            </CardTitle>
            <CardDescription>
              Visual representation of the entire crypto market
            </CardDescription>
          </div>
          <Select
            onValueChange={(v) => setFilter(v as FilterOption)}
            value={filter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="DeFi">DeFi</SelectItem>
              <SelectItem value="Layer 1">Layer 1</SelectItem>
              <SelectItem value="Layer 2">Layer 2</SelectItem>
              <SelectItem value="Gaming">Gaming</SelectItem>
              <SelectItem value="Meme">Meme</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500" />
            <span>-5%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-300" />
            <span>0%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-300" />
            <span>+2%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500" />
            <span>+5%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-600" />
            <span>+10%</span>
          </div>
        </div>

        {/* Heatmap */}
        <div className="flex min-h-[400px] flex-wrap content-start gap-1 rounded-lg border bg-muted/30 p-2">
          {tiles.map((tile) => (
            <div
              className={`${tile.color} group relative flex cursor-pointer flex-col items-center justify-center rounded transition-all hover:scale-105 hover:shadow-lg`}
              key={tile.symbol}
              style={{
                width: `${tile.size}px`,
                height: `${tile.size}px`,
                padding: `${PADDING}px`,
              }}
              title={`${tile.name} (${tile.symbol}): ${tile.priceChange >= 0 ? "+" : ""}${tile.priceChange.toFixed(2)}%`}
            >
              <div className="text-center text-white">
                <div className="font-bold text-xs">{tile.symbol}</div>
                {tile.size > TILE_SIZE_MEDIUM && (
                  <>
                    <div className="mt-1 text-[10px] opacity-90">
                      {tile.priceChange >= 0 ? "+" : ""}
                      {tile.priceChange.toFixed(1)}%
                    </div>
                    {tile.size > TILE_SIZE_LARGE && (
                      <div className="mt-1 text-[9px] opacity-75">
                        {formatMarketCap(tile.marketCap)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Tooltip */}
              <div className="-translate-x-1/2 absolute bottom-full left-1/2 z-10 mb-2 hidden whitespace-nowrap rounded bg-popover px-3 py-2 text-popover-foreground text-sm shadow-lg group-hover:block">
                <div className="font-semibold">{tile.name}</div>
                <div className="text-xs">
                  {tile.priceChange >= 0 ? "+" : ""}
                  {tile.priceChange.toFixed(2)}% (24h)
                </div>
                <div className="text-xs opacity-75">
                  {formatMarketCap(tile.marketCap)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-muted-foreground text-xs">
          Showing {tiles.length} coins • Size represents market cap • Color
          represents 24h change
        </div>
      </CardContent>
    </Card>
  );
}
