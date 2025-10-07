/**
 * Global Ticker Bar
 * Displays key market indices with real-time WebSocket updates
 */

import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { memo, useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMultiSymbolWS } from "@/hooks/use-multi-symbol-ws";
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

// Константа вынесена за пределы компонента, чтобы избежать пересоздания при каждом рендере
const GLOBAL_TICKER_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
];

export function GlobalTickerBar() {
  // Key market symbols
  const symbols = GLOBAL_TICKER_SYMBOLS;

  // WebSocket real-time updates
  const { tickers: wsTickers, isConnected } = useMultiSymbolWS(symbols);

  // Fallback REST API data (initial load only)
  const { data: restTickers } = useQuery({
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
      return results.filter(
        (result): result is NonNullable<typeof result> => result !== null
      );
    },
    // Only fetch once on mount, WebSocket handles updates
    staleTime: Number.POSITIVE_INFINITY,
    enabled: !isConnected,
  });

  // Use WebSocket data if available, otherwise fallback to REST
  const displayTickers = useMemo(() => {
    if (wsTickers.length > 0) {
      return wsTickers.map((ticker) => ({
        symbol: ticker.symbol,
        lastPrice: ticker.price,
        priceChange: ticker.priceChange,
        priceChangePercent: ticker.priceChangePercent,
      }));
    }
    return (
      restTickers?.map((ticker) => ({
        symbol: ticker.symbol,
        lastPrice: ticker.price,
        priceChange: 0,
        priceChangePercent: 0,
      })) || []
    );
  }, [wsTickers, restTickers]);

  if (displayTickers.length === 0) {
    return null;
  }

  return (
    <div className="border-border/50 border-b bg-card/20 backdrop-blur-sm">
      <ScrollArea className="w-full">
        <div className="flex h-9 items-center">
          {displayTickers.map((ticker) => {
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
