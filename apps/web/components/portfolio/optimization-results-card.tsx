/**
 * Portfolio Optimization Results Card
 * Displays optimized weights, metrics, and efficient frontier
 */

import { BarChart2, Loader2, PieChart, TrendingUp } from "lucide-react";
import type { OptimizedPortfolio } from "../../lib/api/portfolio";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

type OptimizationResultsCardProps = {
  result: OptimizedPortfolio;
  isLoading?: boolean;
};

const PERCENTAGE_MULTIPLIER = 100;

export function OptimizationResultsCard({
  result,
  isLoading = false,
}: OptimizationResultsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  const sortedWeights = Object.entries(result.weights)
    .sort(([, a], [, b]) => b - a)
    .filter(([, weight]) => Math.abs(weight) > 0.001);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Optimization Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs className="w-full" defaultValue="weights">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weights">
              <PieChart className="mr-2 h-4 w-4" />
              Weights
            </TabsTrigger>
            <TabsTrigger value="metrics">
              <BarChart2 className="mr-2 h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="frontier">
              <TrendingUp className="mr-2 h-4 w-4" />
              Frontier
            </TabsTrigger>
          </TabsList>

          {/* Weights Tab */}
          <TabsContent className="space-y-4" value="weights">
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
              <h3 className="mb-2 font-semibold text-sm">
                Portfolio Composition
              </h3>
              <div className="space-y-3">
                {sortedWeights.map(([asset, weight]) => (
                  <div className="space-y-1" key={asset}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium font-mono text-sm">
                        {asset}
                      </span>
                      <Badge variant={weight < 0 ? "destructive" : "secondary"}>
                        {(weight * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                      </Badge>
                    </div>
                    <Progress
                      className="h-2"
                      value={Math.abs(weight) * PERCENTAGE_MULTIPLIER}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Allocation Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedWeights.map(([asset, weight]) => (
                  <TableRow key={asset}>
                    <TableCell className="font-medium font-mono">
                      {asset}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(weight * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={weight < 0 ? "destructive" : "secondary"}>
                        {weight < 0 ? "SHORT" : "LONG"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent className="space-y-4" value="metrics">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                <p className="mb-1 text-slate-400 text-sm">Expected Return</p>
                <p className="font-bold font-mono text-2xl text-green-400">
                  {(result.expectedReturn * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                </p>
                <p className="mt-1 text-slate-400 text-xs">Annual return</p>
              </div>

              <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
                <p className="mb-1 text-slate-400 text-sm">Expected Risk</p>
                <p className="font-bold font-mono text-2xl text-orange-400">
                  {(result.expectedRisk * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                </p>
                <p className="mt-1 text-slate-400 text-xs">Annual volatility</p>
              </div>

              <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
                <p className="mb-1 text-slate-400 text-sm">Sharpe Ratio</p>
                <p className="font-bold font-mono text-2xl text-blue-400">
                  {result.sharpeRatio.toFixed(2)}
                </p>
                <p className="mt-1 text-slate-400 text-xs">
                  Risk-adjusted return
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-3 font-semibold text-sm">Interpretation</h3>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  • <strong>Expected Return:</strong> Projected annual return
                  based on historical data
                </p>
                <p>
                  • <strong>Expected Risk:</strong> Portfolio volatility
                  (standard deviation of returns)
                </p>
                <p>
                  • <strong>Sharpe Ratio:</strong> Risk-adjusted performance
                  metric (higher is better)
                </p>
                {result.sharpeRatio > 1 && (
                  <p className="text-green-400">
                    ✓ Good risk-adjusted returns (Sharpe {">"} 1)
                  </p>
                )}
                {result.sharpeRatio <= 0 && (
                  <p className="text-red-400">
                    ⚠ Poor risk-adjusted returns (Sharpe {"<="} 0)
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Efficient Frontier Tab */}
          <TabsContent className="space-y-4" value="frontier">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <h3 className="mb-3 font-semibold text-sm">
                Efficient Frontier Points
              </h3>
              <p className="mb-4 text-slate-400 text-sm">
                Trade-off between risk and return for different portfolio
                allocations
              </p>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risk (%)</TableHead>
                      <TableHead>Return (%)</TableHead>
                      <TableHead className="text-right">Sharpe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.efficientFrontier.map((point, idx) => {
                      const sharpe = point.return / point.risk;
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">
                            {(point.risk * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                          </TableCell>
                          <TableCell className="font-mono">
                            {(point.return * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {sharpe.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
