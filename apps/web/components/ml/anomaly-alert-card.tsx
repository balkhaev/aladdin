/**
 * Anomaly Alert Card
 * Display detected market anomalies from ML service
 */

import { AlertTriangle, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { AnomalyAlert } from "../../lib/api/ml";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type AnomalyAlertCardProps = {
  anomaly: AnomalyAlert;
};

export function AnomalyAlertCard({ anomaly }: AnomalyAlertCardProps) {
  const { type, severity, confidence, message, timestamp, price } = anomaly;

  const severityConfig = getSeverityConfig(severity);
  const typeConfig = getTypeConfig(type);

  return (
    <Card className={`border-l-4 ${severityConfig.borderClass}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {typeConfig.icon}
            <span className="text-sm">{typeConfig.label}</span>
          </div>
          <Badge variant={severityConfig.variant}>{severity}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message */}
        <div className="rounded-lg bg-slate-800/50 p-3">
          <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
        </div>

        {/* Price & Deviation */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Price</span>
            <span className="font-mono text-sm">${price.toFixed(2)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Expected</span>
            <span className="font-mono text-sm">
              ${anomaly.expectedPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Deviation</span>
            <span className="font-mono text-sm">
              {(anomaly.deviation * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Confidence</span>
            <Badge variant="outline">{(confidence * 100).toFixed(1)}%</Badge>
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>
            {new Date(timestamp).toLocaleString("ru-RU", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function getSeverityConfig(severity: string): {
  variant: "default" | "destructive" | "outline" | "secondary";
  borderClass: string;
} {
  switch (severity) {
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
  switch (type) {
    case "PRICE_SPIKE":
      return {
        icon: <TrendingUp className="size-5 text-red-500" />,
        label: "Скачок цены",
      };
    case "VOLUME_SPIKE":
      return {
        icon: <Zap className="size-5 text-yellow-500" />,
        label: "Всплеск объема",
      };
    case "SPREAD_ANOMALY":
      return {
        icon: <AlertTriangle className="size-5 text-orange-500" />,
        label: "Аномальный спред",
      };
    case "PATTERN_BREAK":
      return {
        icon: <TrendingDown className="size-5 text-red-500" />,
        label: "Нарушение паттерна",
      };
    default:
      return {
        icon: <AlertTriangle className="size-5" />,
        label: "Аномалия",
      };
  }
}
