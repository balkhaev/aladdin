/**
 * Stress Test Card Component
 * Стресс-тестирование портфеля в различных рыночных сценариях
 */

import { Activity, AlertTriangle, Play, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useStressTest, useStressTestScenarios } from "../hooks/use-risk";
import type { StressTestSummary } from "../lib/api/risk";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type RiskStressTestCardProps = {
  portfolioId: string;
};

const RESILIENCE_HIGH = 80;
const RESILIENCE_MEDIUM = 60;
const RESILIENCE_HIGH_MINUS_ONE = 79;
const MAX_PREVIEW_SCENARIOS = 3;

const getResilienceColor = (score: number) => {
  if (score >= RESILIENCE_HIGH) return "text-green-600";
  if (score >= RESILIENCE_MEDIUM) return "text-yellow-600";
  return "text-red-600";
};

const getResilienceLabel = (score: number) => {
  if (score >= RESILIENCE_HIGH) return "Высокая устойчивость";
  if (score >= RESILIENCE_MEDIUM) return "Средняя устойчивость";
  return "Низкая устойчивость";
};

export function RiskStressTestCard({ portfolioId }: RiskStressTestCardProps) {
  const [testResult, setTestResult] = useState<StressTestSummary | null>(null);
  const { data: scenarios, isLoading: loadingScenarios } =
    useStressTestScenarios();
  const stressTestMutation = useStressTest();

  const handleRunTest = async () => {
    try {
      const result = await stressTestMutation.mutateAsync({
        portfolioId,
        scenarios: undefined, // Use default scenarios
      });
      setTestResult(result);
    } catch (error) {
      console.error("Stress test failed:", error);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  if (loadingScenarios) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Стресс-тестирование
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Стресс-тестирование
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Анализ портфеля в экстремальных рыночных сценариях
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Run Test Button */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Доступно {scenarios?.length ?? 0} сценариев
          </p>
          <Button
            disabled={stressTestMutation.isPending}
            onClick={handleRunTest}
            size="sm"
          >
            {stressTestMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Тестирование...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Запустить тест
              </>
            )}
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <Tabs className="w-full" defaultValue="summary">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Сводка</TabsTrigger>
              <TabsTrigger value="scenarios">Сценарии</TabsTrigger>
              <TabsTrigger value="recommendations">Рекомендации</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent className="space-y-4" value="summary">
              {/* Resilience Score */}
              <div className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    Индекс устойчивости
                  </span>
                  <span
                    className={`font-bold text-2xl ${getResilienceColor(testResult.resilienceScore)}`}
                  >
                    {testResult.resilienceScore.toFixed(0)}
                  </span>
                </div>
                <Progress className="h-2" value={testResult.resilienceScore} />
                <p className="mt-2 text-muted-foreground text-xs">
                  {getResilienceLabel(testResult.resilienceScore)}
                </p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">
                    Средняя потеря
                  </p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(testResult.averageLoss)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatPercent(testResult.averageLossPercentage)}
                  </p>
                </div>

                <div className="space-y-1 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Худший случай</p>
                  <p className="font-semibold text-red-700">
                    {formatCurrency(testResult.worstCase.loss)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {testResult.worstCase.scenarioName}
                  </p>
                </div>
              </div>

              {/* Worst and Best Cases */}
              <div className="space-y-3">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-red-900 text-sm">
                        Худший сценарий
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {testResult.worstCase.scenarioName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700">
                        {formatPercent(testResult.worstCase.lossPercentage)}
                      </p>
                      <p className="text-muted-foreground text-xs">потеря</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-green-900 text-sm">
                        Лучший сценарий
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {testResult.bestCase.scenarioName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">
                        {formatPercent(
                          Math.abs(testResult.bestCase.lossPercentage)
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {testResult.bestCase.lossPercentage < 0
                          ? "прибыль"
                          : "потеря"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Scenarios Tab */}
            <TabsContent value="scenarios">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сценарий</TableHead>
                      <TableHead className="text-right">Потеря</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testResult.results
                      ?.sort((a, b) => b.loss - a.loss)
                      .map((result) => (
                        <TableRow key={result.scenarioName}>
                          <TableCell className="font-medium">
                            {result.scenarioName}
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              result.loss > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {formatCurrency(result.loss)}
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              result.lossPercentage > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            {formatPercent(result.lossPercentage)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent className="space-y-3" value="recommendations">
              {testResult.recommendations?.length > 0 ? (
                testResult.recommendations.map((recommendation, index) => (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3"
                    key={index}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    <p className="text-sm text-yellow-900">{recommendation}</p>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Портфель показывает хорошую устойчивость к стресс-сценариям
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Available Scenarios Info */}
        {!testResult && scenarios && scenarios.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-sm">Доступные сценарии:</p>
            <div className="space-y-2">
              {scenarios.slice(0, MAX_PREVIEW_SCENARIOS).map((scenario) => (
                <div
                  className="rounded-md border p-2 text-sm"
                  key={scenario.name}
                >
                  <p className="font-medium">{scenario.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {scenario.description}
                  </p>
                </div>
              ))}
              {scenarios.length > MAX_PREVIEW_SCENARIOS && (
                <p className="text-muted-foreground text-xs">
                  И ещё {scenarios.length - MAX_PREVIEW_SCENARIOS} сценариев...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-blue-600" />
            <div className="text-blue-800 text-xs">
              <p className="font-medium">Что такое стресс-тестирование?</p>
              <p className="mt-1">
                Стресс-тест показывает, как портфель поведет себя в
                экстремальных рыночных условиях: крах, рецессия, регуляторные
                изменения и т.д.
              </p>
              <p className="mt-1">
                <strong>Индекс устойчивости:</strong>
                <br />• {RESILIENCE_HIGH}-100: отличная защита от стресса
                <br />• {RESILIENCE_MEDIUM}-{RESILIENCE_HIGH_MINUS_ONE}:
                умеренная устойчивость
                <br />• {"<"}
                {RESILIENCE_MEDIUM}: высокая уязвимость
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
