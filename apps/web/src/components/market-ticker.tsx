import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuote } from "@/hooks/use-market-data";

const PRICE_DECIMAL_PLACES = 2;
const VOLUME_DECIMAL_PLACES = 4;

type MarketTickerProps = {
  symbol: string;
};

/**
 * Компонент для отображения котировки в real-time
 * Обновляется автоматически каждую секунду через useQuote hook
 */
export function MarketTicker({ symbol }: MarketTickerProps) {
  const { data: quote, isLoading, error } = useQuote(symbol);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{symbol}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{symbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="destructive">Ошибка загрузки</Badge>
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return null;
  }

  // Вычисляем изменение цены (пример, в реальности нужно сравнивать с предыдущей ценой)
  const priceChange = quote.ask - quote.bid;
  const isPositive = priceChange >= 0;

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{symbol}</CardTitle>
          <Badge variant={isPositive ? "default" : "secondary"}>
            {isPositive ? (
              <TrendingUp className="mr-1 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3" />
            )}
            {isPositive ? "+" : ""}
            {priceChange.toFixed(PRICE_DECIMAL_PLACES)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Текущая цена */}
        <div>
          <p className="font-bold text-3xl">${quote.price.toLocaleString()}</p>
          <p className="text-muted-foreground text-xs">Текущая цена</p>
        </div>

        {/* Bid/Ask */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-green-600 text-lg">
              ${quote.bid.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-xs">
              Bid ({quote.bidVolume.toFixed(VOLUME_DECIMAL_PLACES)})
            </p>
          </div>
          <div>
            <p className="font-semibold text-lg text-red-600">
              ${quote.ask.toLocaleString()}
            </p>
            <p className="text-muted-foreground text-xs">
              Ask ({quote.askVolume.toFixed(VOLUME_DECIMAL_PLACES)})
            </p>
          </div>
        </div>

        {/* Timestamp */}
        <p className="text-muted-foreground text-xs">
          Обновлено: {new Date(quote.timestamp).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}
