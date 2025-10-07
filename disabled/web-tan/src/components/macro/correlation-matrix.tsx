/**
 * Correlation Matrix Component
 * Матрица корреляций между категориями
 */

import { Network } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useCategoryCorrelation } from "@/hooks/use-macro-data";

const CELL_SIZE = 80;
const PADDING = 4;
const CORRELATION_VERY_STRONG = 0.8;
const CORRELATION_STRONG = 0.6;
const CORRELATION_MODERATE = 0.4;
const CORRELATION_WEAK = 0.2;
const CORRELATION_DECIMAL_PLACES = 3;
const CORRELATION_PERFECT_THRESHOLD = 0.99;

type PeriodOption = "7" | "14" | "30";

/**
 * Получить цвет ячейки по значению корреляции
 */
function getCorrelationColor(correlation: number): string {
  const absCorr = Math.abs(correlation);

  if (correlation > 0) {
    // Положительная корреляция (зеленый)
    if (absCorr > CORRELATION_VERY_STRONG) return "bg-green-700";
    if (absCorr > CORRELATION_STRONG) return "bg-green-600";
    if (absCorr > CORRELATION_MODERATE) return "bg-green-500";
    if (absCorr > CORRELATION_WEAK) return "bg-green-400";
    return "bg-green-300";
  }

  // Отрицательная корреляция (красный)
  if (absCorr > CORRELATION_VERY_STRONG) return "bg-red-700";
  if (absCorr > CORRELATION_STRONG) return "bg-red-600";
  if (absCorr > CORRELATION_MODERATE) return "bg-red-500";
  if (absCorr > CORRELATION_WEAK) return "bg-red-400";
  return "bg-red-300";
}

/**
 * Форматировать имя категории
 */
function formatCategory(category: string): string {
  return category.replace("Layer ", "L");
}

export function CorrelationMatrix() {
  const [period, setPeriod] = useState<PeriodOption>("7");
  const { data, isLoading, error } = useCategoryCorrelation(Number(period));

  const { categories, matrix, hasLimitedData } = useMemo(() => {
    if (!data)
      return {
        categories: [],
        matrix: new Map<string, number>(),
        hasLimitedData: false,
      };

    // Получить уникальные категории
    const cats = Array.from(
      new Set(data.flatMap((d) => [d.category1, d.category2]))
    ).sort();

    // Создать матрицу
    const mat = new Map<string, number>();
    for (const item of data) {
      mat.set(`${item.category1}|${item.category2}`, item.correlation);
    }

    // Проверяем, есть ли идеальные корреляции (признак малого количества данных)
    const hasIdealCorrelations = data.some(
      (d) =>
        d.category1 !== d.category2 &&
        Math.abs(d.correlation) > CORRELATION_PERFECT_THRESHOLD
    );

    return {
      categories: cats,
      matrix: mat,
      hasLimitedData: hasIdealCorrelations,
    };
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Correlation Matrix
          </CardTitle>
          <CardDescription>
            Correlation between category price movements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data || categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Correlation Matrix
          </CardTitle>
          <CardDescription>
            Correlation between category price movements
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              {error
                ? "Failed to load correlation data"
                : "Недостаточно данных для построения матрицы корреляций"}
            </p>
            {!error && (
              <p className="text-muted-foreground text-xs">
                Требуется минимум 2 дня исторических данных по категориям
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Correlation Matrix
            </CardTitle>
            <CardDescription>
              Correlation between category price movements
            </CardDescription>
          </div>
          <Select
            onValueChange={(v) => setPeriod(v as PeriodOption)}
            value={period}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="14">14 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasLimitedData && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <p className="text-amber-600 text-sm dark:text-amber-500">
              ⚠️ Недостаточно исторических данных. Корреляции могут быть
              неточными. Рекомендуется минимум 7 дней данных.
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-600" />
            <span>-1.0 (Negative)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gray-400" />
            <span>0 (None)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-600" />
            <span>+1.0 (Positive)</span>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header row */}
            <div className="flex">
              <div
                className="flex-shrink-0"
                style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
              />
              {categories.map((cat) => (
                <div
                  className="flex flex-shrink-0 items-center justify-center font-medium text-xs"
                  key={cat}
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    padding: `${PADDING}px`,
                  }}
                >
                  <div className="rotate-[-45deg]">{formatCategory(cat)}</div>
                </div>
              ))}
            </div>

            {/* Data rows */}
            {categories.map((row) => (
              <div className="flex" key={row}>
                {/* Row header */}
                <div
                  className="flex flex-shrink-0 items-center justify-end pr-2 font-medium text-xs"
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                  }}
                >
                  {formatCategory(row)}
                </div>

                {/* Data cells */}
                {categories.map((col) => {
                  const correlation = matrix.get(`${row}|${col}`) ?? 0;
                  const color = getCorrelationColor(correlation);
                  const isDiagonal = row === col;

                  return (
                    <div
                      className={`${color} group relative flex flex-shrink-0 cursor-pointer items-center justify-center rounded font-semibold text-white text-xs transition-all hover:scale-105 hover:shadow-lg ${
                        isDiagonal ? "opacity-50" : ""
                      }`}
                      key={col}
                      style={{
                        width: `${CELL_SIZE - PADDING * 2}px`,
                        height: `${CELL_SIZE - PADDING * 2}px`,
                        margin: `${PADDING}px`,
                      }}
                      title={`${row} vs ${col}: ${correlation.toFixed(2)}`}
                    >
                      {correlation.toFixed(2)}

                      {/* Tooltip */}
                      {!isDiagonal && (
                        <div className="-translate-x-1/2 absolute bottom-full left-1/2 z-10 mb-2 hidden whitespace-nowrap rounded bg-popover px-3 py-2 text-popover-foreground text-xs shadow-lg group-hover:block">
                          <div className="font-semibold">
                            {row} ↔ {col}
                          </div>
                          <div>
                            Correlation:{" "}
                            {correlation.toFixed(CORRELATION_DECIMAL_PLACES)}
                          </div>
                          <div className="text-[10px] opacity-75">
                            {correlation > 0
                              ? "Positive relationship"
                              : "Negative relationship"}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-muted-foreground text-xs">
          <p>
            • <strong>Positive correlation</strong> (green): Categories tend to
            move together
          </p>
          <p>
            • <strong>Negative correlation</strong> (red): Categories tend to
            move in opposite directions
          </p>
          <p>
            • <strong>Values closer to ±1.0</strong> indicate stronger
            relationships
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
