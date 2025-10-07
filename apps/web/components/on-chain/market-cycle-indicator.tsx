import {
  Activity,
  AlertCircle,
  CheckCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type CyclePhase =
  | "early_bull"
  | "mid_bull"
  | "late_bull"
  | "distribution"
  | "bear"
  | "capitulation"
  | "accumulation"
  | "unknown";

type Props = {
  phase: CyclePhase;
  confidence: number;
  recommendation: string;
  blockchain: string;
};

const PHASE_CONFIG: Record<
  CyclePhase,
  {
    label: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    position: number; // 0-100 for progress bar
  }
> = {
  capitulation: {
    label: "Capitulation",
    description: "Extreme fear, historic buying opportunity",
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    position: 0,
  },
  accumulation: {
    label: "Accumulation",
    description: "Smart money accumulating, undervalued",
    icon: Activity,
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    position: 15,
  },
  early_bull: {
    label: "Early Bull",
    description: "Momentum building, good entry point",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    position: 35,
  },
  mid_bull: {
    label: "Mid Bull",
    description: "Strong uptrend, ride the trend",
    icon: TrendingUp,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    position: 55,
  },
  late_bull: {
    label: "Late Bull",
    description: "Euphoria building, prepare exit strategy",
    icon: AlertCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    position: 75,
  },
  distribution: {
    label: "Distribution",
    description: "Smart money exiting, high risk",
    icon: TrendingDown,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    position: 90,
  },
  bear: {
    label: "Bear Market",
    description: "Downtrend, wait for accumulation signals",
    icon: TrendingDown,
    color: "text-slate-600",
    bgColor: "bg-slate-500/10",
    position: 50,
  },
  unknown: {
    label: "Unknown",
    description: "Insufficient data for analysis",
    icon: Activity,
    color: "text-slate-600",
    bgColor: "bg-slate-500/10",
    position: 50,
  },
};

/**
 * Market Cycle Phase Indicator Component
 */
export function MarketCycleIndicator({
  phase,
  confidence,
  recommendation,
  blockchain,
}: Props) {
  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  // Determine confidence level color
  const confidenceColor =
    confidence >= 80
      ? "text-emerald-600"
      : confidence >= 60
        ? "text-yellow-600"
        : "text-slate-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Market Cycle Phase - {blockchain}</span>
          <Badge className={config.bgColor} variant="outline">
            <span className={config.color}>{config.label}</span>
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phase Indicator */}
        <div className="flex items-center gap-4">
          <div className={`rounded-lg p-3 ${config.bgColor}`}>
            <Icon className={`h-8 w-8 ${config.color}`} />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 font-semibold text-lg">{config.label}</h3>
            <p className="text-muted-foreground text-sm">
              {config.description}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="mb-1 text-muted-foreground text-xs">
              Confidence
            </span>
            <span className={`font-bold text-2xl ${confidenceColor}`}>
              {confidence}%
            </span>
          </div>
        </div>

        {/* Cycle Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Capitulation</span>
            <span>Bull Run</span>
            <span>Distribution</span>
          </div>
          <div className="relative">
            <Progress className="h-3" value={config.position} />
            <div
              className="absolute top-0 h-3 w-1 rounded bg-foreground"
              style={{ left: `${config.position}%` }}
            />
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Buy Zone</span>
            <span>Hold Zone</span>
            <span>Sell Zone</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h4 className="mb-1 font-semibold text-sm">Recommendation:</h4>
              <p className="text-muted-foreground text-sm">{recommendation}</p>
            </div>
          </div>
        </div>

        {/* Phase Timeline */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Cycle Phases:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(PHASE_CONFIG)
              .filter(([key]) => key !== "unknown" && key !== "bear")
              .map(([key, value]) => (
                <div
                  className={`flex items-center gap-2 rounded p-2 ${
                    key === phase ? value.bgColor : "bg-muted/50"
                  }`}
                  key={key}
                >
                  <value.icon
                    className={`h-4 w-4 ${key === phase ? value.color : "text-muted-foreground"}`}
                  />
                  <span
                    className={
                      key === phase ? value.color : "text-muted-foreground"
                    }
                  >
                    {value.label}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Warning for low confidence */}
        {confidence < 50 && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
            <div className="flex items-center gap-2 text-xs text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <span>
                Low confidence - use additional indicators before making
                decisions
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
