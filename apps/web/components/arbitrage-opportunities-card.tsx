/**
 * Arbitrage Opportunities Card
 * Displays profitable arbitrage opportunities across exchanges
 */

import {
  AlertCircle,
  ArrowRight,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useArbitrageOpportunities } from "../hooks/use-aggregated-prices";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

const PRICE_DECIMALS = 4;
const VOLUME_MILLION = 1_000_000;
const VOLUME_THOUSAND = 1000;

function formatVolume(volume: number): string {
  if (volume >= VOLUME_MILLION)
    return `${(volume / VOLUME_MILLION).toFixed(2)}M`;
  if (volume >= VOLUME_THOUSAND)
    return `${(volume / VOLUME_THOUSAND).toFixed(2)}K`;
  return volume.toFixed(2);
}

export function ArbitrageOpportunitiesCard() {
  const [minSpread, setMinSpread] = useState(0.1);
  const [limit, setLimit] = useState(20);

  const {
    data: opportunities,
    isLoading,
    error,
    refetch,
  } = useArbitrageOpportunities(minSpread, limit, true);

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Arbitrage Opportunities
            {opportunities && (
              <Badge className="ml-2" variant="secondary">
                {opportunities.length}
              </Badge>
            )}
          </CardTitle>
          <Button onClick={handleRefresh} size="sm" variant="ghost">
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minSpread">Min Spread (%)</Label>
            <Input
              id="minSpread"
              max={5}
              min={0.01}
              onChange={(e) => setMinSpread(Number.parseFloat(e.target.value))}
              step={0.01}
              type="number"
              value={minSpread}
            />
          </div>
          <div>
            <Label htmlFor="limit">Limit</Label>
            <Input
              id="limit"
              max={100}
              min={5}
              onChange={(e) => setLimit(Number.parseInt(e.target.value, 10))}
              type="number"
              value={limit}
            />
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>Error: {error.message}</span>
          </div>
        )}

        {opportunities && opportunities.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <TrendingUp className="mx-auto mb-2 h-12 w-12" />
            <p className="font-medium">No Arbitrage Opportunities</p>
            <p className="text-sm">
              Try lowering the minimum spread percentage
            </p>
          </div>
        )}

        {opportunities && opportunities.length > 0 && (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Spread</TableHead>
                  <TableHead>Buy From</TableHead>
                  <TableHead>Sell To</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((opp, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium font-mono">
                      {opp.symbol}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          opp.spread_percent > 1 ? "destructive" : "secondary"
                        }
                      >
                        {opp.spread_percent.toFixed(2)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {opp.low_exchange}
                        </span>
                        <span className="font-mono text-green-400 text-xs">
                          ${opp.low_price.toFixed(PRICE_DECIMALS)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {opp.high_exchange}
                          </span>
                          <span className="font-mono text-red-400 text-xs">
                            ${opp.high_price.toFixed(PRICE_DECIMALS)}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-semibold text-green-400">
                          $
                          {(opp.high_price - opp.low_price).toFixed(
                            PRICE_DECIMALS
                          )}
                        </span>
                        <span className="text-slate-400 text-xs">
                          Vol: {formatVolume(opp.total_volume)}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
