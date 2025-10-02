import { TrendingDown, TrendingUp } from "lucide-react";
import { memo, useMemo, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketDataWS } from "@/hooks/use-market-data-ws";

const PRICE_DECIMAL_PLACES = 2;
const VOLUME_DECIMAL_PLACES = 4;

type MarketTickerWSProps = {
  symbol: string;
};

/**
 * Компонент для отображения котировки в real-time через WebSocket
 * Автоматически обновляется при получении новых данных
 * Оптимизирован с использованием memo для предотвращения лишних ререндеров
 */
export const MarketTickerWS = memo(({ symbol }: MarketTickerWSProps) => {
  const { quote, status, isConnected } = useMarketDataWS(symbol);
  const prevPriceRef = useRef<number | null>(null);

  // Вычисляем изменение цены через useMemo
  const priceChange = useMemo(() => {
    if (!quote || prevPriceRef.current === null) {
      if (quote) {
        prevPriceRef.current = quote.price;
      }
      return 0;
    }

    const change = quote.price - prevPriceRef.current;
    prevPriceRef.current = quote.price;
    return change;
  }, [quote]);

  // Мемоизируем форматированные значения (до early returns)
  const formattedPrice = useMemo(
    () => quote?.price.toLocaleString() || "",
    [quote]
  );
  const formattedBid = useMemo(
    () => quote?.bid.toLocaleString() || "",
    [quote]
  );
  const formattedAsk = useMemo(
    () => quote?.ask.toLocaleString() || "",
    [quote]
  );
  const formattedBidVolume = useMemo(
    () => quote?.bidVolume.toFixed(VOLUME_DECIMAL_PLACES) || "",
    [quote]
  );
  const formattedAskVolume = useMemo(
    () => quote?.askVolume.toFixed(VOLUME_DECIMAL_PLACES) || "",
    [quote]
  );
  const formattedTime = useMemo(
    () => (quote ? new Date(quote.timestamp).toLocaleTimeString() : ""),
    [quote]
  );
  const formattedPriceChange = useMemo(
    () => priceChange.toFixed(PRICE_DECIMAL_PLACES),
    [priceChange]
  );

  if (status === "connecting" || !isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{symbol}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
          <div className="text-muted-foreground text-sm">
            {status === "connecting" ? "Подключение..." : "Переподключение..."}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Ожидание данных...
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = priceChange >= 0;

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">{symbol}</CardTitle>
            <div
              className="h-2 w-2 animate-pulse rounded-full bg-green-500"
              title="Live WebSocket"
            />
          </div>
          <Badge variant={isPositive ? "default" : "secondary"}>
            {isPositive ? (
              <TrendingUp className="mr-1 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {formattedPriceChange}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Текущая цена */}
        <div>
          <p className="font-bold text-3xl">${formattedPrice}</p>
          <p className="text-muted-foreground text-xs">Текущая цена</p>
        </div>

        {/* Bid/Ask */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-green-600 text-lg">
              ${formattedBid}
            </p>
            <p className="text-muted-foreground text-xs">
              Bid ({formattedBidVolume})
            </p>
          </div>
          <div>
            <p className="font-semibold text-lg text-red-600">
              ${formattedAsk}
            </p>
            <p className="text-muted-foreground text-xs">
              Ask ({formattedAskVolume})
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <p className="text-muted-foreground text-xs">
          Обновлено: {formattedTime}
        </p>
      </CardContent>
    </Card>
  );
});

MarketTickerWS.displayName = "MarketTickerWS";
