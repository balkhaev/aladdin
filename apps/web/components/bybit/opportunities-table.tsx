/**
 * Bybit Opportunities Table Component
 */

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
  useBybitOpportunities,
  useOpportunitiesStats,
} from "@/hooks/use-bybit-opportunities";
import type { OpportunitySignal } from "@/types/bybit";
import { Badge } from "../ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

const PRICE_DECIMALS = 4;

function formatVolume(volume: number): string {
  const MILLION = 1_000_000;
  const THOUSAND = 1000;
  if (volume >= MILLION) return `${(volume / MILLION).toFixed(2)}M`;
  if (volume >= THOUSAND) return `${(volume / THOUSAND).toFixed(2)}K`;
  return volume.toFixed(2);
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function getSignalColor(signal: OpportunitySignal): string {
  switch (signal) {
    case "BUY":
      return "text-green-400";
    case "SELL":
      return "text-red-400";
    case "NEUTRAL":
      return "text-gray-400";
    default:
      return "text-gray-400";
  }
}

function getStrengthVariant(
  strength: string
): "default" | "secondary" | "destructive" {
  switch (strength) {
    case "STRONG":
      return "destructive";
    case "MODERATE":
      return "default";
    case "WEAK":
      return "secondary";
    default:
      return "secondary";
  }
}

export function OpportunitiesTable() {
  const [minScore, setMinScore] = useState<number>(60);
  const [signal, setSignal] = useState<OpportunitySignal | "ALL">("ALL");
  const [minConfidence, setMinConfidence] = useState<number>(50);
  const [limit, setLimit] = useState<number>(50);

  const filters = {
    minScore,
    signal: signal !== "ALL" ? signal : undefined,
    minConfidence,
    limit,
  };

  const {
    data: opportunitiesData,
    isLoading,
    error,
    refetch,
  } = useBybitOpportunities(filters);

  const { data: stats } = useOpportunitiesStats();

  const opportunities = opportunitiesData?.opportunities ?? [];

  // Safe stats with defaults
  const safeStats = {
    total: stats?.total ?? 0,
    bySignal: {
      BUY: stats?.bySignal?.BUY ?? 0,
      SELL: stats?.bySignal?.SELL ?? 0,
      NEUTRAL: stats?.bySignal?.NEUTRAL ?? 0,
    },
    byStrength: {
      WEAK: stats?.byStrength?.WEAK ?? 0,
      MODERATE: stats?.byStrength?.MODERATE ?? 0,
      STRONG: stats?.byStrength?.STRONG ?? 0,
    },
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Total Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{safeStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Buy Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="font-bold text-2xl">
                {safeStats.bySignal.BUY}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">Sell Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="font-bold text-2xl">
                {safeStats.bySignal.SELL}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-medium text-sm">
              Strong Signals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {safeStats.byStrength.STRONG}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Trading Opportunities
              {opportunities.length > 0 && (
                <Badge variant="secondary">{opportunities.length}</Badge>
              )}
            </CardTitle>
            <Button onClick={() => refetch()} size="sm" variant="ghost">
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="minScore">Min Score</Label>
              <Input
                id="minScore"
                max="100"
                min="0"
                onChange={(e) => setMinScore(Number(e.target.value))}
                type="number"
                value={minScore}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signal">Signal Type</Label>
              <Select
                onValueChange={(v) => setSignal(v as OpportunitySignal | "ALL")}
                value={signal}
              >
                <SelectTrigger id="signal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minConfidence">Min Confidence</Label>
              <Input
                id="minConfidence"
                max="100"
                min="0"
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                type="number"
                value={minConfidence}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Limit</Label>
              <Input
                id="limit"
                max="200"
                min="10"
                onChange={(e) => setLimit(Number(e.target.value))}
                type="number"
                value={limit}
              />
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="flex h-[400px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : null}

          {/* Error State */}
          {error ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-muted-foreground">
                Failed to load opportunities
              </p>
            </div>
          ) : null}

          {/* Table */}
          {!(isLoading || error) && opportunities.length > 0 ? (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Volume 24h</TableHead>
                    <TableHead className="text-right">Change 5m</TableHead>
                    <TableHead className="text-right">RSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunities.map((opp, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatTimestamp(opp.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium font-mono">
                        {opp.symbol}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {opp.opportunityType === "BUY" ? (
                            <ArrowUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-500" />
                          )}
                          <span className={getSignalColor(opp.opportunityType)}>
                            {opp.opportunityType}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold">
                          {opp.totalScore.toFixed(1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStrengthVariant(opp.strength)}>
                          {opp.strength}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {opp.confidence.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${opp.price.toFixed(PRICE_DECIMALS)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${formatVolume(opp.volume24h)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          opp.priceChange5m > 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {opp.priceChange5m > 0 ? "+" : ""}
                        {opp.priceChange5m.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {opp.rsi.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {/* Empty State */}
          {!(isLoading || error) && opportunities.length === 0 ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">
                No opportunities found with current filters
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
