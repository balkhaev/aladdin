"use client";
/**
 * Automation Page
 * Unified page for strategy execution, ML models, and backtesting
 */

import {
  AlertCircle,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BacktestForm } from "@/components/backtest-form";
import { BacktestResults } from "@/components/backtest-results";
import { ExecutorControlPanel } from "@/components/executor/executor-control-panel";
import { ExecutorStatsCard } from "@/components/executor/executor-stats-card";
import { PendingSignalsTable } from "@/components/executor/pending-signals-table";
import { HPOConfigForm } from "@/components/ml/hpo-config-form";
import { HPOOptimizationResults } from "@/components/ml/hpo-optimization-results";
import { MLBacktestResults } from "@/components/ml/ml-backtest-results";
import { ModelCleanupDialog } from "@/components/ml/model-cleanup-dialog";
import { ModelComparisonCard } from "@/components/ml/model-comparison-card";
import { ModelListCard } from "@/components/ml/model-list-card";
import { QuickTrainForm } from "@/components/ml/quick-train-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBacktest } from "@/hooks/use-backtest";
import { useRunOptimization } from "@/hooks/use-hpo";
import { useCompareModels, useRunBacktest } from "@/hooks/use-ml-backtest";
import type { TrainingPreset } from "@/hooks/use-quick-train";
import { useQuickTrain } from "@/hooks/use-quick-train";
import { useSaveModel } from "@/hooks/use-save-model";
import type { BacktestParams, BacktestResult } from "@/lib/api/backtest";
import type { ModelType, PredictionHorizon } from "@/lib/api/ml";

export default function AutomationPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <Zap className="size-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Автотрейдинг</h1>
            <p className="text-muted-foreground">
              Стратегии, машинное обучение и бэктестинг
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs className="space-y-6" defaultValue="strategies">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger className="gap-2" value="strategies">
            <Zap className="size-4" />
            <span>Стратегии</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="ml">
            <Brain className="size-4" />
            <span>ML Модели</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="backtest">
            <BarChart3 className="size-4" />
            <span>Бэктестинг</span>
          </TabsTrigger>
        </TabsList>

        {/* Strategies Tab (Executor) */}
        <TabsContent className="space-y-6" value="strategies">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>О стратегиях автоисполнения</AlertTitle>
            <AlertDescription>
              Executor автоматически отслеживает торговые сигналы со скринера и
              исполняет ордера согласно вашим настройкам. Доступны режимы PAPER
              для тестирования и LIVE для реальной торговли. Поддерживает
              алгоритмические стратегии исполнения: VWAP, TWAP и Iceberg.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Left Column - Stats (2/3 width) */}
            <div className="space-y-4 md:col-span-2">
              <ExecutorStatsCard />
              <PendingSignalsTable />
            </div>

            {/* Right Column - Control Panel (1/3 width) */}
            <div className="space-y-4">
              <ExecutorControlPanel />
            </div>
          </div>
        </TabsContent>

        {/* ML Models Tab */}
        <TabsContent className="space-y-6" value="ml">
          <MLModelsContent />
        </TabsContent>

        {/* Backtesting Tab */}
        <TabsContent className="space-y-6" value="backtest">
          <BacktestContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type MLConfigFormProps = {
  symbol: string;
  setSymbol: (value: string) => void;
  horizon: PredictionHorizon;
  setHorizon: (value: PredictionHorizon) => void;
  modelType: ModelType;
  setModelType: (value: ModelType) => void;
  days: number;
  setDays: (value: number) => void;
  includeSentiment: boolean;
  setIncludeSentiment: (value: boolean) => void;
  walkForward: boolean;
  setWalkForward: (value: boolean) => void;
  retrainInterval: number;
  setRetrainInterval: (value: number) => void;
  onRunBacktest: () => void;
  onCompareModels: () => void;
  isBacktestPending: boolean;
  isComparePending: boolean;
};

