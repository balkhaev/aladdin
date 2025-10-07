import {
  Activity,
  AlertTriangle,
  Clock,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PatternType =
  | "smart_money_accumulation"
  | "retail_fomo"
  | "miner_capitulation"
  | "exchange_exodus"
  | "whale_distribution"
  | "bullish_divergence"
  | "bearish_divergence"
  | "hodl_wave_shift";

type Pattern = {
  type: PatternType;
  confidence: number;
  signal: "bullish" | "bearish" | "neutral";
  description: string;
  indicators: string[];
  timestamp: number;
};

type Props = {
  patterns: Pattern[];
  blockchain: string;
};

const PATTERN_CONFIG: Record<
  PatternType,
  {
    label: string;
    icon: React.ElementType;
    color: string;
  }
> = {
  smart_money_accumulation: {
    label: "Smart Money Accumulation",
    icon: Wallet,
    color: "text-emerald-500",
  },
  retail_fomo: {
    label: "Retail FOMO",
    icon: Users,
    color: "text-orange-500",
  },
  miner_capitulation: {
    label: "Miner Capitulation",
    icon: AlertTriangle,
    color: "text-yellow-500",
  },
  exchange_exodus: {
    label: "Exchange Exodus",
    icon: TrendingUp,
    color: "text-blue-500",
  },
  whale_distribution: {
    label: "Whale Distribution",
    icon: TrendingDown,
    color: "text-red-500",
  },
  bullish_divergence: {
    label: "Bullish Divergence",
    icon: Zap,
    color: "text-green-500",
  },
  bearish_divergence: {
    label: "Bearish Divergence",
    icon: Activity,
    color: "text-red-500",
  },
  hodl_wave_shift: {
    label: "HODL Wave Shift",
    icon: Clock,
    color: "text-purple-500",
  },
};

function getSignalColor(signal: Pattern["signal"]): string {
  switch (signal) {
    case "bullish":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "bearish":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    default:
      return "bg-slate-500/10 text-slate-500 border-slate-500/20";
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return "text-emerald-600";
  if (confidence >= 75) return "text-blue-600";
  if (confidence >= 60) return "text-yellow-600";
  return "text-slate-600";
}

/**
 * Pattern Detection Panel Component
 */
export function PatternDetectionPanel({ patterns, blockchain }: Props) {
  if (patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detected Patterns - {blockchain}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="mb-2 h-12 w-12 opacity-50" />
            <p className="text-sm">No significant patterns detected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate dominant signal
  const bullishCount = patterns.filter((p) => p.signal === "bullish").length;
  const bearishCount = patterns.filter((p) => p.signal === "bearish").length;
  const dominantSignal =
    bullishCount > bearishCount
      ? "bullish"
      : bearishCount > bullishCount
        ? "bearish"
        : "neutral";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Detected Patterns - {blockchain}</span>
          <Badge className={getSignalColor(dominantSignal)} variant="outline">
            {dominantSignal.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center rounded-lg bg-muted p-4">
            <span className="font-bold text-2xl">{patterns.length}</span>
            <span className="text-muted-foreground text-xs">
              Total Patterns
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-emerald-500/10 p-4">
            <span className="font-bold text-2xl text-emerald-600">
              {bullishCount}
            </span>
            <span className="text-muted-foreground text-xs">Bullish</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-red-500/10 p-4">
            <span className="font-bold text-2xl text-red-600">
              {bearishCount}
            </span>
            <span className="text-muted-foreground text-xs">Bearish</span>
          </div>
        </div>

        {/* Pattern Cards */}
        <div className="space-y-4">
          {patterns.map((pattern, index) => {
            const config = PATTERN_CONFIG[pattern.type];
            const Icon = config.icon;

            return (
              <div
                className="rounded-lg border p-4 transition-shadow hover:shadow-md"
                key={`${pattern.type}-${index}`}
              >
                {/* Pattern Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-muted p-2 ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{config.label}</h4>
                      <p className="text-muted-foreground text-xs">
                        {new Date(pattern.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={getSignalColor(pattern.signal)}
                      variant="outline"
                    >
                      {pattern.signal}
                    </Badge>
                    <span
                      className={`font-medium text-sm ${getConfidenceColor(pattern.confidence)}`}
                    >
                      {pattern.confidence}%
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="mb-3 text-muted-foreground text-sm">
                  {pattern.description}
                </p>

                {/* Indicators */}
                <div className="space-y-1">
                  {pattern.indicators.map((indicator, i) => (
                    <div
                      className="flex items-center gap-2 text-muted-foreground text-xs"
                      key={i}
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {indicator}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Interpretation Guide */}
        <div className="mt-6 rounded-lg bg-muted p-4">
          <h4 className="mb-2 font-semibold text-sm">Pattern Strength:</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-emerald-600" />
              <span className="text-muted-foreground">
                90%+ = Very High Confidence
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-blue-600" />
              <span className="text-muted-foreground">
                75-89% = High Confidence
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-yellow-600" />
              <span className="text-muted-foreground">
                60-74% = Moderate Confidence
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-slate-600" />
              <span className="text-muted-foreground">
                &lt;60% = Low Confidence
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
