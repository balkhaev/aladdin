"use client";

import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BatchPredictionResult } from "@/lib/api/ml";

type BatchResultsTableProps = {
  results: BatchPredictionResult;
};

export function BatchResultsTable({ results }: BatchResultsTableProps) {
  const predictions = results.predictions;

  const avgConfidence =
    predictions.reduce(
      (sum, p) => sum + (p.predictions[0]?.confidence || 0),
      0
    ) / predictions.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Результаты предсказаний</span>
          <Badge>{results.count} успешно</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/50 p-3">
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Всего</div>
              <div className="font-semibold text-sm">{results.count}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Успешно</div>
              <div className="flex items-center gap-1 font-semibold text-green-500 text-sm">
                <CheckCircle2 className="size-3" />
                {results.count}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">
                Ср. уверенность
              </div>
              <div className="font-semibold text-sm">
                {(avgConfidence * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Predictions Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Символ</TableHead>
                <TableHead>Горизонт</TableHead>
                <TableHead>Предсказание</TableHead>
                <TableHead>Границы</TableHead>
                <TableHead>Уверенность</TableHead>
                <TableHead>Режим рынка</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictions.map((prediction) => {
                const firstPrediction = prediction.predictions[0];
                if (!firstPrediction) {
                  return null;
                }

                const change =
                  ((firstPrediction.predictedPrice -
                    (firstPrediction.lowerBound + firstPrediction.upperBound) /
                      2) /
                    ((firstPrediction.lowerBound + firstPrediction.upperBound) /
                      2)) *
                  100;
                const isPositive = change > 0;

                return (
                  <TableRow key={prediction.symbol}>
                    <TableCell className="font-medium">
                      {prediction.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{prediction.horizon}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isPositive ? (
                          <TrendingUp className="size-3 text-green-500" />
                        ) : (
                          <TrendingDown className="size-3 text-red-500" />
                        )}
                        <span className="font-mono text-sm">
                          ${firstPrediction.predictedPrice.toFixed(2)}
                        </span>
                        <span
                          className={
                            isPositive ? "text-green-500" : "text-red-500"
                          }
                        >
                          ({change > 0 ? "+" : ""}
                          {change.toFixed(2)}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      ${firstPrediction.lowerBound.toFixed(2)} - $
                      {firstPrediction.upperBound.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          firstPrediction.confidence > 0.7
                            ? "default"
                            : "secondary"
                        }
                      >
                        {(firstPrediction.confidence * 100).toFixed(0)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {prediction.features.marketRegime}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