export function MLConfigurationForm({
  symbol,
  setSymbol,
  horizon,
  setHorizon,
  modelType,
  setModelType,
  days,
  setDays,
  includeSentiment,
  setIncludeSentiment,
  walkForward,
  setWalkForward,
  retrainInterval,
  setRetrainInterval,
  onRunBacktest,
  onCompareModels,
  isBacktestPending,
  isComparePending,
}: MLConfigFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ML Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="BTCUSDT"
              value={symbol}
            />
          </div>
          <div>
            <Label htmlFor="horizon">Prediction Horizon</Label>
            <Select
              onValueChange={(v) => setHorizon(v as PredictionHorizon)}
              value={horizon}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="4h">4 Hours</SelectItem>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="modelType">Model Type</Label>
            <Select
              onValueChange={(v) => setModelType(v as ModelType)}
              value={modelType}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LSTM">LSTM</SelectItem>
                <SelectItem value="HYBRID">Hybrid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="days">Historical Period (Days)</Label>
            <Input
              id="days"
              max={365}
              min={7}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
              type="number"
              value={days}
            />
          </div>
          <div className="flex flex-col justify-between">
            <Label htmlFor="includeSentiment">Include Sentiment</Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={includeSentiment}
                id="includeSentiment"
                onCheckedChange={setIncludeSentiment}
              />
              <span className="text-muted-foreground text-sm">
                {includeSentiment ? "Using sentiment data" : "Technical only"}
              </span>
            </div>
          </div>
          <div>
            <Label htmlFor="walkForward">Testing Mode</Label>
            <Select
              onValueChange={(v) => setWalkForward(v === "walk-forward")}
              value={walkForward ? "walk-forward" : "simple"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="walk-forward">Walk-Forward</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {walkForward && (
            <div>
              <Label htmlFor="retrainInterval">Retrain Interval (Days)</Label>
              <Input
                id="retrainInterval"
                max={90}
                min={1}
                onChange={(e) =>
                  setRetrainInterval(Number.parseInt(e.target.value, 10))
                }
                type="number"
                value={retrainInterval}
              />
            </div>
          )}
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1"
            disabled={isBacktestPending}
            onClick={onRunBacktest}
          >
            {isBacktestPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Backtest...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Run Backtest
              </>
            )}
          </Button>
          <Button
            className="flex-1"
            disabled={isComparePending}
            onClick={onCompareModels}
            variant="outline"
          >
            {isComparePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              "Compare LSTM vs Hybrid"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MLStatusStepper({
  isTraining,
  modelSaved,
}: {
  isTraining: boolean;
  modelSaved: boolean;
}) {
  return (
    <Card className="border-purple-500/20 bg-purple-500/5">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          {/* Step 1: Training */}
          <div className="flex flex-1 flex-col items-center">
            <div
              className={(() => {
                if (modelSaved) {
                  return "mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/20 font-semibold text-green-500";
                }
                if (isTraining) {
                  return "mb-2 flex h-12 w-12 animate-pulse items-center justify-center rounded-full border-2 border-purple-500 bg-purple-500/20 font-semibold text-purple-500";
                }
                return "mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-purple-500 bg-purple-500/20 font-semibold text-purple-500";
              })()}
            >
              {(() => {
                if (modelSaved) return <CheckCircle2 className="h-6 w-6" />;
                if (isTraining)
                  return <Loader2 className="h-6 w-6 animate-spin" />;
                return "1";
              })()}
            </div>
            <span className="text-center font-semibold text-base">
              Обучение
            </span>
            <span className="text-center text-muted-foreground text-xs">
              Тренировка и выбор лучшей модели
            </span>
          </div>

          <div className="h-0.5 w-24 flex-1 bg-border" />

          {/* Step 2: Production Use */}
          <div className="flex flex-1 flex-col items-center">
            <div
              className={`mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 font-semibold ${
                modelSaved
                  ? "border-green-500 bg-green-500/20 text-green-500"
                  : "border-border bg-muted text-muted-foreground"
              }`}
            >
              {modelSaved ? <CheckCircle2 className="h-6 w-6" /> : "2"}
            </div>
            <span className="text-center font-semibold text-base">
              Использование
            </span>
            <span className="text-center text-muted-foreground text-xs">
              Модель готова на /trading
            </span>
          </div>
        </div>

        {modelSaved && (
          <div className="mt-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-center">
            <p className="font-semibold text-green-500">
              <CheckCircle2 className="mr-1 inline h-5 w-5" />
              Модель сохранена и готова к использованию
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              Включите ML прогнозы на странице /trading для использования модели
              в реальной торговле
            </p>
          </div>
        )}

        {isTraining && (
          <div className="mt-6 rounded-lg border border-purple-500/20 bg-purple-500/10 p-4 text-center">
            <p className="font-semibold text-purple-500">
              <Loader2 className="mr-1 inline h-5 w-5 animate-spin" />
              Идет обучение моделей...
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              Это может занять несколько минут. Не закрывайте страницу.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MLModelsContent() {
  // Quick Train state
  const quickTrainMutation = useQuickTrain();

  // Advanced settings state (for collapsible section)
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [horizon, setHorizon] = useState<PredictionHorizon>("1h");
  const [modelType, setModelType] = useState<ModelType>("LSTM");
  const [walkForward, setWalkForward] = useState(true);
  const [retrainInterval, setRetrainInterval] = useState(30);
  const [days, setDays] = useState(30);
  const [includeSentiment, setIncludeSentiment] = useState(true);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const runBacktestMutation = useRunBacktest();
  const compareModelsMutation = useCompareModels();
  const runOptimizationMutation = useRunOptimization();
  const saveModelMutation = useSaveModel();

  // Quick Train handler
  const handleQuickTrain = (config: {
    symbol: string;
    horizon: PredictionHorizon;
    preset: TrainingPreset;
  }) => {
    quickTrainMutation.mutate(config);
  };

  const handleRunBacktest = () => {
    const endDate = Date.now();
    const startDate = endDate - days * 24 * 60 * 60 * 1000;
    runBacktestMutation.mutate({
      symbol,
      modelType,
      horizon,
      startDate,
      endDate,
      walkForward,
      retrainInterval: walkForward ? retrainInterval : undefined,
      includeSentiment,
    });
  };

  const handleCompareModels = () => {
    const endDate = Date.now();
    const startDate = endDate - days * 24 * 60 * 60 * 1000;
    compareModelsMutation.mutate({
      symbol,
      horizon,
      startDate,
      endDate,
      walkForward,
      retrainInterval: walkForward ? retrainInterval : undefined,
      includeSentiment,
    });
  };

  useEffect(() => {
    if (quickTrainMutation.isSuccess) {
      const result = quickTrainMutation.data;
      toast.success("Модель обучена и сохранена!", {
        description: `Лучшая модель: ${result.savedModel.modelType} (точность: ${(result.savedModel.accuracy * 100).toFixed(1)}%)`,
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [quickTrainMutation.isSuccess, quickTrainMutation.data]);

  useEffect(() => {
    if (quickTrainMutation.isError) {
      toast.error("Ошибка обучения модели", {
        description: quickTrainMutation.error.message,
        icon: <AlertCircle className="h-5 w-5 text-red-500" />,
      });
    }
  }, [quickTrainMutation.isError, quickTrainMutation.error]);

  useEffect(() => {
    if (saveModelMutation.isSuccess) {
      toast.success("Модель сохранена", {
        description: "Модель готова для использования",
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [saveModelMutation.isSuccess]);

  useEffect(() => {
    if (compareModelsMutation.isSuccess) {
      toast.success("Модели обучены", {
        description: "LSTM и Hybrid модели готовы",
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [compareModelsMutation.isSuccess]);

  useEffect(() => {
    if (runOptimizationMutation.isSuccess) {
      toast.success("Модель оптимизирована", {
        description: `Оптимизированная модель для ${symbol} сохранена`,
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [runOptimizationMutation.isSuccess, symbol]);

  return (
    <>
      <MLStatusStepper
        isTraining={quickTrainMutation.isPending}
        modelSaved={quickTrainMutation.isSuccess}
      />

      {/* Quick Train Form */}
      <QuickTrainForm
        isLoading={quickTrainMutation.isPending}
        onSubmit={handleQuickTrain}
      />

      {/* Advanced Settings */}
      <Collapsible onOpenChange={setShowAdvanced} open={showAdvanced}>
        <Card className="border-orange-500/20">
          <CardHeader>
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Продвинутые настройки
              </CardTitle>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Для опытных пользователей</AlertTitle>
                <AlertDescription>
                  Эти настройки позволяют гибко настроить процесс обучения и
                  оптимизации гиперпараметров. Для большинства случаев
                  рекомендуется использовать быстрое обучение выше.
                </AlertDescription>
              </Alert>

              <MLConfigurationForm
                days={days}
                horizon={horizon}
                includeSentiment={includeSentiment}
                isBacktestPending={runBacktestMutation.isPending}
                isComparePending={compareModelsMutation.isPending}
                modelType={modelType}
                onCompareModels={handleCompareModels}
                onRunBacktest={handleRunBacktest}
                retrainInterval={retrainInterval}
                setDays={setDays}
                setHorizon={setHorizon}
                setIncludeSentiment={setIncludeSentiment}
                setModelType={setModelType}
                setRetrainInterval={setRetrainInterval}
                setSymbol={setSymbol}
                setWalkForward={setWalkForward}
                symbol={symbol}
                walkForward={walkForward}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Results */}
      <Tabs className="w-full" defaultValue="results">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="results">Результаты</TabsTrigger>
          <TabsTrigger value="train">Ручная HPO</TabsTrigger>
          <TabsTrigger value="evaluate">Оценка</TabsTrigger>
          <TabsTrigger value="models">Модели</TabsTrigger>
        </TabsList>

        {/* Quick Train Results */}
        <TabsContent className="space-y-6" value="results">
          {quickTrainMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
                  <p className="font-semibold text-lg">Обучение моделей...</p>
                  <p className="text-muted-foreground">
                    Тренируем LSTM и Hybrid модели, это займет несколько минут
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {quickTrainMutation.isError && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                  <div>
                    <p className="font-semibold text-lg text-red-400">
                      Ошибка обучения
                    </p>
                    <p className="mt-2 text-muted-foreground text-sm">
                      {quickTrainMutation.error.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {quickTrainMutation.isSuccess && quickTrainMutation.data && (
            <div className="space-y-6">
              {/* Best Model Info */}
              <Card className="border-green-500/20 bg-green-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    Лучшая модель:{" "}
                    {quickTrainMutation.data.savedModel.modelType}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Точность направления
                      </p>
                      <p className="font-bold text-2xl">
                        {(
                          quickTrainMutation.data.savedModel.accuracy * 100
                        ).toFixed(1)}
                        %
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">
                        Тип модели
                      </p>
                      <p className="font-semibold text-lg">
                        {quickTrainMutation.data.savedModel.modelType}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-sm">Статус</p>
                      <p className="font-semibold text-green-500 text-lg">
                        Готова к использованию
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Model Comparison */}
              <ModelComparisonCard
                comparison={quickTrainMutation.data.comparison}
              />
            </div>
          )}

          {(() => {
            if (quickTrainMutation.isPending) return null;
            if (quickTrainMutation.isSuccess) return null;
            if (quickTrainMutation.isError) return null;

            return (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <Brain className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-lg">
                        Результаты обучения появятся здесь
                      </p>
                      <p className="mt-2 text-muted-foreground text-sm">
                        Используйте форму выше для быстрого обучения модели
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        <TabsContent className="space-y-6" value="evaluate">
          {runBacktestMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-muted-foreground">
                    Running backtest... This may take a few minutes.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {runBacktestMutation.isError && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-red-400">
                    Error: {runBacktestMutation.error.message}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {runBacktestMutation.isSuccess && runBacktestMutation.data && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  Symbol: {runBacktestMutation.data.config.symbol}
                </span>
                <Button
                  disabled={saveModelMutation.isPending}
                  onClick={() => {
                    const result = runBacktestMutation.data;
                    if (!result) return;

                    saveModelMutation.mutate({
                      symbol: result.config.symbol,
                      modelType: result.config.modelType,
                      config: {
                        hiddenSize: 32,
                        sequenceLength: 20,
                        learningRate: 0.001,
                        epochs: 100,
                      },
                      metrics: result.metrics,
                    });
                  }}
                  variant="default"
                >
                  {saveModelMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Model
                    </>
                  )}
                </Button>
              </div>
              <MLBacktestResults result={runBacktestMutation.data} />
            </div>
          )}

          {!(
            runBacktestMutation.isPending ||
            runBacktestMutation.isSuccess ||
            runBacktestMutation.isError
          ) && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <p>Configure and run a backtest to see results</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent className="space-y-6" value="train">
          {!runOptimizationMutation.isSuccess && (
            <HPOConfigForm
              isLoading={runOptimizationMutation.isPending}
              onSubmit={(config) => {
                const endDate = Date.now();
                const startDate = endDate - config.days * 24 * 60 * 60 * 1000;

                runOptimizationMutation.mutate({
                  symbol: config.symbol,
                  modelType: config.modelType,
                  horizon: config.horizon,
                  method: config.method,
                  nTrials: config.nTrials,
                  startDate,
                  endDate,
                  optimizationMetric: config.optimizationMetric,
                  hyperparameterSpace: config.hyperparameterSpace,
                  includeSentiment: config.includeSentiment,
                });
              }}
            />
          )}

          {runOptimizationMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-muted-foreground">
                    Running hyperparameter optimization... This may take 20-40
                    minutes depending on the number of trials.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Each trial includes full backtesting with walk-forward
                    testing
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {runOptimizationMutation.isError && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-red-400">
                    Error: {runOptimizationMutation.error.message}
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => runOptimizationMutation.reset()}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {runOptimizationMutation.isSuccess &&
            runOptimizationMutation.data && (
              <>
                <div className="flex justify-end">
                  <Button
                    onClick={() => runOptimizationMutation.reset()}
                    variant="outline"
                  >
                    Run New Optimization
                  </Button>
                </div>
                <HPOOptimizationResults result={runOptimizationMutation.data} />
              </>
            )}

          {!(
            runOptimizationMutation.isPending ||
            runOptimizationMutation.isSuccess ||
            runOptimizationMutation.isError
          ) && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <p>Configure and start hyperparameter optimization</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent className="space-y-6" value="models">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowCleanupDialog(true)}
              variant="outline"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Cleanup Old Models
            </Button>
          </div>
          <ModelListCard />
        </TabsContent>
      </Tabs>

      {/* Model Cleanup Dialog */}
      <ModelCleanupDialog
        onClose={() => setShowCleanupDialog(false)}
        open={showCleanupDialog}
      />
    </>
  );
}

export function BacktestContent() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const backtest = useBacktest();

  const handleSubmit = (params: BacktestParams) => {
    backtest.mutate(params, {
      onSuccess: (data) => {
        setResult(data);
      },
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Configuration Form */}
      <div className="lg:col-span-1">
        <BacktestForm isLoading={backtest.isPending} onSubmit={handleSubmit} />

        {/* Error Display */}
        {backtest.isError && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {backtest.error instanceof Error
                ? backtest.error.message
                : "Failed to run backtest"}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Results Display */}
      <div className="lg:col-span-2">
        {backtest.isPending && (
          <div className="flex h-64 items-center justify-center">
            <div className="space-y-2 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
              <p className="text-muted-foreground text-sm">
                Running backtest...
              </p>
            </div>
          </div>
        )}

        {result && !backtest.isPending && <BacktestResults result={result} />}

        {!(result || backtest.isPending) && (
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-border border-dashed">
            <div className="space-y-2 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                Configure and run a backtest to see results
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
