/**
 * Positions Table Component
 * Displays current portfolio positions with P&L
 */

import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useExchangeCredentials } from "../hooks/use-exchange-credentials";
import { usePortfolios } from "../hooks/use-portfolio";
import type { Position } from "../lib/api/portfolio";
import Loader from "./loader";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

function PnLBadge({ pnl, pnlPercent }: { pnl: number; pnlPercent: number }) {
  if (pnl > 0) {
    return (
      <Badge className="gap-1 bg-green-600" variant="default">
        <ArrowUp className="h-3 w-3" />
        +${pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
      </Badge>
    );
  }
  if (pnl < 0) {
    return (
      <Badge className="gap-1" variant="destructive">
        <ArrowDown className="h-3 w-3" />
        -${Math.abs(pnl).toFixed(2)} ({pnlPercent.toFixed(2)}%)
      </Badge>
    );
  }
  return (
    <Badge className="gap-1" variant="outline">
      <Minus className="h-3 w-3" />
      $0.00 (0.00%)
    </Badge>
  );
}

function PositionRow({ position }: { position: Position }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{position.symbol}</TableCell>
      <TableCell className="text-right">{position.quantity}</TableCell>
      <TableCell className="text-right">
        ${position.averagePrice.toFixed(2)}
      </TableCell>
      <TableCell className="text-right">
        ${position.currentPrice.toFixed(2)}
      </TableCell>
      <TableCell className="text-right font-medium">
        ${position.value.toFixed(2)}
      </TableCell>
      <TableCell>
        <PnLBadge pnl={position.pnl} pnlPercent={position.pnlPercent} />
      </TableCell>
    </TableRow>
  );
}

export function PositionsTable() {
  // Check if user has exchange credentials first
  const { data: credentials, isLoading: isLoadingCredentials } =
    useExchangeCredentials();
  const hasCredentials = credentials && credentials.length > 0;

  // Only fetch portfolios if user has credentials
  const {
    data: portfolios,
    isLoading: isLoadingPortfolios,
    error,
  } = usePortfolios({
    enabled: hasCredentials,
  });

  const isLoading = isLoadingCredentials || isLoadingPortfolios;

  // Get the first portfolio (main portfolio)
  const portfolio = portfolios?.[0];
  const positions = portfolio?.positions ?? [];

  // Computed states for cleaner conditions
  const credentialsLoaded = !isLoadingCredentials;
  const showNoCredentials = credentialsLoaded && !hasCredentials;

  const dataReady = !isLoading;
  const hasError = Boolean(error);
  const showError = dataReady && hasCredentials && hasError;

  const hasPositions = positions.length > 0;
  const noError = !hasError;
  const showEmptyState =
    dataReady && noError && hasCredentials && !hasPositions;
  const showTable = dataReady && noError && hasCredentials && hasPositions;

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-lg">Позиции</h3>
        {portfolio && (
          <div className="text-right">
            <div className="text-muted-foreground text-sm">Общая стоимость</div>
            <div className="font-bold text-lg">
              ${portfolio.totalValue.toFixed(2)}
            </div>
            <PnLBadge
              pnl={portfolio.totalPnl}
              pnlPercent={portfolio.totalPnlPercent}
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      )}

      {/* Show message if no credentials configured */}
      {showNoCredentials && (
        <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="text-muted-foreground">
            Для просмотра позиций необходимо добавить API ключи биржи
          </div>
          <Button asChild>
            <Link to="/settings">Перейти в настройки</Link>
          </Button>
        </div>
      )}

      {showError && (
        <div className="py-8 text-center text-destructive">
          Ошибка загрузки: {(error as Error).message}
        </div>
      )}

      {showEmptyState && (
        <div className="py-8 text-center text-muted-foreground">
          Нет открытых позиций
        </div>
      )}

      {showTable && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Символ</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Средняя цена</TableHead>
                <TableHead className="text-right">Текущая цена</TableHead>
                <TableHead className="text-right">Стоимость</TableHead>
                <TableHead>P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <PositionRow key={position.symbol} position={position} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
