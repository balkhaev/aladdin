"use client";

import { GitMerge, TrendingDown, TrendingUp } from "lucide-react";
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
import type { EnsemblePredictionResult } from "@/lib/api/ml";

type EnsembleResultsCardProps = {
  results: EnsemblePredictionResult;
};

export function EnsembleResultsCard({ results }: EnsembleResultsCardProps) {
  const { ensemble } = results;
  const change =
    ((ensemble.prediction.predictedPrice -
      (ensemble.prediction.lowerBound + ensemble.prediction.upperBound) / 2) /
      ((ensemble.prediction.lowerBound + ensemble.prediction.upperBound) / 2)) *
    100;
  const isPositive = change > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitMerge className="size-5" />
          Результат ансамбля
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Prediction */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {results.symbol} - {results.horizon}
            </span>
            <Badge variant="outline">{results.strategy}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="size-5 text-green-500" />
            ) : (
              <TrendingDown className="size-5 text-red-500" />
            )}
            <div className="font-bold text-2xl">
              ${ensemble.prediction.predictedPrice.toFixed(2)}
            </div>
            <div
              className={`text-lg ${isPositive ? "text-green-500" : "text-red-500"}`}
            >
              ({change > 0 ? "+" : ""}
              {change.toFixed(2)}%)
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-muted-foreground text-sm">
            <span>
              Границы: ${ensemble.prediction.lowerBound.toFixed(2)} - $
              {ensemble.prediction.upperBound.toFixed(2)}
            </span>
            <Badge variant={results.confidence > 0.7 ? "default" : "secondary"}>
              Уверенность: {(results.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
        </div>

        {/* Model Contributions */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Вклад моделей</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Модель</TableHead>
                <TableHead>Предсказание</TableHead>
                <TableHead>Вес</TableHead>
                <TableHead>Уверенность</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ensemble.modelContributions.map((contribution) => (
                <TableRow key={contribution.modelType}>
                  <TableCell>
                    <Badge variant="outline">{contribution.modelType}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    ${contribution.prediction.predictedPrice.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${contribution.weight * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs">
                        {(contribution.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        contribution.prediction.confidence > 0.7
                          ? "default"
                          : "secondary"
                      }
                    >
                      {(contribution.prediction.confidence * 100).toFixed(0)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Individual Predictions */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">LSTM</div>
            <div className="font-semibold">
              $
              {results.individualPredictions.lstm.predictions[0]?.predictedPrice.toFixed(
                2
              )}
            </div>
            <div className="text-muted-foreground text-xs">
              Режим: {results.individualPredictions.lstm.features.marketRegime}
            </div>
          </div>
          <div className="space-y-1 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Hybrid</div>
            <div className="font-semibold">
              $
              {results.individualPredictions.hybrid.predictions[0]?.predictedPrice.toFixed(
                2
              )}
            </div>
            <div className="text-muted-foreground text-xs">
              Режим:{" "}
              {results.individualPredictions.hybrid.features.marketRegime}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

