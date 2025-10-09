/**
 * HPO Configuration Form
 * Form for configuring hyperparameter optimization
 */

import { Info } from "lucide-react";
import { useState } from "react";
import { useHPORecommendations } from "../../hooks/use-hpo";
import type {
  HyperparameterSpace,
  ModelType,
  OptimizationMetric,
  PredictionHorizon,
} from "../../lib/api/ml";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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

type HPOConfigFormProps = {
  onSubmit: (config: {
    symbol: string;
    modelType: ModelType;
    horizon: PredictionHorizon;
    method: "GRID" | "RANDOM";
    nTrials: number;
    days: number;
    optimizationMetric: OptimizationMetric;
    hyperparameterSpace: HyperparameterSpace;
    includeSentiment: boolean;
  }) => void;
  isLoading?: boolean;
};

export function HPOConfigForm({ onSubmit, isLoading }: HPOConfigFormProps) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [modelType, setModelType] = useState<ModelType>("LSTM");
  const [horizon, setHorizon] = useState<PredictionHorizon>("1h");
  const [method, setMethod] = useState<"GRID" | "RANDOM">("RANDOM");
  const [nTrials, setNTrials] = useState(20);
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<OptimizationMetric>(
    "directional_accuracy"
  );
  const [includeSentiment, setIncludeSentiment] = useState(true);

  // Hyperparameter space (LSTM)
  const [hiddenSizes, setHiddenSizes] = useState("16,32,64");
  const [sequenceLengths, setSequenceLengths] = useState("10,20,30");
  const [learningRates, setLearningRates] = useState("0.0001,0.001,0.01");
  const [epochs, setEpochs] = useState("50,100,200");

  // Hyperparameter space (Hybrid)
  const [lookbackWindows, setLookbackWindows] = useState("20,30,50");
  const [smoothingFactors, setSmoothingFactors] = useState("0.1,0.2,0.3");

  // Get recommendations
  const { data: recommendations } = useHPORecommendations(
    symbol,
    modelType,
    horizon
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const space: HyperparameterSpace = {};

    if (modelType === "LSTM") {
      if (hiddenSizes) {
        const values = hiddenSizes
          .split(",")
          .map((v) => Number.parseInt(v.trim(), 10));
        space.hidden_size = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
      if (sequenceLengths) {
        const values = sequenceLengths
          .split(",")
          .map((v) => Number.parseInt(v.trim(), 10));
        space.sequence_length = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
      if (learningRates) {
        const values = learningRates
          .split(",")
          .map((v) => Number.parseFloat(v.trim()));
        space.learning_rate = {
          min: Math.min(...values),
          max: Math.max(...values),
          log: true,
        };
      }
      if (epochs) {
        space.batch_size = epochs
          .split(",")
          .map((v) => Number.parseInt(v.trim(), 10));
      }
    } else {
      // For HYBRID model, we might need different parameters
      // Using available fields from HyperparameterSpace
      if (lookbackWindows) {
        const values = lookbackWindows
          .split(",")
          .map((v) => Number.parseInt(v.trim(), 10));
        space.sequence_length = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
      if (smoothingFactors) {
        const values = smoothingFactors
          .split(",")
          .map((v) => Number.parseFloat(v.trim()));
        space.dropout = { min: Math.min(...values), max: Math.max(...values) };
      }
    }

    onSubmit({
      symbol,
      modelType,
      horizon,
      method,
      nTrials,
      days,
      optimizationMetric: metric,
      hyperparameterSpace: space,
      includeSentiment,
    });
  };

  // Use recommendations
  const useRecommended = () => {
    if (!recommendations) return;

    const { recommendedParams } = recommendations;

    // Convert recommended params object to comma-separated strings
    if (modelType === "LSTM") {
      const params = Object.entries(recommendedParams);
      params.forEach(([key, value]) => {
        if (key === "hidden_size" && typeof value === "number") {
          setHiddenSizes(
            `${Math.floor(value * 0.5)},${value},${Math.floor(value * 1.5)}`
          );
        }
        if (key === "sequence_length" && typeof value === "number") {
          setSequenceLengths(
            `${Math.floor(value * 0.5)},${value},${Math.floor(value * 1.5)}`
          );
        }
        if (key === "learning_rate" && typeof value === "number") {
          setLearningRates(`${value * 0.1},${value},${value * 10}`);
        }
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hyperparameter Optimization Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Basic Configuration */}
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
              <Label htmlFor="modelType">Model Type</Label>
              <Select
                onValueChange={(v) => setModelType(v as ModelType)}
                value={modelType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LSTM">LSTM</SelectItem>
                  <SelectItem value="HYBRID">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="horizon">Prediction Horizon</Label>
              <Select
                onValueChange={(v) => setHorizon(v as PredictionHorizon)}
                value={horizon}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 Hour</SelectItem>
                  <SelectItem value="4h">4 Hours</SelectItem>
                  <SelectItem value="1d">1 Day</SelectItem>
                  <SelectItem value="7d">7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optimization Method */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="method">Optimization Method</Label>
              <Select
                onValueChange={(v) => setMethod(v as "GRID" | "RANDOM")}
                value={method}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RANDOM">Random Search</SelectItem>
                  <SelectItem value="GRID">Grid Search</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {method === "RANDOM" && (
              <div>
                <Label htmlFor="nTrials">Number of Trials</Label>
                <Input
                  id="nTrials"
                  max={100}
                  min={5}
                  onChange={(e) =>
                    setNTrials(Number.parseInt(e.target.value, 10))
                  }
                  type="number"
                  value={nTrials}
                />
              </div>
            )}

            <div>
              <Label htmlFor="days">Historical Period (Days)</Label>
              <Input
                id="days"
                max={365}
                min={7}
                onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
                type="number"
                value={days}
              />
            </div>

            <div className="flex flex-col justify-between">
              <Label htmlFor="includeSentiment">Include Sentiment</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={includeSentiment}
                  id="includeSentiment"
                  onCheckedChange={setIncludeSentiment}
                />
                <span className="text-slate-400 text-sm">
                  {includeSentiment ? "Using sentiment data" : "Technical only"}
                </span>
              </div>
            </div>
          </div>

          {/* Optimization Metric */}
          <div>
            <Label htmlFor="metric">Optimization Metric</Label>
            <Select
              onValueChange={(v) => setMetric(v as OptimizationMetric)}
              value={metric}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="directionalAccuracy">
                  Directional Accuracy (Best for Trading)
                </SelectItem>
                <SelectItem value="mae">MAE (Mean Absolute Error)</SelectItem>
                <SelectItem value="rmse">
                  RMSE (Root Mean Squared Error)
                </SelectItem>
                <SelectItem value="mape">
                  MAPE (Mean Absolute Percentage Error)
                </SelectItem>
                <SelectItem value="r2Score">R² Score (Overall Fit)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Hyperparameter Space */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Hyperparameter Space</h3>
              {recommendations && (
                <Button
                  onClick={useRecommended}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Use Recommended
                </Button>
              )}
            </div>

            {recommendations && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  <p className="text-blue-100 text-sm">
                    {recommendations.reasoning}
                  </p>
                </div>
              </div>
            )}

            {modelType === "LSTM" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="hiddenSizes">
                    Hidden Sizes (comma-separated)
                  </Label>
                  <Input
                    id="hiddenSizes"
                    onChange={(e) => setHiddenSizes(e.target.value)}
                    placeholder="16,32,64"
                    value={hiddenSizes}
                  />
                </div>

                <div>
                  <Label htmlFor="sequenceLengths">
                    Sequence Lengths (comma-separated)
                  </Label>
                  <Input
                    id="sequenceLengths"
                    onChange={(e) => setSequenceLengths(e.target.value)}
                    placeholder="10,20,30"
                    value={sequenceLengths}
                  />
                </div>

                <div>
                  <Label htmlFor="learningRates">
                    Learning Rates (comma-separated)
                  </Label>
                  <Input
                    id="learningRates"
                    onChange={(e) => setLearningRates(e.target.value)}
                    placeholder="0.0001,0.001,0.01"
                    value={learningRates}
                  />
                </div>

                <div>
                  <Label htmlFor="epochs">Epochs (comma-separated)</Label>
                  <Input
                    id="epochs"
                    onChange={(e) => setEpochs(e.target.value)}
                    placeholder="50,100,200"
                    value={epochs}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="lookbackWindows">
                    Lookback Windows (comma-separated)
                  </Label>
                  <Input
                    id="lookbackWindows"
                    onChange={(e) => setLookbackWindows(e.target.value)}
                    placeholder="20,30,50"
                    value={lookbackWindows}
                  />
                </div>

                <div>
                  <Label htmlFor="smoothingFactors">
                    Smoothing Factors (comma-separated)
                  </Label>
                  <Input
                    id="smoothingFactors"
                    onChange={(e) => setSmoothingFactors(e.target.value)}
                    placeholder="0.1,0.2,0.3"
                    value={smoothingFactors}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            className="w-full"
            disabled={isLoading}
            size="lg"
            type="submit"
          >
            {isLoading ? "Running Optimization..." : "Start Optimization"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
