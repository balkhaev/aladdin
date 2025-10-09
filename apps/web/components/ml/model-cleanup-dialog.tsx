/**
 * Model Cleanup Dialog
 * Configure and execute cleanup of old models
 */

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useCleanupModels } from "../../hooks/use-ml-models";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ModelCleanupDialogProps = {
  open: boolean;
  onClose: () => void;
};

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function ModelCleanupDialog({ open, onClose }: ModelCleanupDialogProps) {
  const [days, setDays] = useState(30);
  const cleanupMutation = useCleanupModels();

  const handleCleanup = () => {
    const olderThan = Date.now() - days * MILLISECONDS_PER_DAY;
    cleanupMutation.mutate(
      { olderThanDays: olderThan },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Cleanup Old Models
          </DialogTitle>
          <DialogDescription>
            Delete models that haven't been used recently to free up storage
            space
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="days">Delete models older than (days)</Label>
            <Input
              id="days"
              max={365}
              min={1}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
              type="number"
              value={days}
            />
            <p className="mt-2 text-slate-400 text-sm">
              Models that haven't been trained or used in the last {days} days
              will be deleted
            </p>
          </div>

          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
            <p className="text-sm text-yellow-400">
              ⚠️ This action cannot be undone. Make sure you have backups if
              needed.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-red-500 hover:bg-red-600"
            disabled={cleanupMutation.isPending}
            onClick={handleCleanup}
          >
            {cleanupMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cleaning up...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Cleanup Models
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
