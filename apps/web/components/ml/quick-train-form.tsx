/**
 * Quick Train Form
 * Simplified ML training form with preset configurations
 */

import { Brain, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import type { PredictionHorizon } from "../../lib/api/ml";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export type TrainingPreset = "fast" | "balanced" | "accurate";

export type QuickTrainConfig = {
  symbol: string;
  horizon: PredictionHorizon;
  preset: TrainingPreset;
};

type QuickTrainFormProps = {
  onSubmit: (config: QuickTrainConfig) => void;
  isLoading?: boolean;
};

const PRESET_INFO = {
  fast: {
    label: "Быстрый",
    description: "7 дней данных, без оптимизации (~3-5 мин)",
    icon: Zap,
    days: 7,
    walkForward: false,
    hpoTrials: 0,
  },
  balanced: {
    label: "Сбалансированный",
    description: "30 дней данных, легкая оптимизация (~10-15 мин)",
    icon: Brain,
    days: 30,
    walkForward: true,
    hpoTrials: 10,
  },
  accurate: {
    label: "Точный",
    description: "90 дней данных, полная оптимизация (~30-45 мин)",
    icon: Brain,
    days: 90,
    walkForward: true,
    hpoTrials: 30,
  },
};

export function QuickTrainForm({ onSubmit, isLoading }: QuickTrainFormProps) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [horizon, setHorizon] = useState<PredictionHorizon>("1h");
  const [preset, setPreset] = useState<TrainingPreset>("balanced");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ symbol, horizon, preset });
  };

  const selectedPreset = PRESET_INFO[preset];

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          Быстрое обучение модели
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Basic Parameters */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="symbol">Символ</Label>
              <Input
                id="symbol"
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                value={symbol}
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Торговая пара для обучения
              </p>
            </div>

            <div>
              <Label htmlFor="horizon">Горизонт прогноза</Label>
              <Select
                onValueChange={(v) => setHorizon(v as PredictionHorizon)}
                value={horizon}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 час</SelectItem>
                  <SelectItem value="4h">4 часа</SelectItem>
                  <SelectItem value="1d">1 день</SelectItem>
                  <SelectItem value="7d">7 дней</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-muted-foreground text-xs">
                Период прогнозирования цены
              </p>
            </div>
          </div>

          {/* Training Preset */}
          <div>
            <Label htmlFor="preset">Режим обучения</Label>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
              {(
                Object.entries(PRESET_INFO) as [
                  TrainingPreset,
                  typeof PRESET_INFO.fast,
                ][]
              ).map(([key, info]) => {
                const Icon = info.icon;
                const isSelected = preset === key;
                const buttonClassName = isSelected
                  ? "rounded-lg border-2 border-purple-500 bg-purple-500/10 p-4 text-left transition-all"
                  : "rounded-lg border-2 border-border bg-card/50 p-4 text-left transition-all hover:border-purple-500/50";
                const iconClassName = isSelected
                  ? "h-5 w-5 text-purple-500"
                  : "h-5 w-5 text-muted-foreground";
                const optimizationText =
                  info.hpoTrials === 0 ? "Нет" : `${info.hpoTrials} проб`;
                return (
                  <button
                    className={buttonClassName}
                    key={key}
                    onClick={() => setPreset(key)}
                    type="button"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className={iconClassName} />
                      <span className="font-semibold">{info.label}</span>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {info.description}
                    </p>
                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Данные:</span>
                        <span className="font-medium">{info.days} дней</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Walk-Forward:
                        </span>
                        <span className="font-medium">
                          {info.walkForward ? "Да" : "Нет"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Оптимизация:
                        </span>
                        <span className="font-medium">{optimizationText}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
            <p className="text-blue-100 text-sm">
              <strong>Что будет происходить:</strong>
            </p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-muted-foreground text-sm">
              <li>Обучение LSTM и Hybrid моделей</li>
              <li>Автоматическое сравнение результатов</li>
              <li>Сохранение лучшей модели для использования</li>
              <li>Все параметры настроены оптимально</li>
            </ul>
          </div>

          {/* Submit Button */}
          <Button
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            disabled={isLoading}
            size="lg"
            type="submit"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Обучение моделей...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-5 w-5" />
                Начать обучение
              </>
            )}
          </Button>

          {isLoading && (
            <p className="text-center text-muted-foreground text-sm">
              Ожидаемое время: ~{(() => {
                if (selectedPreset.label === "Быстрый") return "3-5";
                if (selectedPreset.label === "Сбалансированный") return "10-15";
                return "30-45";
              })()} мин
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
