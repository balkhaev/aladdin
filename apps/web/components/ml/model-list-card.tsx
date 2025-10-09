/**
 * Model List Card
 * Displays list of saved ML models with management actions
 */

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, BarChart3, Brain, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteModel, useListModels } from "../../hooks/use-ml-models";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { ModelStatsDialog } from "./model-stats-dialog";

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

export function ModelListCard() {
  const { data, isLoading, error } = useListModels();
  const deleteModelMutation = useDeleteModel();

  const [deleteSymbol, setDeleteSymbol] = useState<string | null>(null);
  const [statsSymbol, setStatsSymbol] = useState<string | null>(null);

  const handleDelete = (symbol: string) => {
    deleteModelMutation.mutate(symbol);
    setDeleteSymbol(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Saved Models
            {data && (
              <Badge className="ml-2" variant="secondary">
                {data.totalModels}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
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

          {data && data.models.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Brain className="mx-auto mb-2 h-12 w-12" />
              <p className="font-medium">No Models Found</p>
              <p className="text-sm">
                Train a model using LSTM or Hybrid prediction
              </p>
            </div>
          )}

          {data && data.models.length > 0 && (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Model Type</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Last Trained</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.models.map((model) => (
                    <TableRow key={`${model.symbol}-${model.modelType}`}>
                      <TableCell className="font-medium font-mono">
                        {model.symbol}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{model.modelType}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {model.version}
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {(() => {
                          try {
                            const date = new Date(model.lastUsed);
                            if (Number.isNaN(date.getTime())) {
                              return "Unknown";
                            }
                            return formatDistanceToNow(date, {
                              addSuffix: true,
                            });
                          } catch {
                            return "Unknown";
                          }
                        })()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatSize(model.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => setStatsSymbol(model.symbol)}
                            size="sm"
                            variant="ghost"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => setDeleteSymbol(model.symbol)}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setDeleteSymbol(null)}
        open={deleteSymbol !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Model</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the model for{" "}
              <span className="font-semibold">{deleteSymbol}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteSymbol && handleDelete(deleteSymbol)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Model Stats Dialog */}
      {statsSymbol && (
        <ModelStatsDialog
          onClose={() => setStatsSymbol(null)}
          open={statsSymbol !== null}
          symbol={statsSymbol}
        />
      )}
    </>
  );
}
