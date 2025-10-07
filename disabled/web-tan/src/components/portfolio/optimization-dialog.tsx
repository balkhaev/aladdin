/**
 * Portfolio Optimization Dialog
 * Configure and run portfolio optimization
 */

import { Loader2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useOptimizePortfolio } from "../../hooks/use-portfolio-optimization";
import type {
  OptimizationConstraints,
  OptimizedPortfolio,
} from "../../lib/api/portfolio";
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
import { Switch } from "../ui/switch";

type OptimizationDialogProps = {
  open: boolean;
  onClose: () => void;
  portfolioId: string;
  availableAssets: string[];
  onOptimized: (result: OptimizedPortfolio) => void;
};

export function OptimizationDialog({
  open,
  onClose,
  portfolioId,
  availableAssets,
  onOptimized,
}: OptimizationDialogProps) {
  // Form state
  const [selectedAssets, setSelectedAssets] = useState<string[]>(
    availableAssets.slice(0, 5)
  );
  const [days, setDays] = useState(60);
  const [constraints, setConstraints] = useState<OptimizationConstraints>({
    minWeight: 0.05,
    maxWeight: 0.4,
    allowShorts: false,
  });

  const optimizeMutation = useOptimizePortfolio();

  const handleOptimize = async () => {
    const result = await optimizeMutation.mutateAsync({
      portfolioId,
      assets: selectedAssets,
      days,
      constraints,
    });

    onOptimized(result);
    onClose();
  };

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Optimize Portfolio
          </DialogTitle>
          <DialogDescription>
            Find optimal asset weights using Mean-Variance Optimization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Assets Selection */}
          <div className="space-y-2">
            <Label>Assets to Optimize</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              {availableAssets.map((asset) => (
                <label
                  className="flex cursor-pointer items-center gap-2"
                  key={asset}
                >
                  <input
                    checked={selectedAssets.includes(asset)}
                    className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAssets([...selectedAssets, asset]);
                      } else {
                        setSelectedAssets(
                          selectedAssets.filter((a) => a !== asset)
                        );
                      }
                    }}
                    type="checkbox"
                  />
                  <span className="font-mono text-sm">{asset}</span>
                </label>
              ))}
            </div>
            <p className="text-slate-400 text-xs">
              Selected: {selectedAssets.length} assets (minimum 2 required)
            </p>
          </div>

          {/* Historical Days */}
          <div className="space-y-2">
            <Label htmlFor="days">Historical Days</Label>
            <Input
              id="days"
              max={365}
              min={7}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
              type="number"
              value={days}
            />
            <p className="text-slate-400 text-xs">
              Number of days to use for historical returns
            </p>
          </div>

          {/* Constraints */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Constraints</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="minWeight">Min Weight (%)</Label>
                <Input
                  id="minWeight"
                  max={50}
                  min={0}
                  onChange={(e) =>
                    setConstraints({
                      ...constraints,
                      minWeight: Number.parseFloat(e.target.value) / 100,
                    })
                  }
                  step={1}
                  type="number"
                  value={((constraints.minWeight ?? 0) * 100).toString()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxWeight">Max Weight (%)</Label>
                <Input
                  id="maxWeight"
                  max={100}
                  min={0}
                  onChange={(e) =>
                    setConstraints({
                      ...constraints,
                      maxWeight: Number.parseFloat(e.target.value) / 100,
                    })
                  }
                  step={1}
                  type="number"
                  value={((constraints.maxWeight ?? 100) * 100).toString()}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <div>
                <Label htmlFor="allowShorts">Allow Short Positions</Label>
                <p className="text-slate-400 text-xs">
                  Enable negative weights (short selling)
                </p>
              </div>
              <Switch
                checked={constraints.allowShorts ?? false}
                id="allowShorts"
                onCheckedChange={(checked) =>
                  setConstraints({ ...constraints, allowShorts: checked })
                }
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button onClick={onClose} type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={optimizeMutation.isPending || selectedAssets.length < 2}
              onClick={handleOptimize}
              type="button"
            >
              {optimizeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Optimize Portfolio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
