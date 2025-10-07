import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScreenerResult } from "@/lib/api/screener";

type SortField = "symbol" | "strength" | "price" | "change" | "volume";
type SortOrder = "asc" | "desc";

const BADGE_COLORS = {
  recommendation: {
    STRONG_BUY: "bg-green-600 hover:bg-green-700",
    BUY: "bg-green-500 hover:bg-green-600",
    HOLD: "bg-gray-500 hover:bg-gray-600",
    SELL: "bg-red-500 hover:bg-red-600",
    STRONG_SELL: "bg-red-600 hover:bg-red-700",
  },
  trend: {
    BULLISH: "bg-green-500 hover:bg-green-600",
    NEUTRAL: "bg-gray-500 hover:bg-gray-600",
    BEARISH: "bg-red-500 hover:bg-red-600",
  },
  momentum: {
    STRONG: "bg-blue-600 hover:bg-blue-700",
    MODERATE: "bg-blue-400 hover:bg-blue-500",
    WEAK: "bg-blue-300 hover:bg-blue-400",
  },
  volatility: {
    HIGH: "bg-orange-600 hover:bg-orange-700",
    MEDIUM: "bg-orange-400 hover:bg-orange-500",
    LOW: "bg-orange-200 hover:bg-orange-300 text-gray-800",
  },
} as const;

type ScreenerResultsTableProps = {
  results: ScreenerResult[];
  onSymbolClick?: (symbol: string) => void;
};

type SortIconProps = {
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
};

function SortIcon({ field, sortField, sortOrder }: SortIconProps) {
  if (sortField !== field) return null;
  return sortOrder === "asc" ? (
    <ArrowUp className="ml-1 h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 h-3 w-3" />
  );
}

function getStrengthColor(strength: number): string {
  const STRONG_BUY_THRESHOLD = 70;
  const BUY_THRESHOLD = 60;
  const HOLD_THRESHOLD = 40;
  const SELL_THRESHOLD = 30;

  if (strength >= STRONG_BUY_THRESHOLD) return "bg-green-600";
  if (strength >= BUY_THRESHOLD) return "bg-green-500";
  if (strength >= HOLD_THRESHOLD) return "bg-gray-500";
  if (strength >= SELL_THRESHOLD) return "bg-red-500";
  return "bg-red-600";
}

export function ScreenerResultsTable({
  results,
  onSymbolClick,
}: ScreenerResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>("strength");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Deduplicate results - keep only the most recent entry per symbol
  const deduplicatedResults = results.reduce((acc, result) => {
    const existing = acc.get(result.symbol);
    if (!existing || result.timestamp > existing.timestamp) {
      acc.set(result.symbol, result);
    }
    return acc;
  }, new Map<string, ScreenerResult>());

  const uniqueResults = Array.from(deduplicatedResults.values());

  const sortedResults = [...uniqueResults].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortField) {
      case "symbol":
        return sortOrder === "asc"
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      case "strength":
        aValue = a.signals.strength;
        bValue = b.signals.strength;
        break;
      case "price":
        aValue = a.price.current;
        bValue = b.price.current;
        break;
      case "change":
        aValue = a.price.changePercent24h;
        bValue = b.price.changePercent24h;
        break;
      case "volume":
        aValue = a.price.volume24h;
        bValue = b.price.volume24h;
        break;
      default:
        return 0;
    }

    return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
  });

  const PRICE_THOUSAND = 1000;
  const PRICE_ONE = 1;
  const VOLUME_BILLION = 1_000_000_000;
  const VOLUME_MILLION = 1_000_000;
  const VOLUME_THOUSAND = 1000;
  const DECIMAL_2 = 2;
  const DECIMAL_4 = 4;
  const DECIMAL_8 = 8;

  const formatPrice = (price: number) => {
    if (price >= PRICE_THOUSAND) {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: DECIMAL_2,
        maximumFractionDigits: DECIMAL_2,
      });
    }
    if (price >= PRICE_ONE) {
      return price.toFixed(DECIMAL_4);
    }
    return price.toFixed(DECIMAL_8);
  };

  const formatVolume = (volume: number) => {
    if (volume >= VOLUME_BILLION) {
      return `${(volume / VOLUME_BILLION).toFixed(DECIMAL_2)}B`;
    }
    if (volume >= VOLUME_MILLION) {
      return `${(volume / VOLUME_MILLION).toFixed(DECIMAL_2)}M`;
    }
    if (volume >= VOLUME_THOUSAND) {
      return `${(volume / VOLUME_THOUSAND).toFixed(DECIMAL_2)}K`;
    }
    return volume.toFixed(DECIMAL_2);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button
                className="h-8 px-2"
                onClick={() => handleSort("symbol")}
                size="sm"
                variant="ghost"
              >
                Symbol
                <SortIcon field="symbol" sortField={sortField} sortOrder={sortOrder} />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                className="h-8 px-2"
                onClick={() => handleSort("price")}
                size="sm"
                variant="ghost"
              >
                Price
                <SortIcon field="price" sortField={sortField} sortOrder={sortOrder} />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                className="h-8 px-2"
                onClick={() => handleSort("change")}
                size="sm"
                variant="ghost"
              >
                24h Change
                <SortIcon field="change" sortField={sortField} sortOrder={sortOrder} />
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button
                className="h-8 px-2"
                onClick={() => handleSort("volume")}
                size="sm"
                variant="ghost"
              >
                Volume
                <SortIcon field="volume" sortField={sortField} sortOrder={sortOrder} />
              </Button>
            </TableHead>
            <TableHead>
              <Button
                className="h-8 px-2"
                onClick={() => handleSort("strength")}
                size="sm"
                variant="ghost"
              >
                Signal
                <SortIcon field="strength" sortField={sortField} sortOrder={sortOrder} />
              </Button>
            </TableHead>
            <TableHead>Recommendation</TableHead>
            <TableHead>Trend</TableHead>
            <TableHead>Momentum</TableHead>
            <TableHead>RSI</TableHead>
            <TableHead>ADX</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedResults.length === 0 ? (
            <TableRow>
              <TableCell
                className="py-8 text-center text-muted-foreground"
                colSpan={10}
              >
                No results available. Run a screening to see data.
              </TableCell>
            </TableRow>
          ) : (
            sortedResults.map((result) => (
              <TableRow className="hover:bg-muted/50" key={result.symbol}>
                <TableCell>
                  <Button
                    className="h-auto p-0 font-mono font-semibold"
                    onClick={() => onSymbolClick?.(result.symbol)}
                    variant="link"
                  >
                    {result.symbol}
                  </Button>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatPrice(result.price.current)}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className={`flex items-center justify-end gap-1 ${
                      result.price.changePercent24h >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {result.price.changePercent24h >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="font-mono">
                      {result.price.changePercent24h > 0 ? "+" : ""}
                      {result.price.changePercent24h.toFixed(2)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  ${formatVolume(result.price.volume24h)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-16 rounded-full bg-secondary">
                      <div
                        className={`h-2 rounded-full ${getStrengthColor(result.signals.strength)}`}
                        style={{ width: `${result.signals.strength}%` }}
                      />
                    </div>
                    <span className="w-8 font-mono text-xs">
                      {result.signals.strength}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      BADGE_COLORS.recommendation[result.signals.recommendation]
                    }
                  >
                    {result.signals.recommendation.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={BADGE_COLORS.trend[result.signals.trend]}>
                    {result.signals.trend}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={BADGE_COLORS.momentum[result.signals.momentum]}
                  >
                    {result.signals.momentum}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {result.indicators.rsi?.toFixed(1) ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {result.indicators.adx?.toFixed(1) ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
