/**
 * ML Prediction Card
 * Displays AI price predictions in trading sidebar
 */

import { Brain, TrendingDown, TrendingUp } from "lucide-react";
import { usePrediction } from "../hooks/use-ml-prediction";
import Loader from "./loader";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type MLPredictionCardProps = {
  symbol: string;
};

export function MLPredictionCard({ symbol }: MLPredictionCardProps) {
  const { data, isLoading, error } = usePrediction(symbol, "1h", true);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4" />
            ML Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm">
            <p>No model trained</p>
            <p className="mt-1 text-xs">Train a model on /ml page first</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.predictions?.[0]) {
    return null;
  }

  const prediction = data.predictions[0];
  const avgBound = (prediction.lowerBound + prediction.upperBound) / 2;
  const percentChange =
    ((prediction.predictedPrice - avgBound) / avgBound) * 100;

  const isPositive = percentChange > 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? "text-green-500" : "text-red-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-purple-500" />
          ML Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Predicted Price */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              Next {data.horizon.toUpperCase()}
            </span>
            <span className="text-muted-foreground text-xs">
              {data.modelInfo?.version?.includes("lstm") ? "LSTM" : "HYBRID"}
            </span>
          </div>
          <div
            className={`flex items-center gap-2 font-mono text-2xl ${trendColor}`}
          >
            <TrendIcon className="h-5 w-5" />$
            {prediction.predictedPrice.toFixed(2)}
          </div>
          <div className={`font-medium text-sm ${trendColor}`}>
            {isPositive ? "+" : ""}
            {percentChange.toFixed(2)}%
          </div>
        </div>

        {/* Confidence Interval */}
        <div className="space-y-1">
          <div className="text-muted-foreground text-xs">Confidence Range</div>
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-red-400">
              ${prediction.lowerBound.toFixed(2)}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className="text-green-400">
              ${prediction.upperBound.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
              style={{ width: `${prediction.confidence * 100}%` }}
            />
          </div>
          <div className="text-right text-muted-foreground text-xs">
            {(prediction.confidence * 100).toFixed(0)}% confident
          </div>
        </div>

        {/* Model Info */}
        {data.modelInfo && (
          <div className="border-border border-t pt-3 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Model Accuracy</span>
              <span className="font-medium text-foreground">
                {(data.modelInfo.accuracy * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              <span>Last Trained</span>
              <span className="font-medium text-foreground">
                {new Date(data.modelInfo.lastTrained).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Market Regime */}
        {data.features?.marketRegime && (
          <div className="border-border border-t pt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Market Regime</span>
              {(() => {
                const regime = data.features.marketRegime;
                if (regime === "BULL") {
                  return (
                    <span className="rounded-full bg-green-500/20 px-2 py-0.5 font-medium text-green-500">
                      {regime}
                    </span>
                  );
                }
                if (regime === "BEAR") {
                  return (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-medium text-red-500">
                      {regime}
                    </span>
                  );
                }
                return (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 font-medium text-yellow-500">
                    {regime}
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
