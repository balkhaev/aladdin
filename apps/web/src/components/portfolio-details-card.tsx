/**
 * Portfolio Details Card Component
 * Отображает детальную информацию о портфеле: баланс, позиции, P&L
 */

import { ArrowDown, ArrowUp, Briefcase, TrendingUp } from "lucide-react";
import { usePortfolio, usePortfolioPerformance } from "../hooks/use-portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type PortfolioDetailsCardProps = {
  portfolioId: string;
};

export function PortfolioDetailsCard({
  portfolioId,
}: PortfolioDetailsCardProps) {
  const { data: portfolio, isLoading: portfolioLoading } =
    usePortfolio(portfolioId);
  const { data: performance, isLoading: performanceLoading } =
    usePortfolioPerformance(portfolioId);

  if (portfolioLoading || performanceLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Портфель
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!portfolio) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Портфель
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Портфель не найден</p>
        </CardContent>
      </Card>
    );
  }

  const PERCENT_DIVISOR = 100;
  const QUANTITY_DECIMAL_PLACES = 8;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const formatPercent = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / PERCENT_DIVISOR);

  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return "text-green-600";
    if (pnl < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          {portfolio.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Общая информация о портфеле */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Общая стоимость</p>
            <p className="font-bold text-xl">
              {formatCurrency(portfolio.totalValue)}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Общий P&L</p>
            <div className="flex items-center gap-1">
              <p
                className={`font-semibold text-lg ${getPnlColor(portfolio.totalPnl)}`}
              >
                {formatCurrency(portfolio.totalPnl)}
              </p>
              {portfolio.totalPnl !== 0 &&
                (portfolio.totalPnl > 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-600" />
                ))}
            </div>
            <p className={`text-xs ${getPnlColor(portfolio.totalPnl)}`}>
              {formatPercent(portfolio.totalPnlPercent)}
            </p>
          </div>

          {performance && (
            <>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Дневной P&L</p>
                <p
                  className={`font-semibold ${getPnlColor(performance.dailyPnl)}`}
                >
                  {formatCurrency(performance.dailyPnl)}
                </p>
                <p className={`text-xs ${getPnlColor(performance.dailyPnl)}`}>
                  {formatPercent(performance.dailyPnlPercent)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Месячный P&L</p>
                <p
                  className={`font-semibold ${getPnlColor(performance.monthlyPnl)}`}
                >
                  {formatCurrency(performance.monthlyPnl)}
                </p>
                <p className={`text-xs ${getPnlColor(performance.monthlyPnl)}`}>
                  {formatPercent(performance.monthlyPnlPercent)}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Позиции */}
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4" />
            Позиции ({portfolio.positions.length})
          </h3>

          {portfolio.positions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Символ</TableHead>
                    <TableHead className="text-right">Количество</TableHead>
                    <TableHead className="text-right">Средняя цена</TableHead>
                    <TableHead className="text-right">Текущая цена</TableHead>
                    <TableHead className="text-right">Стоимость</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.positions.map((position) => (
                    <TableRow key={position.symbol}>
                      <TableCell className="font-medium">
                        {position.symbol}
                      </TableCell>
                      <TableCell className="text-right">
                        {position.quantity.toFixed(QUANTITY_DECIMAL_PLACES)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.averagePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.currentPrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(position.value)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${getPnlColor(position.pnl)}`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {formatCurrency(position.pnl)}
                          {position.pnl !== 0 &&
                            (position.pnl > 0 ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            ))}
                        </div>
                        <div className="text-xs">
                          {formatPercent(position.pnlPercent)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Нет открытых позиций. Используйте кнопку "Синхронизировать" для
              импорта позиций с биржи.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
