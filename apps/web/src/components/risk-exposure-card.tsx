/**
 * Portfolio Exposure Card Component
 * Отображает экспозицию портфеля (long/short/net/leverage)
 */

import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useExposure } from "../hooks/use-risk";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";

type RiskExposureCardProps = {
  portfolioId: string;
};

export function RiskExposureCard({ portfolioId }: RiskExposureCardProps) {
  const { data: exposure, isLoading } = useExposure(portfolioId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Экспозиция портфеля
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!exposure) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Экспозиция портфеля
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Нет данных об экспозиции
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const getLeverageColor = (leverage: number) => {
    if (leverage < 2) return "text-green-600";
    if (leverage < 5) return "text-yellow-600";
    return "text-red-600";
  };

  const marginUsagePercent =
    exposure.marginUsed > 0
      ? (exposure.marginUsed /
          (exposure.marginUsed + exposure.availableMargin)) *
        100
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Экспозиция портфеля
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Total Value */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Общая стоимость</p>
          <p className="font-bold text-3xl">
            {formatCurrency(exposure.totalValue)}
          </p>
        </div>

        {/* Long/Short Exposure */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-sm">Long экспозиция</span>
            </div>
            <span className="font-semibold text-green-600">
              {formatCurrency(exposure.longExposure)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <span className="text-sm">Short экспозиция</span>
            </div>
            <span className="font-semibold text-red-600">
              {formatCurrency(exposure.shortExposure)}
            </span>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Чистая экспозиция</span>
              <span className="font-bold">
                {formatCurrency(exposure.netExposure)}
              </span>
            </div>
          </div>
        </div>

        {/* Leverage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Плечо</span>
            <span
              className={`font-bold text-xl ${getLeverageColor(exposure.leverage)}`}
            >
              {exposure.leverage.toFixed(2)}x
            </span>
          </div>
          {exposure.leverage >= 5 && (
            <p className="text-red-600 text-xs">
              ⚠️ Высокое плечо! Повышенный риск ликвидации
            </p>
          )}
        </div>

        {/* Margin Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              Использование маржи
            </span>
            <span className="font-semibold text-sm">
              {marginUsagePercent.toFixed(1)}%
            </span>
          </div>
          <Progress value={marginUsagePercent} />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Использовано: {formatCurrency(exposure.marginUsed)}
            </span>
            <span className="text-muted-foreground">
              Доступно: {formatCurrency(exposure.availableMargin)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
