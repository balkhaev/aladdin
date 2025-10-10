import { useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMacroTechnicals } from "@/hooks/use-macro-data";
import type { MacroTechnicals } from "@/lib/api/macro";

type TechnicalCardProps = {
  data?: MacroTechnicals;
  isLoading: boolean;
  isError: boolean;
};

const RSI_OVERSOLD = 30;
const RSI_OVERBOUGHT = 70;
const RSI_BULLISH = 55;
const RSI_BEARISH = 45;

const ALTSEASON_THRESHOLD = 75;
const ALTSEASON_NEAR = 60;
const BITCOIN_SEASON_THRESHOLD = 25;

function formatUpdatedAt(timestamp?: string) {
  if (!timestamp) return "Unknown";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return "Unknown";
  }
}

function getRsiInsight(value: number) {
  if (value <= RSI_OVERSOLD) {
    return {
      label: "Oversold",
      color: "text-emerald-500",
      description: "Market looks oversold — accumulating opportunities increase.",
    };
  }

  if (value < RSI_BEARISH) {
    return {
      label: "Weak Momentum",
      color: "text-yellow-500",
      description: "Momentum is cooling off; volatility spikes possible.",
    };
  }

  if (value <= RSI_BULLISH) {
    return {
      label: "Neutral",
      color: "text-muted-foreground",
      description: "Balanced market momentum; watch for confirmations.",
    };
  }

  if (value < RSI_OVERBOUGHT) {
    return {
      label: "Bullish Momentum",
      color: "text-orange-500",
      description: "Momentum is building up — trend continuation likely.",
    };
  }

  return {
    label: "Overbought",
    color: "text-red-500",
    description: "Market overheated — profit taking risk rises.",
  };
}

function getAltseasonInsight(value: number) {
  if (value >= ALTSEASON_THRESHOLD) {
    return {
      label: "Altseason",
      color: "text-emerald-500",
      description: "Most major alts outperform BTC over the last 90 days.",
    };
  }

  if (value >= ALTSEASON_NEAR) {
    return {
      label: "Alt Momentum",
      color: "text-orange-500",
      description: "Alts are gaining on BTC — watch for rotations.",
    };
  }

  if (value <= BITCOIN_SEASON_THRESHOLD) {
    return {
      label: "Bitcoin Season",
      color: "text-blue-500",
      description: "BTC dominance strong — defensive posture favored.",
    };
  }

  return {
    label: "Rotation Zone",
    color: "text-muted-foreground",
    description: "No clear winner — rotation between alts and BTC.",
  };
}

function AverageRsiCard({ data, isLoading, isError }: TechnicalCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Average Crypto RSI</CardTitle>
          <CardDescription>14-day blended RSI across majors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-14 w-28 rounded-lg" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data || data.averageCryptoRsi === null || data.assetsCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Average Crypto RSI</CardTitle>
          <CardDescription>14-day blended RSI across majors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          <p>Not enough data to calculate the market RSI right now.</p>
        </CardContent>
      </Card>
    );
  }

  const insight = getRsiInsight(data.averageCryptoRsi);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Average Crypto RSI</CardTitle>
          <CardDescription>14-day blended RSI across majors</CardDescription>
        </div>
        <Badge variant="outline">{data.assetsCount} assets</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="font-semibold text-4xl">
            {data.averageCryptoRsi.toFixed(1)}
          </span>
          <span className={`font-medium ${insight.color}`}>{insight.label}</span>
        </div>
        <p className="text-muted-foreground text-sm">{insight.description}</p>
        <p className="text-muted-foreground text-xs">
          Updated: {formatUpdatedAt(data.timestamp)}
        </p>
      </CardContent>
    </Card>
  );
}

function AltseasonCard({ data, isLoading, isError }: TechnicalCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Altseason Index</CardTitle>
          <CardDescription>Percent of alts outperforming BTC (90d)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-14 w-28 rounded-lg" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  if (
    isError ||
    !data ||
    data.altseasonIndex === null ||
    data.altseasonSample === 0
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Altseason Index</CardTitle>
          <CardDescription>Percent of alts outperforming BTC (90d)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          <p>Altseason index is not available right now.</p>
        </CardContent>
      </Card>
    );
  }

  const insight = getAltseasonInsight(data.altseasonIndex);
  const outperforming =
    Math.round((data.altseasonIndex / 100) * data.altseasonSample);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Altseason Index</CardTitle>
          <CardDescription>Percent of alts outperforming BTC (90d)</CardDescription>
        </div>
        <Badge variant="outline">{data.altseasonSample} alts</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="font-semibold text-4xl">
            {data.altseasonIndex.toFixed(1)}
          </span>
          <span className={`font-medium ${insight.color}`}>{insight.label}</span>
        </div>
        <p className="text-muted-foreground text-sm">
          {outperforming} / {data.altseasonSample} alts beat BTC over the last {data.lookbackDays} days.
        </p>
        <p className="text-muted-foreground text-xs">
          Updated: {formatUpdatedAt(data.timestamp)} · Base: {data.baseAsset}
        </p>
      </CardContent>
    </Card>
  );
}

export function MacroTechnicalMetrics() {
  const { data, isLoading, error } = useMacroTechnicals();

  const isError = useMemo(() => Boolean(error), [error]);

  return (
    <>
      <AverageRsiCard data={data} isLoading={isLoading} isError={isError} />
      <AltseasonCard data={data} isLoading={isLoading} isError={isError} />
    </>
  );
}
