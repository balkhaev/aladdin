/**
 * Anomaly Alerts Panel
 * Display all detected anomalies for a symbol
 */

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useDetectAnomalies } from "../../hooks/use-anomaly-detection";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AnomalyAlertCard } from "./anomaly-alert-card";

export function AnomalyAlertsPanel() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [lookbackMinutes, setLookbackMinutes] = useState(60);
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, error, refetch } = useDetectAnomalies(
    { symbol, lookbackMinutes },
    { enabled, refetchInterval: enabled ? 60_000 : undefined } // Refetch every minute if enabled
  );

  const handleDetect = () => {
    setEnabled(true);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="BTCUSDT"
                value={symbol}
              />
            </div>

            <div>
              <Label htmlFor="lookback">Lookback Period (minutes)</Label>
              <Input
                id="lookback"
                max={1440}
                min={5}
                onChange={(e) =>
                  setLookbackMinutes(Number.parseInt(e.target.value, 10))
                }
                type="number"
                value={lookbackMinutes}
              />
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={isLoading}
                onClick={handleDetect}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Detect Anomalies
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>Error: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.anomalies.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
              <AlertCircle className="mx-auto mb-2 h-12 w-12" />
              <p className="font-medium">No Anomalies Detected</p>
              <p className="text-sm">
                Market activity appears normal for {symbol}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {data && data.anomalies.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">
              Detected Anomalies ({data.anomalies.length})
            </h3>
            <div className="text-slate-400 text-sm">
              Last checked: {new Date(data.detectedAt).toLocaleTimeString()}
            </div>
          </div>

          {data.anomalies.map((anomaly, idx) => (
            <AnomalyAlertCard anomaly={anomaly} key={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
