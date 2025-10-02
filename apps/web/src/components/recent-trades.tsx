import { TrendingDown, TrendingUp } from "lucide-react";
import { memo, useMemo } from "react";
import { useRecentTrades } from "../hooks/use-recent-trades";
import { useRecentTradesWS } from "../hooks/use-recent-trades-ws";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

type RecentTradesProps = {
  symbol: string;
  maxTrades?: number;
};

const REST_TRADES_LIMIT = 50;

export const RecentTrades = memo(
  ({ symbol, maxTrades = 20 }: RecentTradesProps) => {
    // Fallback to REST API with polling
    const { data: restTrades, isLoading } = useRecentTrades(
      symbol,
      REST_TRADES_LIMIT
    );

    // WebSocket for real-time updates
    const { trades: wsTrades } = useRecentTradesWS(symbol, REST_TRADES_LIMIT);

    // Use WebSocket data if available and has data, otherwise fallback to REST
    // Мемоизируем выбор источника данных
    const trades = useMemo(
      () => (wsTrades.length > 0 ? wsTrades : restTrades),
      [wsTrades, restTrades]
    );

    // Мемоизируем отсортированный список (свежие сверху)
    const sortedTrades = useMemo(
      () => trades?.sort((a, b) => b.time - a.time) || [],
      [trades]
    );

    // Мемоизируем обрезанный список для отображения
    const displayTrades = useMemo(
      () => sortedTrades.slice(0, maxTrades),
      [sortedTrades, maxTrades]
    );

    // Мемоизируем общий объем
    const totalVolume = useMemo(
      () => displayTrades.reduce((sum, t) => sum + (t.qty || 0), 0),
      [displayTrades]
    );

    if (isLoading || !trades) {
      return (
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="font-medium text-sm">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96" />
          </CardContent>
        </Card>
      );
    }

    const formatPrice = (price: number | undefined) => {
      if (price === undefined || price === null || Number.isNaN(price)) {
        return "0.00";
      }
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      });
    };

    const formatQty = (qty: number | undefined) => {
      if (qty === undefined || qty === null || Number.isNaN(qty)) {
        return "0.00";
      }
      return qty.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
    };

    const formatTime = (timestamp: number) => {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    };

    return (
      <Card className="flex h-full flex-col py-0">
        <CardContent className="flex-1 overflow-hidden p-0">
          {/* Header */}
          <div className="grid grid-cols-3 gap-2 border-b px-3 py-1 font-medium text-[10px] text-muted-foreground">
            <div className="text-left">Price</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Time</div>
          </div>

          {/* Trades List */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "calc(100% - 28px)" }}
          >
            {displayTrades.map((trade, index) => {
              const isBuy = !trade.isBuyerMaker; // If buyer is maker, it's a sell (seller is taker)

              return (
                <div
                  className={`grid cursor-pointer grid-cols-3 gap-2 px-3 py-1 font-mono text-[11px] hover:bg-muted/50 ${
                    isBuy ? "bg-green-500/5" : "bg-red-500/5"
                  }`}
                  key={`${trade.id}-${trade.time}-${index}`}
                >
                  {/* Price with icon */}
                  <div
                    className={`flex items-center gap-1 text-left ${
                      isBuy ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {isBuy ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{formatPrice(trade.price)}</span>
                  </div>

                  {/* Quantity */}
                  <div className="text-right">{formatQty(trade.qty)}</div>

                  {/* Time */}
                  <div className="text-right text-[10px] text-muted-foreground">
                    {formatTime(trade.time)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {trades.length > 0 && (
            <div className="border-t bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{trades.length} trades</span>
                <span>Vol: {formatQty(totalVolume)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

RecentTrades.displayName = "RecentTrades";
