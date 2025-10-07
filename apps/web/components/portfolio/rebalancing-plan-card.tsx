/**
 * Rebalancing Plan Card
 * Displays the analysis results and required actions
 */

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Info,
} from "lucide-react";
import type { RebalancingPlan } from "../../lib/api/portfolio";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type RebalancingPlanCardProps = {
  plan: RebalancingPlan;
};

const PERCENTAGE_MULTIPLIER = 100;

function getDeltaColor(deltaValue: number): string {
  if (deltaValue > 0) return "text-green-400";
  if (deltaValue < 0) return "text-red-400";
  return "text-slate-400";
}

function getActionIcon(action: "buy" | "sell" | "hold") {
  switch (action) {
    case "buy":
      return <ArrowUp className="h-4 w-4 text-green-400" />;
    case "sell":
      return <ArrowDown className="h-4 w-4 text-red-400" />;
    default:
      return <ArrowRight className="h-4 w-4 text-slate-400" />;
  }
}

function getPriorityBadge(priority: "low" | "medium" | "high") {
  const variants = {
    low: "secondary" as const,
    medium: "default" as const,
    high: "destructive" as const,
  };
  return <Badge variant={variants[priority]}>{priority.toUpperCase()}</Badge>;
}

export function RebalancingPlanCard({ plan }: RebalancingPlanCardProps) {
  if (!plan.needsRebalancing) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
              <Info className="size-8 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No Rebalancing Needed</h3>
              <p className="text-slate-400 text-sm">{plan.reason}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const buyActions = plan.actions.filter((a) => a.action === "buy");
  const sellActions = plan.actions.filter((a) => a.action === "sell");

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Rebalancing Summary</CardTitle>
            {getPriorityBadge(plan.priority)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
              <p className="text-blue-400 text-sm">{plan.reason}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-slate-400 text-xs">Total Transaction Cost</p>
                <p className="font-mono font-semibold text-lg">
                  ${plan.totalTransactionCost.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-slate-400 text-xs">Estimated Slippage</p>
                <p className="font-mono font-semibold text-lg">
                  {(plan.estimatedSlippage * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-slate-400 text-xs">Net Benefit</p>
                <p
                  className={`font-mono font-semibold text-lg ${
                    plan.netBenefit > 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {(plan.netBenefit * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Required Actions ({plan.actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan.actions.length === 0 ? (
            <p className="py-4 text-center text-slate-400 text-sm">
              No actions required
            </p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.actions.map((action) => (
                    <TableRow key={action.symbol}>
                      <TableCell className="font-medium font-mono">
                        {action.symbol}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(action.action)}
                          <span className="capitalize">{action.action}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(action.currentWeight * PERCENTAGE_MULTIPLIER).toFixed(
                          1
                        )}
                        %
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(action.targetWeight * PERCENTAGE_MULTIPLIER).toFixed(
                          1
                        )}
                        %
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-sm ${getDeltaColor(action.deltaValue)}`}
                          >
                            ${Math.abs(action.deltaValue).toFixed(2)}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {Math.abs(action.deltaQuantity).toFixed(4)} units
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        ${action.estimatedCost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary Stats */}
          {plan.actions.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3">
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-4 w-4 text-green-400" />
                  <span className="text-green-400 text-sm">Buy Orders</span>
                </div>
                <p className="mt-1 font-mono font-semibold text-lg">
                  {buyActions.length} assets
                </p>
                <p className="text-slate-400 text-xs">
                  Total: $
                  {buyActions
                    .reduce((sum, a) => sum + Math.abs(a.deltaValue), 0)
                    .toFixed(2)}
                </p>
              </div>

              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
                <div className="flex items-center gap-2">
                  <ArrowDown className="h-4 w-4 text-red-400" />
                  <span className="text-red-400 text-sm">Sell Orders</span>
                </div>
                <p className="mt-1 font-mono font-semibold text-lg">
                  {sellActions.length} assets
                </p>
                <p className="text-slate-400 text-xs">
                  Total: $
                  {sellActions
                    .reduce((sum, a) => sum + Math.abs(a.deltaValue), 0)
                    .toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          {plan.netBenefit < 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="font-semibold text-sm text-yellow-400">
                  Caution: Negative Net Benefit
                </p>
                <p className="text-xs text-yellow-400">
                  Transaction costs may outweigh the benefits of rebalancing at
                  this time.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
