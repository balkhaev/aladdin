/**
 * Model Stats Dialog
 * Displays detailed statistics for a trained model
 */

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { useModelStats } from "../../hooks/use-ml-models";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Progress } from "../ui/progress";

type ModelStatsDialogProps = {
  symbol: string;
  open: boolean;
  onClose: () => void;
};

const PERCENTAGE_MULTIPLIER = 100;

export function ModelStatsDialog({
  symbol,
  open,
  onClose,
}: ModelStatsDialogProps) {
  const { data: stats, isLoading, error } = useModelStats(symbol, open);

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Model Statistics - {symbol}
          </DialogTitle>
          <DialogDescription>
            Detailed performance metrics and information
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>Error: {error.message}</span>
          </div>
        )}

        {stats && (
          <div className="space-y-6">
            {/* Model Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Model Type</p>
                <Badge className="mt-1" variant="outline">
                  {stats.modelType}
                </Badge>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Version</p>
                <p className="mt-1 font-mono text-sm">{stats.version}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Trained</p>
                <p className="mt-1 text-sm">
                  {formatDistanceToNow(stats.trainedAt, { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Training Duration</p>
                <p className="mt-1 text-sm">
                  {(stats.trainingDuration / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-400 text-sm">Data Points</p>
                <p className="mt-1 font-mono text-sm">
                  {stats.dataPoints.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Performance Metrics</h3>

              {/* Accuracy */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">Model Accuracy</span>
                  <span className="font-mono text-sm">
                    {(stats.accuracy * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                  </span>
                </div>
                <Progress value={stats.accuracy * PERCENTAGE_MULTIPLIER} />
              </div>

              {/* Directional Accuracy */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">Directional Accuracy</span>
                  <span className="font-mono text-sm">
                    {(
                      stats.directionalAccuracy * PERCENTAGE_MULTIPLIER
                    ).toFixed(2)}
                    %
                  </span>
                </div>
                <Progress
                  value={stats.directionalAccuracy * PERCENTAGE_MULTIPLIER}
                />
              </div>

              {/* R² Score */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm">R² Score</span>
                  <span className="font-mono text-sm">
                    {stats.r2Score.toFixed(4)}
                  </span>
                </div>
                <Progress
                  value={Math.max(0, stats.r2Score * PERCENTAGE_MULTIPLIER)}
                />
              </div>
            </div>

            {/* Error Metrics */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Error Metrics</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-slate-400 text-xs">
                    MAE (Mean Absolute Error)
                  </p>
                  <p className="mt-1 font-mono text-lg">
                    {stats.mae.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-slate-400 text-xs">
                    RMSE (Root Mean Squared Error)
                  </p>
                  <p className="mt-1 font-mono text-lg">
                    {stats.rmse.toFixed(2)}
                  </p>
                </div>

                <div className="col-span-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-slate-400 text-xs">
                    MAPE (Mean Absolute Percentage Error)
                  </p>
                  <p className="mt-1 font-mono text-lg">
                    {(stats.mape * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
