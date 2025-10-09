"use client";

import { CheckCircle2, Clock, Gauge, HardDrive, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrainingResult } from "@/lib/api/ml";

type TrainingResultsProps = {
  result: TrainingResult;
};

export function TrainingResults({ result }: TrainingResultsProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}м ${secs}с`;
  };

  const formatSize = (mb: number) => `${mb.toFixed(2)} MB`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-500" />
          Обучение завершено
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Символ</div>
            <div className="font-semibold">{result.symbol}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Тип модели</div>
            <Badge variant="secondary">{result.model_type}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">
                Время обучения
              </div>
              <div className="font-medium text-sm">
                {formatTime(result.training_time)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Эпохи</div>
              <div className="font-medium text-sm">{result.epochs_trained}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="size-4 text-muted-foreground" />
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">Размер модели</div>
              <div className="font-medium text-sm">
                {formatSize(result.model_size_mb)}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Метрики</h4>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/50 p-3">
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">MAE</div>
              <div className="font-semibold text-sm">
                {result.metrics.mae.toFixed(4)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">RMSE</div>
              <div className="font-semibold text-sm">
                {result.metrics.rmse.toFixed(4)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">MAPE</div>
              <div className="font-semibold text-sm">
                {result.metrics.mape.toFixed(2)}%
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground text-xs">R² Score</div>
              <div className="font-semibold text-sm">
                {result.metrics.r2Score.toFixed(4)}
              </div>
            </div>
            <div className="col-span-2 space-y-1">
              <div className="text-muted-foreground text-xs">
                Точность направления
              </div>
              <div className="flex items-center gap-2">
                <div className="font-semibold text-sm">
                  {(result.metrics.directionalAccuracy * 100).toFixed(2)}%
                </div>
                <Badge
                  variant={
                    result.metrics.directionalAccuracy > 0.6
                      ? "default"
                      : "secondary"
                  }
                >
                  {result.metrics.directionalAccuracy > 0.6
                    ? "Хорошо"
                    : "Средне"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Model Path */}
        <div className="space-y-1">
          <div className="text-muted-foreground text-xs">Путь к модели</div>
          <div className="rounded bg-muted p-2 font-mono text-xs">
            {result.model_path}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
