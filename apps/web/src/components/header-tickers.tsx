/**
 * Compact Tickers for Header
 * Displays key market symbols in a compact format for the header
 */

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { memo } from "react";
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

export function HeaderTickers() {
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];

  const { data: tickers } = useQuery({
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
    refetchInterval: 2000,
  });

  if (!tickers || tickers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {tickers.map((ticker) => {
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
