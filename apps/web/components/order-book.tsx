import { memo, useMemo } from "react";
import { formatPrice, formatVolume } from "@/lib/format";
import { useOrderBook } from "../hooks/use-order-book";
import { useOrderBookWS } from "../hooks/use-order-book-ws";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

type OrderBookProps = {
  symbol: string;
  levels?: number;
};

const PERCENTAGE_MULTIPLIER = 100;
const SPREAD_DECIMAL_PLACES = 3;
const DEFAULT_LEVELS = 15;

export const OrderBook = memo(function OrderBookComponent({
  symbol,
  levels = DEFAULT_LEVELS,
}: OrderBookProps) {
  // Fallback to REST API with polling
  const { data: restOrderBook, isLoading } = useOrderBook(symbol, levels);

  // WebSocket for real-time updates
  const { orderBook: wsOrderBook } = useOrderBookWS(symbol, levels);

  // Use WebSocket data if available, otherwise fallback to REST
  const orderBook = wsOrderBook || restOrderBook;

  // Memoize totals calculation
  const { maxBidTotal, maxAskTotal, bidTotals, askTotals } = useMemo(() => {
    if (!orderBook) {
      return {
        maxBidTotal: 0,
        maxAskTotal: 0,
        bidTotals: [],
        askTotals: [],
      };
    }

    // Calculate cumulative totals for bids
    const bids = orderBook.bids.map((_: unknown, idx: number) =>
      orderBook.bids
        .slice(0, idx + 1)
        .reduce((sum: number, [, q]: [number, number]) => sum + q, 0)
    );

    // Calculate cumulative totals for asks
    const asks = orderBook.asks.map((_: unknown, idx: number) =>
      orderBook.asks
        .slice(0, idx + 1)
        .reduce((sum: number, [, q]: [number, number]) => sum + q, 0)
    );

    return {
      maxBidTotal: Math.max(...bids, 0),
      maxAskTotal: Math.max(...asks, 0),
      bidTotals: bids,
      askTotals: asks,
    };
  }, [orderBook]);

  // Memoize spread calculation
  const spread = useMemo(() => {
    if (!orderBook?.bids[0]) {
      return null;
    }
    if (!orderBook?.asks[0]) {
      return null;
    }

    const spreadValue = orderBook.asks[0][0] - orderBook.bids[0][0];
    const spreadPercent =
      (spreadValue / orderBook.bids[0][0]) * PERCENTAGE_MULTIPLIER;

    return {
      value: spreadValue,
      percent: spreadPercent,
    };
  }, [orderBook]);

  if (isLoading || !orderBook) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="font-medium text-sm">Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col py-0">
      <CardContent className="flex-1 overflow-hidden p-0">
        {/* Header */}
        <div className="grid grid-cols-3 gap-2 border-b px-3 py-1 font-medium text-[10px] text-muted-foreground">
          <div className="text-left">Price</div>
          <div className="text-right">Amount</div>
          <div className="text-right">Total</div>
        </div>

        {/* Asks (Sell Orders) - Red */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(50% - 32px)" }}
        >
          {orderBook.asks
            .slice(0, levels)
            .reverse()
            .map(([price, qty]: [number, number], idx: number) => {
              const reversedIdx = levels - 1 - idx;
              const total = askTotals[reversedIdx] || 0;
              const percentage = (total / maxAskTotal) * PERCENTAGE_MULTIPLIER;

              return (
                <div
                  className="relative grid cursor-pointer grid-cols-3 gap-2 px-3 py-0.5 font-mono text-[11px] hover:bg-red-500/10"
                  key={`ask-${price}`}
                >
                  {/* Background bar */}
                  <div
                    className="absolute top-0 right-0 h-full bg-red-500/10"
                    style={{ width: `${percentage}%` }}
                  />

                  {/* Content */}
                  <div className="relative text-left text-red-500">
                    {formatPrice(price, 8)}
                  </div>
                  <div className="relative text-right">
                    {formatVolume(qty, 8)}
                  </div>
                  <div className="relative text-right text-[10px] text-muted-foreground">
                    {formatVolume(total, 8)}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Spread */}
        {spread && (
          <div className="border-y bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Spread</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-foreground">
                  {formatPrice(spread.value, 8)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({spread.percent.toFixed(SPREAD_DECIMAL_PLACES)}%)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Bids (Buy Orders) - Green */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(50% - 32px)" }}
        >
          {orderBook.bids
            .slice(0, levels)
            .map(([price, qty]: [number, number], idx: number) => {
            const total = bidTotals[idx] || 0;
            const percentage = (total / maxBidTotal) * PERCENTAGE_MULTIPLIER;

            return (
              <div
                className="relative grid cursor-pointer grid-cols-3 gap-2 px-3 py-0.5 font-mono text-[11px] hover:bg-green-500/10"
                key={`bid-${price}`}
              >
                {/* Background bar */}
                <div
                  className="absolute top-0 right-0 h-full bg-green-500/10"
                  style={{ width: `${percentage}%` }}
                />

                {/* Content */}
                <div className="relative text-left text-green-500">
                  {formatPrice(price, 8)}
                </div>
                <div className="relative text-right">
                  {formatVolume(qty, 8)}
                </div>
                <div className="relative text-right text-[10px] text-muted-foreground">
                  {formatVolume(total, 8)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
