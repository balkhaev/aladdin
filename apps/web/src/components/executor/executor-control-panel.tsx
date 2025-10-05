/**
 * Executor Control Panel
 * Control panel for managing strategy executor settings
 */

import { AlertTriangle, Pause, Play, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  useExecutorConfig,
  useSetExecutionMode,
  useToggleAutoExecute,
  useUpdateExecutorConfig,
} from "@/hooks/use-executor";

const POSITION_LIMIT_MIN = 1;
const POSITION_LIMIT_SMALL = 3;
const POSITION_LIMIT_MEDIUM = 5;
const POSITION_LIMIT_LARGE = 10;
const POSITION_LIMIT_XLARGE = 15;
const POSITION_LIMIT_XXLARGE = 20;

const MAX_POSITION_OPTIONS = [
  POSITION_LIMIT_MIN,
  POSITION_LIMIT_SMALL,
  POSITION_LIMIT_MEDIUM,
  POSITION_LIMIT_LARGE,
  POSITION_LIMIT_XLARGE,
  POSITION_LIMIT_XXLARGE,
];

export function ExecutorControlPanel() {
  const { data: config, isLoading } = useExecutorConfig();
  const setModeMutation = useSetExecutionMode();
  const toggleAutoMutation = useToggleAutoExecute();
  const updateConfigMutation = useUpdateExecutorConfig();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            Failed to load executor configuration
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleModeChange = (mode: "PAPER" | "LIVE") => {
    setModeMutation.mutate(mode, {
      onSuccess: () => {
        toast({
          title: "Mode Changed",
          description: `Execution mode set to ${mode}`,
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to change execution mode",
          variant: "destructive",
        });
      },
    });
  };

  const handleAutoExecuteToggle = (checked: boolean) => {
    toggleAutoMutation.mutate(checked, {
      onSuccess: () => {
        toast({
          title: checked ? "Auto-Execution Enabled" : "Auto-Execution Disabled",
          description: checked
            ? "Signals will be automatically executed"
            : "Signals will require manual confirmation",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to toggle auto-execution",
          variant: "destructive",
        });
      },
    });
  };

  const handleMaxPositionsChange = (value: string) => {
    const newMax = Number.parseInt(value, 10);

    updateConfigMutation.mutate(
      { maxOpenPositions: newMax },
      {
        onSuccess: () => {
          toast({
            title: "Settings Updated",
            description: `Max open positions set to ${newMax}`,
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update settings",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleAlgorithmicToggle = (checked: boolean) => {
    updateConfigMutation.mutate(
      { enableAlgorithmicExecution: checked },
      {
        onSuccess: () => {
          toast({
            title: checked
              ? "Algorithmic Execution Enabled"
              : "Algorithmic Execution Disabled",
            description: checked
              ? "VWAP, TWAP, and Iceberg strategies are now available"
              : "Only simple market/limit orders will be used",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to toggle algorithmic execution",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Control Panel
          </CardTitle>
          <Badge
            className="text-xs"
            variant={config.mode === "LIVE" ? "destructive" : "default"}
          >
            {config.mode} MODE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* LIVE Mode Warning */}
        {config.mode === "LIVE" && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> LIVE mode is active. Real orders will be
              placed on exchanges with real funds.
            </AlertDescription>
          </Alert>
        )}

        {/* Execution Mode */}
        <div className="space-y-2">
          <Label>Execution Mode</Label>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={config.mode === "PAPER" || setModeMutation.isPending}
              onClick={() => handleModeChange("PAPER")}
              size="sm"
              variant={config.mode === "PAPER" ? "default" : "outline"}
            >
              PAPER Trading
            </Button>
            <Button
              className="flex-1"
              disabled={config.mode === "LIVE" || setModeMutation.isPending}
              onClick={() => handleModeChange("LIVE")}
              size="sm"
              variant={config.mode === "LIVE" ? "destructive" : "outline"}
            >
              LIVE Trading
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {config.mode === "PAPER"
              ? "Simulated trading with no real orders"
              : "Real trading with actual orders on exchanges"}
          </p>
        </div>

        {/* Auto Execute */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Auto-Execution</Label>
            <p className="text-muted-foreground text-xs">
              Automatically execute trading signals
            </p>
          </div>
          <Switch
            checked={config.autoExecute}
            disabled={toggleAutoMutation.isPending}
            onCheckedChange={handleAutoExecuteToggle}
          />
        </div>

        {/* Max Open Positions */}
        <div className="space-y-2">
          <Label>Max Open Positions</Label>
          <Select
            defaultValue={config.maxOpenPositions.toString()}
            onValueChange={handleMaxPositionsChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_POSITION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt.toString()}>
                  {opt} positions
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Maximum number of concurrent open positions
          </p>
        </div>

        {/* Algorithmic Execution */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Algorithmic Execution</Label>
            <p className="text-muted-foreground text-xs">
              Enable VWAP, TWAP, and Iceberg strategies
            </p>
          </div>
          <Switch
            checked={config.enableAlgorithmicExecution}
            disabled={updateConfigMutation.isPending}
            onCheckedChange={handleAlgorithmicToggle}
          />
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-2">
            {config.autoExecute ? (
              <>
                <Play className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Running</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">Paused</span>
              </>
            )}
          </div>
          <Badge className="text-xs" variant="outline">
            {config.defaultExchange}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
