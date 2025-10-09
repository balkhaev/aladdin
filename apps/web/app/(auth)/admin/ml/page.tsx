"use client";

import {
  AlertTriangle,
  Brain,
  GitMerge,
  Layers,
  Settings2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnomalyDetectionConfig } from "@/components/ml/admin/anomaly-detection-config";
import { AnomalyResultsTable } from "@/components/ml/admin/anomaly-results-table";
import { BatchPredictionsForm } from "@/components/ml/admin/batch-predictions-form";
import { BatchResultsTable } from "@/components/ml/admin/batch-results-table";
import { EnsembleConfigForm } from "@/components/ml/admin/ensemble-config-form";
import { EnsembleResultsCard } from "@/components/ml/admin/ensemble-results-card";
import { TrainingForm } from "@/components/ml/admin/training-form";
import { HPOConfigForm } from "@/components/ml/hpo-config-form";
import { HPOOptimizationResults } from "@/components/ml/hpo-optimization-results";
import { ModelCleanupDialog } from "@/components/ml/model-cleanup-dialog";
import { ModelListCard } from "@/components/ml/model-list-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRunOptimization } from "@/hooks/use-hpo";
import type {
  AnomalyDetectionResult,
  BatchPredictionResult,
  EnsemblePredictionResult,
  OptimizationResult,
} from "@/lib/api/ml";
import { authClient } from "@/lib/auth-client";
import type { User } from "@/types/user";

export default function AdminMLPage() {
  const { data: session } = authClient.useSession();
  const sessionUser = session?.user as unknown as User;

  const [optimizationResult, setOptimizationResult] =
    useState<OptimizationResult | null>(null);
  const [anomalyResults, setAnomalyResults] =
    useState<AnomalyDetectionResult | null>(null);
  const [batchResults, setBatchResults] =
    useState<BatchPredictionResult | null>(null);
  const [ensembleResults, setEnsembleResults] =
    useState<EnsemblePredictionResult | null>(null);

  const runOptimization = useRunOptimization();

  // Check admin access
  if (sessionUser?.role !== "admin") {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Доступ запрещен
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              У вас нет прав для доступа к этой странице. Требуются права
              администратора.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Brain className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-2xl">ML Модели</h1>
          <p className="text-muted-foreground text-sm">
            Управление машинным обучением
          </p>
        </div>
      </div>

      <Alert>
        <Brain className="size-4" />
        <AlertTitle>Панель управления ML</AlertTitle>
        <AlertDescription>
          Обучайте модели, оптимизируйте гиперпараметры, детектируйте аномалии и
          комбинируйте предсказания нескольких моделей.
        </AlertDescription>
      </Alert>

      <Tabs className="flex-1" defaultValue="training">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger className="text-xs" value="training">
            <Zap className="mr-1 size-3" />
            Обучение
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="hpo">
            <Settings2 className="mr-1 size-3" />
            HPO
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="models">
            <Brain className="mr-1 size-3" />
            Модели
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="anomalies">
            <AlertTriangle className="mr-1 size-3" />
            Аномалии
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="batch">
            <Layers className="mr-1 size-3" />
            Batch
          </TabsTrigger>
          <TabsTrigger className="text-xs" value="ensemble">
            <GitMerge className="mr-1 size-3" />
            Ensemble
          </TabsTrigger>
        </TabsList>

        {/* Training Tab */}
        <TabsContent className="space-y-4" value="training">
          <TrainingForm
            onSuccess={() => {
              toast.success("Модель обучена успешно!");
            }}
          />
        </TabsContent>

        {/* HPO Tab */}
        <TabsContent className="space-y-4" value="hpo">
          <div className="grid grid-cols-2 gap-4">
            <HPOConfigForm
              onOptimize={(config) => {
                runOptimization.mutate(config, {
                  onSuccess: (result) => {
                    setOptimizationResult(result);
                    toast.success("Оптимизация завершена!");
                  },
                });
              }}
            />
            {optimizationResult && (
              <HPOOptimizationResults result={optimizationResult} />
            )}
          </div>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent className="space-y-4" value="models">
          <div className="grid grid-cols-2 gap-4">
            <ModelListCard />
            <ModelCleanupDialog />
          </div>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent className="space-y-4" value="anomalies">
          <div className="grid grid-cols-2 gap-4">
            <AnomalyDetectionConfig
              onResults={(results) => {
                setAnomalyResults(results);
              }}
            />
            {anomalyResults && <AnomalyResultsTable results={anomalyResults} />}
          </div>
        </TabsContent>

        {/* Batch Predictions Tab */}
        <TabsContent className="space-y-4" value="batch">
          <div className="space-y-4">
            <BatchPredictionsForm
              onResults={(results) => {
                setBatchResults(results);
              }}
            />
            {batchResults && <BatchResultsTable results={batchResults} />}
          </div>
        </TabsContent>

        {/* Ensemble Predictions Tab */}
        <TabsContent className="space-y-4" value="ensemble">
          <div className="grid grid-cols-2 gap-4">
            <EnsembleConfigForm
              onResults={(results) => {
                setEnsembleResults(results);
              }}
            />
            {ensembleResults && (
              <EnsembleResultsCard results={ensembleResults} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
