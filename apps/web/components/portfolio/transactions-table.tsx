/**
 * Transactions Table Component
 * Displays portfolio transaction history with filtering and sorting
 */

import { format } from "date-fns";
import { ArrowDown, ArrowUp, History } from "lucide-react";
import { useMemo, useState } from "react";

const QUANTITY_DECIMALS = 8;

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortfolioTransactions } from "@/hooks/use-portfolio";

type TransactionsTableProps = {
  portfolioId: string;
};

type SortField = "timestamp" | "symbol" | "pnl" | "value";
type SortDirection = "asc" | "desc";

export function TransactionsTable({ portfolioId }: TransactionsTableProps) {
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [sideFilter, setSideFilter] = useState<string>("all");

  const { data: transactions, isLoading } = usePortfolioTransactions(
    portfolioId,
    {
      limit: 100,
    }
  );

  const sortedAndFilteredTransactions = useMemo(() => {
    if (!transactions) return [];

    let filtered = transactions;

    // Apply side filter
    if (sideFilter !== "all") {
      filtered = filtered.filter((t) => t.side === sideFilter);
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "timestamp":
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "symbol":
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case "pnl":
          comparison = a.pnl - b.pnl;
          break;
        case "value":
          comparison = a.value - b.value;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [transactions, sortField, sortDirection, sideFilter]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return "text-green-600";
    if (pnl < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История транзакций
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История транзакций
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Нет транзакций</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              История транзакций
            </CardTitle>
            <CardDescription className="mt-1">
              {sortedAndFilteredTransactions.length} транзакций
            </CardDescription>
          </div>
          <Select onValueChange={setSideFilter} value={sideFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="BUY">Покупки</SelectItem>
              <SelectItem value="SELL">Продажи</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("timestamp")}
                >
                  Время
                  {sortField === "timestamp" &&
                    (sortDirection === "asc" ? " ↑" : " ↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("symbol")}
                >
                  Символ
                  {sortField === "symbol" &&
                    (sortDirection === "asc" ? " ↑" : " ↓")}
                </TableHead>
                <TableHead>Тип</TableHead>
                <TableHead className="text-right">Количество</TableHead>
                <TableHead className="text-right">Цена</TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => handleSort("value")}
                >
                  Сумма
                  {sortField === "value" &&
                    (sortDirection === "asc" ? " ↑" : " ↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer text-right"
                  onClick={() => handleSort("pnl")}
                >
                  P&L
                  {sortField === "pnl" &&
                    (sortDirection === "asc" ? " ↑" : " ↓")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(transaction.timestamp), "dd.MM.yy HH:mm")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.symbol}
                  </TableCell>
                  <TableCell>
                    <div
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${
                        transaction.side === "BUY"
                          ? "bg-green-500/10 text-green-500"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {transaction.side === "BUY" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {transaction.side}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.quantity.toFixed(QUANTITY_DECIMALS)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(transaction.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(transaction.value)}
                  </TableCell>
                  <TableCell
                    className={`text-right ${getPnlColor(transaction.pnl)}`}
                  >
                    {transaction.pnl !== 0 && (
                      <div className="flex items-center justify-end gap-1">
                        {formatCurrency(transaction.pnl)}
                        {transaction.pnl > 0 ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
