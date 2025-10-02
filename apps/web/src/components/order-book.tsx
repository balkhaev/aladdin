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

export function OrderBook({ symbol, levels = 15 }: OrderBookProps) {
  // Fallback to REST API with polling
  const { data: restOrderBook, isLoading } = useOrderBook(symbol, levels);

  // WebSocket for real-time updates
  const { orderBook: wsOrderBook } = useOrderBookWS(symbol, levels);

  // Use WebSocket data if available, otherwise fallback to REST
  const orderBook = wsOrderBook || restOrderBook;

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

  const formatPrice = (price: number) =>
    price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });

  const formatQty = (qty: number) =>
    qty.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });

  // Calculate totals for visualization
  const maxBidTotal = orderBook.bids.reduce((max, _entry, idx) => {
    const total = orderBook.bids
      .slice(0, idx + 1)
      .reduce((sum, [, q]) => sum + q, 0);
    return Math.max(max, total);
  }, 0);

  const maxAskTotal = orderBook.asks.reduce((max, _entry, idx) => {
    const total = orderBook.asks
      .slice(0, idx + 1)
      .reduce((sum, [, q]) => sum + q, 0);
    return Math.max(max, total);
  }, 0);

  const getBidTotal = (index: number) =>
    orderBook.bids.slice(0, index + 1).reduce((sum, [, qty]) => sum + qty, 0);

  const getAskTotal = (index: number) =>
    orderBook.asks.slice(0, index + 1).reduce((sum, [, qty]) => sum + qty, 0);

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
            .map(([price, qty], idx) => {
              const reversedIdx = levels - 1 - idx;
              const total = getAskTotal(reversedIdx);
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
                    {formatPrice(price)}
                  </div>
                  <div className="relative text-right">{formatQty(qty)}</div>
                  <div className="relative text-right text-[10px] text-muted-foreground">
                    {formatQty(total)}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Spread */}
        {orderBook.bids[0] && orderBook.asks[0] && (
          <div className="border-y bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Spread</span>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-foreground">
                  {formatPrice(orderBook.asks[0][0] - orderBook.bids[0][0])}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  (
                  {(
                    ((orderBook.asks[0][0] - orderBook.bids[0][0]) /
                      orderBook.bids[0][0]) *
                    PERCENTAGE_MULTIPLIER
                  ).toFixed(SPREAD_DECIMAL_PLACES)}
                  %)
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
          {orderBook.bids.slice(0, levels).map(([price, qty], idx) => {
            const total = getBidTotal(idx);
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
                  {formatPrice(price)}
                </div>
                <div className="relative text-right">{formatQty(qty)}</div>
                <div className="relative text-right text-[10px] text-muted-foreground">
                  {formatQty(total)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
