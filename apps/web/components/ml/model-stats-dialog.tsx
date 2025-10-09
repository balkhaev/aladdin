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
            {/* Overall Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Total Models</p>
                <p className="mt-1 font-mono text-lg">{stats.totalModels}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Size</p>
                <p className="mt-1 font-mono text-lg">
                  {(stats.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Oldest Model</p>
                <p className="mt-1 text-sm">
                  {formatDistanceToNow(new Date(stats.oldestModel), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Newest Model</p>
                <p className="mt-1 text-sm">
                  {formatDistanceToNow(new Date(stats.newestModel), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>

            {/* Models List */}
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Models</h3>
              {stats.models.map((model) => (
                <div
                  className="rounded-lg border border-slate-700 bg-slate-800/50 p-4"
                  key={`${model.modelType}-${model.version}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Badge variant="outline">{model.modelType}</Badge>
                    <span className="text-slate-400 text-xs">
                      v{model.version}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-400 text-xs">Created</p>
                      <p className="mt-1">
                        {formatDistanceToNow(new Date(model.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Last Used</p>
                      <p className="mt-1">
                        {formatDistanceToNow(new Date(model.lastUsed), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Accuracy</p>
                      <p className="mt-1 font-mono">
                        {(model.accuracy * PERCENTAGE_MULTIPLIER).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Size</p>
                      <p className="mt-1 font-mono">
                        {(model.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {/* Accuracy Progress */}
                  <div className="mt-3">
                    <Progress value={model.accuracy * PERCENTAGE_MULTIPLIER} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
