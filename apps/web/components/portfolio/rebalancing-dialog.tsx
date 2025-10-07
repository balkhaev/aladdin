/**
 * Portfolio Rebalancing Dialog
 * Configure and analyze portfolio rebalancing
 */

import { Loader2, Scale } from "lucide-react";
import { useState } from "react";
import {
  useAnalyzeRebalancing,
  useExecuteRebalancing,
} from "../../hooks/use-portfolio-rebalancing";
import type { RebalancingPlan } from "../../lib/api/portfolio";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { RebalancingPlanCard } from "./rebalancing-plan-card";

type RebalancingDialogProps = {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  currentPositions: Array<{ symbol: string; value: number }>;
};

export function RebalancingDialog({
  open,
  onClose,
  portfolioId,
  currentPositions,
}: RebalancingDialogProps) {
  const [step, setStep] = useState<"config" | "plan">("config");
  const [plan, setPlan] = useState<RebalancingPlan | null>(null);

  // Form state - target weights
  const totalValue = currentPositions.reduce((sum, pos) => sum + pos.value, 0);
  const [targetWeights, setTargetWeights] = useState<Record<string, number>>(
    () => {
      const weights: Record<string, number> = {};
      for (const pos of currentPositions) {
        weights[pos.symbol] = Number(
          ((pos.value / totalValue) * 100).toFixed(2)
        );
      }
      return weights;
    }
  );

  // Config state
  const [strategy, setStrategy] = useState<
    "periodic" | "threshold" | "opportunistic" | "hybrid"
  >("threshold");
  const [frequency, setFrequency] = useState<
    "daily" | "weekly" | "monthly" | "quarterly"
  >("monthly");
  const [thresholdPercent, setThresholdPercent] = useState(5);
  const [minTradeSize, setMinTradeSize] = useState(100);
  const [maxTransactionCost, setMaxTransactionCost] = useState(50);
  const [allowPartialRebalance, setAllowPartialRebalance] = useState(true);

  const analyzeMutation = useAnalyzeRebalancing();
  const executeMutation = useExecuteRebalancing();

  const handleAnalyze = async () => {
    // Convert percentages to decimals
    const weights: Record<string, number> = {};
    for (const [symbol, percent] of Object.entries(targetWeights)) {
      weights[symbol] = percent / 100;
    }

    const result = await analyzeMutation.mutateAsync({
      portfolioId,
      targetWeights: weights,
      config: {
        strategy,
        frequency: strategy === "periodic" ? frequency : undefined,
        thresholdPercent:
          strategy === "threshold" ? thresholdPercent / 100 : undefined,
        minTradeSize,
        maxTransactionCost,
        allowPartialRebalance,
      },
    });

    setPlan(result);
    setStep("plan");
  };

  const handleExecute = async (dryRun: boolean) => {
    if (!plan) return;

    await executeMutation.mutateAsync({
      portfolioId,
      plan,
      dryRun,
    });

    if (!dryRun) {
      onClose();
    }
  };

  const handleBack = () => {
    setStep("config");
    setPlan(null);
  };

  const handleClose = () => {
    setStep("config");
    setPlan(null);
    onClose();
  };

  return (
    <Dialog onOpenChange={handleClose} open={open}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Portfolio Rebalancing
          </DialogTitle>
          <DialogDescription>
            {step === "config"
              ? "Configure target weights and rebalancing strategy"
              : "Review rebalancing plan and execute"}
          </DialogDescription>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-6">
            {/* Target Weights */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Target Weights (%)</h3>
              <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                {currentPositions.map((pos) => (
                  <div className="flex items-center gap-3" key={pos.symbol}>
                    <Label
                      className="w-32 font-mono text-sm"
                      htmlFor={pos.symbol}
                    >
                      {pos.symbol}
                    </Label>
                    <Input
                      className="flex-1"
                      id={pos.symbol}
                      max={100}
                      min={0}
                      onChange={(e) =>
                        setTargetWeights({
                          ...targetWeights,
                          [pos.symbol]: Number.parseFloat(e.target.value),
                        })
                      }
                      step={0.1}
                      type="number"
                      value={targetWeights[pos.symbol]}
                    />
                    <span className="w-12 text-right text-slate-400 text-xs">
                      {((pos.value / totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-slate-400 text-xs">
                Total:{" "}
                {Object.values(targetWeights)
                  .reduce((sum, w) => sum + w, 0)
                  .toFixed(1)}
                % (should be 100%)
              </p>
            </div>

            {/* Strategy */}
            <div className="space-y-2">
              <Label htmlFor="strategy">Rebalancing Strategy</Label>
              <Select
                onValueChange={(v) =>
                  setStrategy(
                    v as "periodic" | "threshold" | "opportunistic" | "hybrid"
                  )
                }
                value={strategy}
              >
                <SelectTrigger id="strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="periodic">
                    Periodic (Calendar-based)
                  </SelectItem>
                  <SelectItem value="threshold">
                    Threshold (Drift-based)
                  </SelectItem>
                  <SelectItem value="opportunistic">
                    Opportunistic (Market conditions)
                  </SelectItem>
                  <SelectItem value="hybrid">Hybrid (Combined)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frequency (for periodic) */}
            {strategy === "periodic" && (
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  onValueChange={(v) =>
                    setFrequency(
                      v as "daily" | "weekly" | "monthly" | "quarterly"
                    )
                  }
                  value={frequency}
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Threshold (for threshold strategy) */}
            {(strategy === "threshold" || strategy === "hybrid") && (
              <div className="space-y-2">
                <Label htmlFor="threshold">Threshold (%)</Label>
                <Input
                  id="threshold"
                  max={50}
                  min={1}
                  onChange={(e) =>
                    setThresholdPercent(Number.parseFloat(e.target.value))
                  }
                  step={0.5}
                  type="number"
                  value={thresholdPercent}
                />
                <p className="text-slate-400 text-xs">
                  Rebalance when any asset drifts more than this % from target
                </p>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Advanced Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="minTradeSize">Min Trade Size ($)</Label>
                  <Input
                    id="minTradeSize"
                    min={0}
                    onChange={(e) =>
                      setMinTradeSize(Number.parseFloat(e.target.value))
                    }
                    step={10}
                    type="number"
                    value={minTradeSize}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxCost">Max Transaction Cost ($)</Label>
                  <Input
                    id="maxCost"
                    min={0}
                    onChange={(e) =>
                      setMaxTransactionCost(Number.parseFloat(e.target.value))
                    }
                    step={5}
                    type="number"
                    value={maxTransactionCost}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <div>
                  <Label htmlFor="partial">Allow Partial Rebalance</Label>
                  <p className="text-slate-400 text-xs">
                    Execute only trades above minimum size
                  </p>
                </div>
                <Switch
                  checked={allowPartialRebalance}
                  id="partial"
                  onCheckedChange={setAllowPartialRebalance}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button onClick={handleClose} type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={analyzeMutation.isPending}
                onClick={handleAnalyze}
                type="button"
              >
                {analyzeMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Analyze Rebalancing
              </Button>
            </div>
          </div>
        )}

        {step === "plan" && plan && (
          <div className="space-y-4">
            <RebalancingPlanCard plan={plan} />

            <div className="flex justify-between gap-3 pt-4">
              <Button onClick={handleBack} type="button" variant="ghost">
                Back to Config
              </Button>
              <div className="flex gap-3">
                <Button
                  disabled={executeMutation.isPending || !plan.needsRebalancing}
                  onClick={() => handleExecute(true)}
                  type="button"
                  variant="outline"
                >
                  {executeMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Simulate
                </Button>
                <Button
                  disabled={executeMutation.isPending || !plan.needsRebalancing}
                  onClick={() => handleExecute(false)}
                  type="button"
                >
                  {executeMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Execute Rebalancing
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
