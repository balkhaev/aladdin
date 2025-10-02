/**
 * Value at Risk Card Component
 * Отображает VaR с разными уровнями доверия
 */

import { AlertTriangle, TrendingDown } from "lucide-react";
import { useVaR } from "../hooks/use-risk";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type RiskVaRCardProps = {
  portfolioId: string;
};

export function RiskVaRCard({ portfolioId }: RiskVaRCardProps) {
  const { data: var95, isLoading: loading95 } = useVaR({
    portfolioId,
    confidenceLevel: 0.95,
  });

  const { data: var99, isLoading: loading99 } = useVaR({
    portfolioId,
    confidenceLevel: 0.99,
  });

  if (loading95 || loading99) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Value at Risk (VaR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPercent = (var_value: number, currentValue: number) =>
    ((var_value / currentValue) * 100).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Value at Risk (VaR)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="95">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="95">95% доверия</TabsTrigger>
            <TabsTrigger value="99">99% доверия</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4 space-y-4" value="95">
            {var95 ? (
              <>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    Максимальный ожидаемый убыток
                  </p>
                  <p className="font-bold text-2xl text-red-600">
                    {formatCurrency(var95.var)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatPercent(var95.var, var95.currentValue)}% от текущей
                    стоимости
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">
                      Текущая стоимость
                    </p>
                    <p className="font-semibold">
                      {formatCurrency(var95.currentValue)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">
                      Уровень доверия
                    </p>
                    <p className="font-semibold">
                      {(var95.confidenceLevel * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {(var95.sharpeRatio !== undefined ||
                  var95.maxDrawdown !== undefined) && (
                  <div className="grid grid-cols-2 gap-4 border-t pt-2">
                    {var95.sharpeRatio !== undefined && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          Sharpe Ratio
                        </p>
                        <p
                          className={`font-semibold ${
                            var95.sharpeRatio > 1
                              ? "text-green-600"
                              : var95.sharpeRatio > 0
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {var95.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {var95.maxDrawdown !== undefined && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          Max Drawdown
                        </p>
                        <p className="font-semibold text-red-600">
                          {var95.maxDrawdown.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    <div className="text-xs text-yellow-800">
                      <p className="font-medium">Что это значит?</p>
                      <p className="mt-1">
                        С вероятностью 95% ваши потери не превысят этой суммы в
                        течение следующего дня
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Недостаточно данных для расчета VaR
              </p>
            )}
          </TabsContent>

          <TabsContent className="mt-4 space-y-4" value="99">
            {var99 ? (
              <>
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    Максимальный ожидаемый убыток
                  </p>
                  <p className="font-bold text-2xl text-red-600">
                    {formatCurrency(var99.var)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatPercent(var99.var, var99.currentValue)}% от текущей
                    стоимости
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">
                      Текущая стоимость
                    </p>
                    <p className="font-semibold">
                      {formatCurrency(var99.currentValue)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">
                      Уровень доверия
                    </p>
                    <p className="font-semibold">
                      {(var99.confidenceLevel * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {(var99.sharpeRatio !== undefined ||
                  var99.maxDrawdown !== undefined) && (
                  <div className="grid grid-cols-2 gap-4 border-t pt-2">
                    {var99.sharpeRatio !== undefined && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          Sharpe Ratio
                        </p>
                        <p
                          className={`font-semibold ${
                            var99.sharpeRatio > 1
                              ? "text-green-600"
                              : var99.sharpeRatio > 0
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {var99.sharpeRatio.toFixed(2)}
                        </p>
                      </div>
                    )}
                    {var99.maxDrawdown !== undefined && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          Max Drawdown
                        </p>
                        <p className="font-semibold text-red-600">
                          {var99.maxDrawdown.toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    <div className="text-xs text-yellow-800">
                      <p className="font-medium">Что это значит?</p>
                      <p className="mt-1">
                        С вероятностью 99% ваши потери не превысят этой суммы в
                        течение следующего дня
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Недостаточно данных для расчета VaR
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
