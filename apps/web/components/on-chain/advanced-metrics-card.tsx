/**
 * Advanced On-Chain Metrics Card
 * Displays Reserve Risk, Accumulation Trend, HODL Waves, Binary CDD
 */

import type { OnChainMetrics } from "@aladdin/core";
import { Activity, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";

type AdvancedMetricsCardProps = {
  metrics: OnChainMetrics;
};

export function AdvancedMetricsCard({ metrics }: AdvancedMetricsCardProps) {
  const getReserveRiskColor = (value: number) => {
    if (value < 0.002) return "text-green-600";
    if (value < 0.005) return "text-blue-600";
    if (value < 0.015) return "text-yellow-600";
    return "text-red-600";
  };

  const getReserveRiskLabel = (value: number) => {
    if (value < 0.002) return "Extreme Accumulation";
    if (value < 0.005) return "Accumulation Zone";
    if (value < 0.015) return "Neutral";
    if (value < 0.02) return "Distribution Zone";
    return "Extreme Distribution";
  };

  const getAccumulationColor = (score: number) => {
    if (score > 50) return "text-green-600";
    if (score > 20) return "text-blue-600";
    if (score > -20) return "text-gray-600";
    if (score > -50) return "text-yellow-600";
    return "text-red-600";
  };

  const getAccumulationLabel = (score: number) => {
    if (score > 50) return "Strong Accumulation";
    if (score > 20) return "Accumulation";
    if (score > -20) return "Neutral";
    if (score > -50) return "Distribution";
    return "Strong Distribution";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-5" />
          Advanced On-Chain Metrics
        </CardTitle>
        <CardDescription>
          Reserve Risk, Accumulation Trends, and HODL behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reserve Risk */}
        {metrics.reserveRisk !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Reserve Risk</span>
                <Badge
                  className={getReserveRiskColor(metrics.reserveRisk)}
                  variant="outline"
                >
                  {getReserveRiskLabel(metrics.reserveRisk)}
                </Badge>
              </div>
              <span
                className={`font-bold ${getReserveRiskColor(metrics.reserveRisk)}`}
              >
                {metrics.reserveRisk.toFixed(4)}
              </span>
            </div>
            <Progress
              className="h-2"
              value={Math.min(metrics.reserveRisk * 2500, 100)}
            />
            <p className="text-muted-foreground text-xs">
              {metrics.reserveRisk < 0.005
                ? "Low risk - potential accumulation zone"
                : metrics.reserveRisk > 0.015
                  ? "High risk - potential distribution zone"
                  : "Moderate risk - neutral zone"}
            </p>
          </div>
        )}

        {/* Accumulation Trend */}
        {metrics.accumulationTrend && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Accumulation Trend</span>
                <Badge
                  className={getAccumulationColor(
                    metrics.accumulationTrend.score
                  )}
                  variant="outline"
                >
                  {getAccumulationLabel(metrics.accumulationTrend.score)}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {metrics.accumulationTrend.score > 0 ? (
                  <TrendingUp className="size-4 text-green-600" />
                ) : (
                  <TrendingDown className="size-4 text-red-600" />
                )}
                <span
                  className={`font-bold ${getAccumulationColor(metrics.accumulationTrend.score)}`}
                >
                  {metrics.accumulationTrend.score.toFixed(0)}
                </span>
              </div>
            </div>
            <Progress
              className="h-2"
              value={((metrics.accumulationTrend.score + 100) / 200) * 100}
            />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">7d:</span>{" "}
                <span className="font-medium">
                  {metrics.accumulationTrend.trend7d.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">30d:</span>{" "}
                <span className="font-medium">
                  {metrics.accumulationTrend.trend30d.toFixed(1)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">90d:</span>{" "}
                <span className="font-medium">
                  {metrics.accumulationTrend.trend90d.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Binary CDD */}
        {metrics.binaryCDD !== undefined && (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <AlertCircle
                className={`size-4 ${metrics.binaryCDD ? "text-yellow-600" : "text-gray-400"}`}
              />
              <span className="font-medium text-sm">
                Old Coins Moving (CDD)
              </span>
            </div>
            <Badge variant={metrics.binaryCDD ? "default" : "outline"}>
              {metrics.binaryCDD ? "Active" : "Inactive"}
            </Badge>
          </div>
        )}

        {/* HODL Waves */}
        {metrics.hodlWaves && (
          <div className="space-y-3">
            <div className="font-medium text-sm">HODL Waves Distribution</div>
            <div className="space-y-2">
              <HodlWaveBar
                color="bg-red-500"
                label="<1m"
                percentage={metrics.hodlWaves.under1m}
              />
              <HodlWaveBar
                color="bg-orange-500"
                label="1-3m"
                percentage={metrics.hodlWaves.m1to3}
              />
              <HodlWaveBar
                color="bg-yellow-500"
                label="3-6m"
                percentage={metrics.hodlWaves.m3to6}
              />
              <HodlWaveBar
                color="bg-lime-500"
                label="6-12m"
                percentage={metrics.hodlWaves.m6to12}
              />
              <HodlWaveBar
                color="bg-green-500"
                label="1-2y"
                percentage={metrics.hodlWaves.y1to2}
              />
              <HodlWaveBar
                color="bg-teal-500"
                label="2-3y"
                percentage={metrics.hodlWaves.y2to3}
              />
              <HodlWaveBar
                color="bg-cyan-500"
                label="3-5y"
                percentage={metrics.hodlWaves.y3to5}
              />
              <HodlWaveBar
                color="bg-blue-500"
                label="5y+"
                percentage={metrics.hodlWaves.over5y}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Long-term holders (5y+):{" "}
              <span className="font-medium">
                {metrics.hodlWaves.over5y.toFixed(1)}%
              </span>
              {metrics.hodlWaves.over5y > 45 && " - Strong hodling behavior"}
              {metrics.hodlWaves.over5y < 35 && " - Potential distribution"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HodlWaveBar({
  label,
  percentage,
  color,
}: {
  label: string;
  percentage: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-right font-mono text-xs">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(percentage * 2, 100)}%` }}
        />
      </div>
      <span className="w-12 font-mono text-xs">{percentage.toFixed(1)}%</span>
    </div>
  );
}
