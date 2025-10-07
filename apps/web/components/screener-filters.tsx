import { Filter, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { ScreenerResult } from "@/lib/api/screener";

type FilterConfig = {
  recommendation?: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  trend?: "BULLISH" | "BEARISH" | "NEUTRAL";
  momentum?: "STRONG" | "MODERATE" | "WEAK";
  volatility?: "HIGH" | "MEDIUM" | "LOW";
  minStrength: number;
  maxStrength: number;
  minRsi?: number;
  maxRsi?: number;
  minPrice?: number;
  maxPrice?: number;
  search: string;
};

type ScreenerFiltersProps = {
  results: ScreenerResult[];
  onFilteredResults: (filtered: ScreenerResult[]) => void;
};

const MIN_STRENGTH = 0;
const MAX_STRENGTH = 100;

const DEFAULT_FILTERS: FilterConfig = {
  minStrength: MIN_STRENGTH,
  maxStrength: MAX_STRENGTH,
  search: "",
};

export function ScreenerFilters({
  results,
  onFilteredResults,
}: ScreenerFiltersProps) {
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const applyFilters = (newFilters: FilterConfig) => {
    let filtered = [...results];

    // Search by symbol
    if (newFilters.search) {
      filtered = filtered.filter((r) =>
        r.symbol.toLowerCase().includes(newFilters.search.toLowerCase())
      );
    }

    // Signal strength
    filtered = filtered.filter(
      (r) =>
        r.signals.strength >= newFilters.minStrength &&
        r.signals.strength <= newFilters.maxStrength
    );

    // Recommendation
    if (newFilters.recommendation) {
      filtered = filtered.filter(
        (r) => r.signals.recommendation === newFilters.recommendation
      );
    }

    // Trend
    if (newFilters.trend) {
      filtered = filtered.filter((r) => r.signals.trend === newFilters.trend);
    }

    // Momentum
    if (newFilters.momentum) {
      filtered = filtered.filter(
        (r) => r.signals.momentum === newFilters.momentum
      );
    }

    // Volatility
    if (newFilters.volatility) {
      filtered = filtered.filter(
        (r) => r.signals.volatility === newFilters.volatility
      );
    }

    // RSI range
    if (newFilters.minRsi !== undefined || newFilters.maxRsi !== undefined) {
      filtered = filtered.filter((r) => {
        if (!r.indicators.rsi) return false;
        const minOk =
          newFilters.minRsi === undefined ||
          r.indicators.rsi >= newFilters.minRsi;
        const maxOk =
          newFilters.maxRsi === undefined ||
          r.indicators.rsi <= newFilters.maxRsi;
        return minOk && maxOk;
      });
    }

    // Price range
    if (
      newFilters.minPrice !== undefined ||
      newFilters.maxPrice !== undefined
    ) {
      filtered = filtered.filter((r) => {
        const minOk =
          newFilters.minPrice === undefined ||
          r.price.current >= newFilters.minPrice;
        const maxOk =
          newFilters.maxPrice === undefined ||
          r.price.current <= newFilters.maxPrice;
        return minOk && maxOk;
      });
    }

    onFilteredResults(filtered);
  };

  const updateFilter = <K extends keyof FilterConfig>(
    key: K,
    value: FilterConfig[K]
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    onFilteredResults(results);
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "minStrength" && value === MIN_STRENGTH) return false;
    if (key === "maxStrength" && value === MAX_STRENGTH) return false;
    if (key === "search" && !value) return false;
    return value !== undefined && value !== "";
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          className="max-w-xs"
          onChange={(e) => updateFilter("search", e.target.value)}
          placeholder="Search symbols..."
          value={filters.search}
        />
        <Button
          className="gap-2"
          onClick={() => setShowFilters(!showFilters)}
          size="sm"
          variant="outline"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge className="ml-1" variant="secondary">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button
            className="gap-2"
            onClick={clearFilters}
            size="sm"
            variant="ghost"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Recommendation</Label>
                <Select
                  onValueChange={(value) =>
                    updateFilter(
                      "recommendation",
                      value === "all"
                        ? undefined
                        : (value as FilterConfig["recommendation"])
                    )
                  }
                  value={filters.recommendation ?? "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="STRONG_BUY">Strong Buy</SelectItem>
                    <SelectItem value="BUY">Buy</SelectItem>
                    <SelectItem value="HOLD">Hold</SelectItem>
                    <SelectItem value="SELL">Sell</SelectItem>
                    <SelectItem value="STRONG_SELL">Strong Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Trend</Label>
                <Select
                  onValueChange={(value) =>
                    updateFilter(
                      "trend",
                      value === "all"
                        ? undefined
                        : (value as FilterConfig["trend"])
                    )
                  }
                  value={filters.trend ?? "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="BULLISH">Bullish</SelectItem>
                    <SelectItem value="NEUTRAL">Neutral</SelectItem>
                    <SelectItem value="BEARISH">Bearish</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Momentum</Label>
                <Select
                  onValueChange={(value) =>
                    updateFilter(
                      "momentum",
                      value === "all"
                        ? undefined
                        : (value as FilterConfig["momentum"])
                    )
                  }
                  value={filters.momentum ?? "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="STRONG">Strong</SelectItem>
                    <SelectItem value="MODERATE">Moderate</SelectItem>
                    <SelectItem value="WEAK">Weak</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Volatility</Label>
                <Select
                  onValueChange={(value) =>
                    updateFilter(
                      "volatility",
                      value === "all"
                        ? undefined
                        : (value as FilterConfig["volatility"])
                    )
                  }
                  value={filters.volatility ?? "all"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Signal Strength: {filters.minStrength} - {filters.maxStrength}
                </Label>
                <Slider
                  max={100}
                  min={0}
                  onValueChange={([min, max]) => {
                    const newFilters = {
                      ...filters,
                      minStrength: min,
                      maxStrength: max,
                    };
                    setFilters(newFilters);
                    applyFilters(newFilters);
                  }}
                  step={5}
                  value={[filters.minStrength, filters.maxStrength]}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min RSI</Label>
                  <Input
                    max={100}
                    min={0}
                    onChange={(e) =>
                      updateFilter(
                        "minRsi",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="0"
                    type="number"
                    value={filters.minRsi ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max RSI</Label>
                  <Input
                    max={100}
                    min={0}
                    onChange={(e) =>
                      updateFilter(
                        "maxRsi",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="100"
                    type="number"
                    value={filters.maxRsi ?? ""}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Min Price ($)</Label>
                  <Input
                    min={0}
                    onChange={(e) =>
                      updateFilter(
                        "minPrice",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="0"
                    step={0.01}
                    type="number"
                    value={filters.minPrice ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Price ($)</Label>
                  <Input
                    min={0}
                    onChange={(e) =>
                      updateFilter(
                        "maxPrice",
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="No limit"
                    step={0.01}
                    type="number"
                    value={filters.maxPrice ?? ""}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
