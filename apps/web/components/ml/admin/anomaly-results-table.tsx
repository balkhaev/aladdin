"use client";

import { AlertTriangle } from "lucide-react";
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
import type { AnomalyDetectionResult } from "@/lib/api/ml";

type AnomalyResultsTableProps = {
  results: AnomalyDetectionResult;
};

const severityColors = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "destructive",
  CRITICAL: "destructive",
} as const;

const typeLabels = {
  PRICE_SPIKE: "Скачок цены",
  VOLUME_SPIKE: "Всплеск объема",
  SPREAD_ANOMALY: "Аномальный спред",
  PATTERN_BREAK: "Нарушение паттерна",
};

export function AnomalyResultsTable({ results }: AnomalyResultsTableProps) {
  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5" />
          Найденные аномалии ({results.anomalies.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.anomalies.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Аномалии не обнаружены
          </div>
        ) : (
          <div className="space-y-4">
            {/* Anomalies Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Время</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Важность</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Ожидаемая</TableHead>
                  <TableHead>Отклонение</TableHead>
                  <TableHead>Уверенность</TableHead>
                  <TableHead>Сообщение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.anomalies.map((anomaly, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-xs">
                      {formatTime(anomaly.timestamp)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeLabels[anomaly.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={severityColors[anomaly.severity]}>
                        {anomaly.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      ${anomaly.price.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      ${anomaly.expectedPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {(anomaly.deviation * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-xs">
                      {(anomaly.confidence * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {anomaly.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
