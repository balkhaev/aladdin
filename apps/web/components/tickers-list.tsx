import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTickers } from "@/hooks/use-market-data";

/**
 * Компонент для отображения списка доступных тикеров
 */
export function TickersList() {
  const { data: tickers, isLoading, error } = useTickers();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Доступные тикеры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Доступные тикеры</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="destructive">Ошибка загрузки тикеров</Badge>
          <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!tickers || tickers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Доступные тикеры</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Нет доступных тикеров</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доступные тикеры</CardTitle>
        <p className="text-muted-foreground text-sm">Всего: {tickers.length}</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tickers.map((ticker) => (
            <Badge className="text-sm" key={ticker} variant="outline">
              {ticker}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


