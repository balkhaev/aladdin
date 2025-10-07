/**
 * Anomaly Alert Card
 * Display detected market anomalies
 */

import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import type { AnomalyDetection } from "../../lib/api/anomaly";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type AnomalyAlertCardProps = {
  anomaly: AnomalyDetection;
};

export function AnomalyAlertCard({ anomaly }: AnomalyAlertCardProps) {
  const { type, severity, confidence, description, recommendations } = anomaly;

  const severityConfig = getSeverityConfig(severity);
  const typeConfig = getTypeConfig(type);

  return (
    <Card className={`border-l-4 ${severityConfig.borderClass}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {typeConfig.icon}
            <span>{typeConfig.label}</span>
          </div>
          <Badge variant={severityConfig.variant}>{severity}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-slate-300 text-sm">{description}</p>
        </div>

        {/* Confidence */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm">Confidence</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full ${getConfidenceColor(confidence)}`}
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="font-semibold text-sm">
              {confidence.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold text-sm">Recommendations</div>
            <ul className="space-y-1">
              {recommendations.map((rec, idx) => (
                <li
                  className="flex items-start gap-2 text-slate-300 text-sm"
                  key={idx}
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timestamp */}
        <div className="text-right text-slate-500 text-xs">
          Detected {new Date(anomaly.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function getSeverityConfig(severity: string): {
  variant: "default" | "destructive" | "outline" | "secondary";
  borderClass: string;
} {
  const severityKey = severity as AnomalyDetection["severity"];

  switch (severityKey) {
    case "CRITICAL":
      return {
        variant: "destructive",
        borderClass: "border-l-red-500",
      };
    case "HIGH":
      return {
        variant: "destructive",
        borderClass: "border-l-orange-500",
      };
    case "MEDIUM":
      return {
        variant: "secondary",
        borderClass: "border-l-yellow-500",
      };
    case "LOW":
      return {
        variant: "outline",
        borderClass: "border-l-blue-500",
      };
    default:
      return {
        variant: "default",
        borderClass: "border-l-slate-500",
      };
  }
}

function getTypeConfig(type: string): { icon: React.ReactNode; label: string } {
  const typeKey = type as AnomalyDetection["type"];

  switch (typeKey) {
    case "PUMP_AND_DUMP":
      return {
        icon: <TrendingUp className="h-5 w-5 text-red-500" />,
        label: "Pump & Dump Detected",
      };
    case "FLASH_CRASH":
      return {
        icon: <TrendingDown className="h-5 w-5 text-orange-500" />,
        label: "Flash Crash Risk",
      };
    case "UNUSUAL_VOLUME":
      return {
        icon: <Zap className="h-5 w-5 text-yellow-500" />,
        label: "Unusual Volume",
      };
    case "PRICE_MANIPULATION":
      return {
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        label: "Price Manipulation",
      };
    case "WHALE_MOVEMENT":
      return {
        icon: <Zap className="h-5 w-5 text-blue-500" />,
        label: "Whale Movement",
      };
    default:
      return {
        icon: <XCircle className="h-5 w-5" />,
        label: "Unknown Anomaly",
      };
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "bg-red-500";
  if (confidence >= 60) return "bg-orange-500";
  if (confidence >= 40) return "bg-yellow-500";
  return "bg-blue-500";
}
