/**
 * Machine Learning Page
 * Backtesting and Model Comparison
 */

import { createFileRoute } from "@tanstack/react-router";
import { Calendar, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HPOConfigForm } from "../components/ml/hpo-config-form";
import { HPOOptimizationResults } from "../components/ml/hpo-optimization-results";
import { MLBacktestResults } from "../components/ml/ml-backtest-results";
import { ModelCleanupDialog } from "../components/ml/model-cleanup-dialog";
import { ModelComparisonCard } from "../components/ml/model-comparison-card";
import { ModelListCard } from "../components/ml/model-list-card";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useRunOptimization } from "../hooks/use-hpo";
import { useCompareModels, useRunBacktest } from "../hooks/use-ml-backtest";
import { useSaveModel } from "../hooks/use-save-model";
import type { ModelType, PredictionHorizon } from "../lib/api/ml";

export const Route = createFileRoute("/_auth/ml")({
  component: MachineLearningPage,
});

function MachineLearningPage() {
  // Form state
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [horizon, setHorizon] = useState<PredictionHorizon>("1h");
  const [modelType, setModelType] = useState<ModelType>("LSTM");
  const [walkForward, setWalkForward] = useState(true);
  const [retrainInterval, setRetrainInterval] = useState(30);
  const [days, setDays] = useState(30);
  const [includeSentiment, setIncludeSentiment] = useState(true);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  // Mutations
  const runBacktestMutation = useRunBacktest();
  const compareModelsMutation = useCompareModels();
  const runOptimizationMutation = useRunOptimization();
  const saveModelMutation = useSaveModel();

  // Handle run backtest
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

  // Handle compare models
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

  // Show success notification when model is saved
  useEffect(() => {
    if (saveModelMutation.isSuccess) {
      toast.success("Model Saved Successfully", {
        description: "Model has been saved and is ready for production use",
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [saveModelMutation.isSuccess]);

  // Show success notification when comparison completes
  useEffect(() => {
    if (compareModelsMutation.isSuccess) {
      toast.success("Models Trained Successfully", {
        description: "Both LSTM and Hybrid models have been saved",
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [compareModelsMutation.isSuccess]);

  // Show success notification when HPO completes
  useEffect(() => {
    if (runOptimizationMutation.isSuccess) {
      toast.success("Model Optimized Successfully", {
        description: `Optimized model for ${symbol} has been saved with best hyperparameters`,
        icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      });
    }
  }, [runOptimizationMutation.isSuccess, symbol]);

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-bold text-3xl">Machine Learning</h1>
        <p className="mt-1 text-slate-400">
          Train, test, and deploy ML models for price prediction
        </p>
      </div>

      {/* Status Stepper */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {/* Step 1: Train with HPO */}
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold ${
                  runOptimizationMutation.isSuccess
                    ? "border-green-500 bg-green-500/20 text-green-500"
                    : "border-purple-500 bg-purple-500/20 text-purple-500"
                }`}
              >
                {runOptimizationMutation.isSuccess ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  "1"
                )}
              </div>
              <span className="text-center font-medium text-sm">Train</span>
              <span className="text-center text-muted-foreground text-xs">
                HPO (auto-save)
              </span>
            </div>

            <div className="h-0.5 w-full flex-1 bg-border" />

            {/* Step 2: Evaluate & Save */}
            <div className="flex flex-1 flex-col items-center">
              <div
                className={(() => {
                  if (saveModelMutation.isSuccess) {
                    return "mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/20 font-semibold text-green-500";
                  }
                  if (runBacktestMutation.isSuccess) {
                    return "mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-yellow-500 bg-yellow-500/20 font-semibold text-yellow-500";
                  }
                  return "mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-muted font-semibold text-muted-foreground";
                })()}
              >
                {saveModelMutation.isSuccess ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  "2"
                )}
              </div>
              <span className="text-center font-medium text-sm">Evaluate</span>
              <span className="text-center text-muted-foreground text-xs">
                Test & Save
              </span>
            </div>

            <div className="h-0.5 w-full flex-1 bg-border" />

            {/* Step 3: Production Ready */}
            <div className="flex flex-1 flex-col items-center">
              <div
                className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold ${
                  saveModelMutation.isSuccess ||
                  runOptimizationMutation.isSuccess
                    ? "border-green-500 bg-green-500/20 text-green-500"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {saveModelMutation.isSuccess ||
                runOptimizationMutation.isSuccess ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  "3"
                )}
              </div>
              <span className="text-center font-medium text-sm">
                Production
              </span>
              <span className="text-center text-muted-foreground text-xs">
                Use on /trading
              </span>
            </div>
          </div>

          {(saveModelMutation.isSuccess ||
            runOptimizationMutation.isSuccess) && (
            <div className="mt-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-center">
              <p className="font-medium text-green-500 text-sm">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                Model saved and ready for production
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Enable ML predictions on the /trading page
              </p>
            </div>
          )}

          {runBacktestMutation.isSuccess && !saveModelMutation.isSuccess && (
            <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-center">
              <p className="font-medium text-sm text-yellow-500">
                Backtest complete - Click "Save Model" to deploy
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Review results in the Evaluate tab
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Backtest Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Symbol */}
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                value={symbol}
              />
            </div>

            {/* Horizon */}
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

            {/* Model Type */}
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

            {/* Days */}
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

            {/* Include Sentiment */}
            <div className="flex flex-col justify-between">
              <Label htmlFor="includeSentiment">Include Sentiment</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={includeSentiment}
                  id="includeSentiment"
                  onCheckedChange={setIncludeSentiment}
                />
                <span className="text-slate-400 text-sm">
                  {includeSentiment ? "Using sentiment data" : "Technical only"}
                </span>
              </div>
            </div>

            {/* Walk-Forward */}
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

            {/* Retrain Interval */}
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

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              className="flex-1"
              disabled={runBacktestMutation.isPending}
              onClick={handleRunBacktest}
            >
              {runBacktestMutation.isPending ? (
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
              disabled={compareModelsMutation.isPending}
              onClick={handleCompareModels}
              variant="outline"
            >
              {compareModelsMutation.isPending ? (
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

      {/* Results */}
      <Tabs className="w-full" defaultValue="train">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="train">Train (HPO)</TabsTrigger>
          <TabsTrigger value="evaluate">Evaluate</TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="evaluate">
          {runBacktestMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-slate-400">
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
                        hiddenSize: result.config.hiddenSize || 32,
                        sequenceLength: result.config.sequenceLength || 20,
                        learningRate: result.config.learningRate || 0.001,
                        epochs: result.config.epochs || 100,
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
                <div className="text-center text-slate-400">
                  <p>Configure and run a backtest to see results</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent className="space-y-6" value="compare">
          {compareModelsMutation.isPending && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="text-slate-400">
                    Comparing models... This may take several minutes.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {compareModelsMutation.isError && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-red-400">
                    Error: {compareModelsMutation.error.message}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {compareModelsMutation.isSuccess && compareModelsMutation.data && (
            <>
              <ModelComparisonCard comparison={compareModelsMutation.data} />

              {/* Individual Results */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-4 font-semibold text-lg">LSTM Results</h3>
                  <MLBacktestResults result={compareModelsMutation.data.lstm} />
                </div>
                <div>
                  <h3 className="mb-4 font-semibold text-lg">Hybrid Results</h3>
                  <MLBacktestResults
                    result={compareModelsMutation.data.hybrid}
                  />
                </div>
              </div>
            </>
          )}

          {!(
            compareModelsMutation.isPending ||
            compareModelsMutation.isSuccess ||
            compareModelsMutation.isError
          ) && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-slate-400">
                  <p>Run model comparison to see results</p>
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
                  <p className="text-slate-400">
                    Running hyperparameter optimization... This may take 20-40
                    minutes depending on the number of trials.
                  </p>
                  <p className="text-slate-500 text-sm">
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
                <div className="text-center text-slate-400">
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
    </div>
  );
}
