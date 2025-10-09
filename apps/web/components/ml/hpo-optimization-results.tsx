/**
 * HPO Optimization Results
 * Main component for displaying HPO results
 */

import { Clock, Zap } from "lucide-react";
import type { OptimizationResult } from "../../lib/api/ml";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { HPOBestParamsCard } from "./hpo-best-params-card";
import { HPOExportMenu } from "./hpo-export-menu";
import { HPOImprovementChart } from "./hpo-improvement-chart";
import { HPOTrialsTable } from "./hpo-trials-table";

type HPOOptimizationResultsProps = {
  result: OptimizationResult;
};

export function HPOOptimizationResults({
  result,
}: HPOOptimizationResultsProps) {
  const { method, trials, optimizationMetric, totalTrials, completedAt } =
    result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Optimization Results</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-normal text-slate-400 text-sm">
                <Clock className="h-4 w-4" />
                {new Date(completedAt).toLocaleTimeString("ru-RU")}
              </div>
              <HPOExportMenu result={result} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {/* Method */}
            <InfoItem
              icon={<Zap className="h-4 w-4" />}
              label="Method"
              value={method === "GRID" ? "Grid Search" : "Random Search"}
            />

            {/* Trials */}
            <InfoItem
              icon={<Zap className="h-4 w-4" />}
              label="Trials"
              value={`${trials.length} / ${totalTrials}`}
            />

            {/* Metric */}
            <InfoItem
              icon={<Zap className="h-4 w-4" />}
              label="Metric"
              value={optimizationMetric.replace("_", " ").toUpperCase()}
            />
          </div>

          {/* Method Info */}
          <div className="mt-4 rounded border border-blue-500/20 bg-blue-500/10 p-3">
            <div className="text-sm">
              <span className="font-medium text-blue-400">
                {method === "GRID" ? "Grid Search:" : "Random Search:"}
              </span>{" "}
              <span className="text-slate-300">
                {method === "GRID"
                  ? "Exhaustive search tested all parameter combinations"
                  : `Tested ${totalTrials} random parameter combinations`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Parameters Card */}
      <HPOBestParamsCard result={result} />

      {/* Charts and Table */}
      <Tabs className="w-full" defaultValue="chart">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chart">Progress Chart</TabsTrigger>
          <TabsTrigger value="trials">All Trials</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <HPOImprovementChart result={result} />
        </TabsContent>

        <TabsContent value="trials">
          <HPOTrialsTable result={result} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-slate-400 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}
