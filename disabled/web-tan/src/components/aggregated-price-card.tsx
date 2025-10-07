/**
 * Aggregated Price Card
 * Displays VWAP and multi-exchange price comparison
 */

import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { useAggregatedPrice } from "../hooks/use-aggregated-prices";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

type AggregatedPriceCardProps = {
  symbol: string;
};

const PERCENTAGE_MULTIPLIER = 100;
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

export function AggregatedPriceCard({ symbol }: AggregatedPriceCardProps) {
  const { data, isLoading, error } = useAggregatedPrice(symbol);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Aggregated Price - {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent>
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

        {data && (
          <div className="space-y-6">
            {/* VWAP */}
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-slate-400 text-sm">
                  VWAP (Volume Weighted Average)
                </span>
                <Badge variant="outline">
                  {data.exchanges_count} exchanges
                </Badge>
              </div>
              <p className="font-bold font-mono text-3xl text-blue-400">
                ${data.vwap.toFixed(PRICE_DECIMALS)}
              </p>
              <p className="mt-1 text-slate-400 text-sm">
                Avg: ${data.avg_price.toFixed(PRICE_DECIMALS)} | Volume:{" "}
                {formatVolume(data.total_volume)}
              </p>
            </div>

            {/* Exchange Prices */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Exchange Prices</h3>

              {/* Binance */}
              {data.binance_price && (
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <div>
                    <p className="font-medium text-sm">Binance</p>
                    <p className="text-slate-400 text-xs">
                      Vol: {formatVolume(data.binance_volume)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      ${data.binance_price.toFixed(PRICE_DECIMALS)}
                    </p>
                    <p
                      className={`text-xs ${
                        data.binance_price > data.vwap
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {data.binance_price > data.vwap ? "+" : ""}
                      {(
                        ((data.binance_price - data.vwap) / data.vwap) *
                        PERCENTAGE_MULTIPLIER
                      ).toFixed(2)}
                      %
                    </p>
                  </div>
                </div>
              )}

              {/* Bybit */}
              {data.bybit_price && (
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <div>
                    <p className="font-medium text-sm">Bybit</p>
                    <p className="text-slate-400 text-xs">
                      Vol: {formatVolume(data.bybit_volume)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      ${data.bybit_price.toFixed(PRICE_DECIMALS)}
                    </p>
                    <p
                      className={`text-xs ${
                        data.bybit_price > data.vwap
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {data.bybit_price > data.vwap ? "+" : ""}
                      {(
                        ((data.bybit_price - data.vwap) / data.vwap) *
                        PERCENTAGE_MULTIPLIER
                      ).toFixed(2)}
                      %
                    </p>
                  </div>
                </div>
              )}

              {/* OKX */}
              {data.okx_price && (
                <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <div>
                    <p className="font-medium text-sm">OKX</p>
                    <p className="text-slate-400 text-xs">
                      Vol: {formatVolume(data.okx_volume)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">
                      ${data.okx_price.toFixed(PRICE_DECIMALS)}
                    </p>
                    <p
                      className={`text-xs ${
                        data.okx_price > data.vwap
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {data.okx_price > data.vwap ? "+" : ""}
                      {(
                        ((data.okx_price - data.vwap) / data.vwap) *
                        PERCENTAGE_MULTIPLIER
                      ).toFixed(2)}
                      %
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Spread Info */}
            {data.max_spread_percent > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Max Spread</span>
                  <Badge
                    variant={
                      data.max_spread_percent > 0.5
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {data.max_spread_percent.toFixed(2)}%
                  </Badge>
                </div>
                <Progress value={Math.min(data.max_spread_percent * 20, 100)} />
                {data.max_spread_exchange_high &&
                  data.max_spread_exchange_low && (
                    <p className="text-slate-400 text-xs">
                      {data.max_spread_exchange_high} (high) →{" "}
                      {data.max_spread_exchange_low} (low)
                    </p>
                  )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
