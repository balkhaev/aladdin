/**
 * On-Chain Alerts Panel
 * Displays real-time on-chain metric alerts
 */

import {
  AlertCircle,
  AlertTriangle,
  Info,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useOnChainAlerts } from "../../hooks/use-onchain-alerts";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";

type OnChainAlertsPanelProps = {
  blockchain?: "BTC" | "ETH" | "all";
  compact?: boolean;
  maxVisible?: number;
};

export function OnChainAlertsPanel({
  blockchain = "all",
  compact = false,
  maxVisible = 10,
}: OnChainAlertsPanelProps) {
  const {
    alerts,
    clearAlerts,
    removeAlert,
    criticalAlerts,
    warningAlerts,
    isConnected,
  } = useOnChainAlerts({ blockchain, maxAlerts: maxVisible });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="size-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="size-4 text-yellow-500" />;
      case "info":
      default:
        return <Info className="size-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "info":
      default:
        return "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400";
    }
  };

  const getSignalIcon = (signal?: string) => {
    switch (signal) {
      case "bullish":
        return <TrendingUp className="size-3 text-green-500" />;
      case "bearish":
        return <TrendingDown className="size-3 text-red-500" />;
      default:
        return null;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {criticalAlerts.length > 0 && (
          <Badge className="w-full justify-center" variant="destructive">
            {criticalAlerts.length} Critical Alert
            {criticalAlerts.length > 1 ? "s" : ""}
          </Badge>
        )}
        {warningAlerts.length > 0 && (
          <Badge
            className="w-full justify-center border-yellow-500/20 text-yellow-600"
            variant="outline"
          >
            {warningAlerts.length} Warning{warningAlerts.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>On-Chain Alerts</CardTitle>
            {!isConnected && (
              <Badge
                className="border-red-500/20 text-red-600"
                variant="outline"
              >
                Disconnected
              </Badge>
            )}
            {alerts.length > 0 && (
              <Badge variant="outline">
                {alerts.length} alert{alerts.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {alerts.length > 0 && (
            <Button onClick={clearAlerts} size="sm" variant="ghost">
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Info className="mx-auto mb-2 size-8 opacity-50" />
            <p>No active alerts</p>
            <p className="text-sm">Monitoring on-chain metrics...</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  className={`rounded-lg border p-3 ${getSeverityColor(alert.severity)}`}
                  key={alert.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(alert.severity)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs" variant="outline">
                            {alert.blockchain}
                          </Badge>
                          <Badge className="text-xs" variant="outline">
                            {alert.alertType}
                          </Badge>
                          {getSignalIcon(alert.signal)}
                        </div>
                        <p className="font-medium text-sm">{alert.message}</p>
                        {alert.metadata?.interpretation && (
                          <p className="text-xs opacity-80">
                            {String(alert.metadata.interpretation)}
                          </p>
                        )}
                        <p className="text-xs opacity-60">
                          {formatTimestamp(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="size-6 shrink-0"
                      onClick={() => removeAlert(alert.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
