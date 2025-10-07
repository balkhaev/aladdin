/**
 * Compact Tickers for Header
 * Displays key market symbols in a compact format with real-time WebSocket updates
 */

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { memo, useMemo } from "react";
import { useMultiSymbolWS } from "@/hooks/use-multi-symbol-ws";
import { marketDataApi } from "@/lib/api/market-data";

type CompactTickerProps = {
  symbol: string;
  price: number;
};

const CompactTicker = memo(({ symbol, price }: CompactTickerProps) => {
  const displaySymbol = symbol.replace("USDT", "");

  return (
    <div className="flex items-center gap-1.5">
      <Activity className="h-3 w-3 text-blue-500" />
      <span className="font-medium text-xs">{displaySymbol}</span>
      <span className="font-mono text-xs">
        ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
});

CompactTicker.displayName = "CompactTicker";

// Константа вынесена за пределы компонента, чтобы избежать пересоздания при каждом рендере
const HEADER_SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];

export function HeaderTickers() {
  const symbols = HEADER_SYMBOLS;

  // WebSocket real-time updates
  const { tickers: wsTickers, isConnected } = useMultiSymbolWS(symbols);

  // Fallback REST API data (initial load only)
  const { data: restTickers } = useQuery({
    queryKey: ["header-tickers"],
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
        price: ticker.price,
      }));
    }
    return restTickers || [];
  }, [wsTickers, restTickers]);

  if (displayTickers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {displayTickers.map((ticker) => {
        if (!ticker?.symbol) {
          return null;
        }

        return (
          <CompactTicker
            key={ticker.symbol}
            price={ticker.price}
            symbol={ticker.symbol}
          />
        );
      })}
    </div>
  );
}
