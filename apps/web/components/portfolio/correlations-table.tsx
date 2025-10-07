/**
 * Correlations Table Component
 * Displays correlation matrix between portfolio assets
 */

import { Network } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const CORRELATION_HIGH_THRESHOLD = 0.7;
const CORRELATION_MEDIUM_THRESHOLD = 0.4;
const CORRELATION_LOW_THRESHOLD = -0.4;
const MAX_DISPLAYED_PAIRS = 5;

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePortfolioCorrelations } from "@/hooks/use-risk";

type CorrelationsTableProps = {
  portfolioId: string;
  window?: "7d" | "30d" | "90d";
};

export function CorrelationsTable({
  portfolioId,
  window = "30d",
}: CorrelationsTableProps) {
  const { data: correlations, isLoading } = usePortfolioCorrelations(
    portfolioId,
    {
      window,
    }
  );

  const getCorrelationColor = (correlation: number) => {
    if (correlation > CORRELATION_HIGH_THRESHOLD)
      return "bg-red-500/20 text-red-600";
    if (correlation > CORRELATION_MEDIUM_THRESHOLD)
      return "bg-yellow-500/20 text-yellow-600";
    if (correlation < CORRELATION_LOW_THRESHOLD)
      return "bg-blue-500/20 text-blue-600";
    return "bg-gray-500/10 text-gray-600";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Корреляции активов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const hasNoData = Boolean(
    !(correlations && correlations.correlations) ||
      correlations.correlations.length === 0
  );

  if (hasNoData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Корреляции активов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Недостаточно данных для анализа корреляций
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Корреляции активов
        </CardTitle>
        <CardDescription>
          Диверсификация:{" "}
          {correlations?.diversificationScore.toFixed(2) ?? "N/A"} | Средняя
          корреляция: {correlations?.avgCorrelation.toFixed(2) ?? "N/A"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {correlations && correlations.highlyCorrelated.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium text-sm">Высокая корреляция</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Пара</TableHead>
                      <TableHead className="text-right">Корреляция</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {correlations.highlyCorrelated
                      .slice(0, MAX_DISPLAYED_PAIRS)
                      .map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {item.symbol1} / {item.symbol2}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-block rounded px-2 py-1 text-xs ${getCorrelationColor(item.correlation)}`}
                            >
                              {item.correlation.toFixed(2)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
