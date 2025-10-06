/**
 * Global Ticker Bar
 * Displays key market indices with real-time updates
 */

import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { memo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { marketDataApi } from "@/lib/api/market-data";
import { cn } from "@/lib/utils";

type TickerItemProps = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
};

const TickerItem = memo(
  ({ symbol, price, change, changePercent }: TickerItemProps) => {
    // Guard against undefined values
    const safePrice = price ?? 0;
    const safeChange = change ?? 0;
    const safeChangePercent = changePercent ?? 0;

    const isPositive = safeChange >= 0;
    const displaySymbol = symbol.replace("USDT", "");

    return (
      <div className="flex items-center gap-3 border-border/30 border-r px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-3 w-3 text-green-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className="font-medium text-xs">{displaySymbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">
            ${safePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span
            className={cn(
              "font-mono text-xs",
              isPositive ? "text-green-500" : "text-red-500"
            )}
          >
            {isPositive ? "+" : ""}
            {safeChangePercent.toFixed(2)}%
          </span>
        </div>
      </div>
    );
  }
);

TickerItem.displayName = "TickerItem";

export function GlobalTickerBar() {
  // Fetch key market symbols
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"];

  const { data: tickers } = useQuery({
    queryKey: ["global-ticker-bar"],
    queryFn: async () => {
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            return await marketDataApi.getQuote(symbol);
          } catch (error) {
            console.warn(`Failed to fetch quote for ${symbol}:`, error);
            return null;
          }
        })
      );
      // Filter out failed requests
      return results.filter(
        (result): result is NonNullable<typeof result> => result !== null
      );
    },
    refetchInterval: 2000,
  });

  if (!tickers || tickers.length === 0) {
    return null;
  }

  return (
    <div className="border-border/50 border-b bg-card/20 backdrop-blur-sm">
      <ScrollArea className="w-full">
        <div className="flex h-9 items-center">
          {tickers.map((ticker) => {
            // Additional safety check
            if (!ticker?.symbol) {
              return null;
            }

            return (
              <TickerItem
                change={ticker.priceChange ?? 0}
                changePercent={ticker.priceChangePercent ?? 0}
                key={ticker.symbol}
                price={ticker.lastPrice ?? 0}
                symbol={ticker.symbol}
              />
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
