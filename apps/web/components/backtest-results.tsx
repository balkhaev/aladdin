import {
  createChart,
  LineSeries,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { useCandles } from "../hooks/use-market-data";
import type { BacktestResult } from "../lib/api/backtest";
import { BacktestChart } from "./backtest-chart";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type BacktestResultsProps = {
  result: BacktestResult;
};

// Constants
const RGBA_PATTERN = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/;
const MILLISECONDS_TO_SECONDS = 1000;
const GRID_LINE_OPACITY = 0.1;
const PERCENTAGE_MULTIPLIER = 100;
const QUANTITY_DECIMAL_PLACES = 6;
const CANDLES_LIMIT = 1000;

// Helper function to convert any CSS color to rgba format
const cssColorToRgba = (cssColor: string, fallback: string): string => {
  if (!cssColor || cssColor.includes("oklch")) {
    // If it's oklch or empty, use fallback (lightweight-charts doesn't support oklch)
    return fallback;
  }

  // Try to parse with browser
  const temp = document.createElement("div");
  temp.style.color = cssColor;
  document.body.append(temp);
  const computed = getComputedStyle(temp).color;
  temp.remove();

  // If browser couldn't parse it or returned empty, use fallback
  if (!computed || computed === "" || computed === "rgba(0, 0, 0, 0)") {
    return fallback;
  }

  return computed;
};

// Helper function to set opacity on rgba color
const setRgbaOpacity = (rgba: string, opacity: number): string => {
  // Match rgb/rgba format: rgb(r, g, b) or rgba(r, g, b, a)
  const match = rgba.match(RGBA_PATTERN);
  if (match) {
    const [, r, g, b] = match;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return rgba;
};

export function BacktestResults({ result }: BacktestResultsProps) {
  const equityChartRef = useRef<HTMLDivElement>(null);
  const drawdownChartRef = useRef<HTMLDivElement>(null);

  // Load candles for the backtest period
  // Use the same timeframe that was used for the backtest
  const timeframe = result.timeframe || "1h"; // Default to 1h if not specified
  const { data: candles } = useCandles(result.symbol, timeframe, CANDLES_LIMIT);

  useEffect(() => {
    if (!(equityChartRef.current && drawdownChartRef.current)) return;

    // Get computed CSS colors and convert to rgba
    const computedStyle = getComputedStyle(document.documentElement);
    const foregroundColor = cssColorToRgba(
      computedStyle.getPropertyValue("--color-foreground").trim(),
      "rgba(255, 255, 255, 0.9)"
    );
    const borderColor = cssColorToRgba(
      computedStyle.getPropertyValue("--color-border").trim(),
      "rgba(255, 255, 255, 0.1)"
    );
    const mutedForegroundColor = cssColorToRgba(
      computedStyle.getPropertyValue("--color-muted-foreground").trim(),
      "rgba(255, 255, 255, 0.5)"
    );

    // Calculate equity curve
    const equityDataMap = new Map<number, number>();
    const drawdownDataMap = new Map<number, number>();

    let balance = result.initialBalance;
    let peak = result.initialBalance;

    for (const trade of result.trades) {
      if (trade.type === "SELL" && trade.pnl !== undefined) {
        balance += trade.pnl;
      }

      // Update peak
      if (balance > peak) {
        peak = balance;
      }

      // Calculate drawdown percentage
      const drawdown =
        peak > 0 ? ((balance - peak) / peak) * PERCENTAGE_MULTIPLIER : 0;

      const time = Math.floor(
        trade.timestamp.getTime() / MILLISECONDS_TO_SECONDS
      );

      // Store latest value for each timestamp (handles multiple trades at same time)
      equityDataMap.set(time, balance);
      drawdownDataMap.set(time, drawdown);
    }

    // Convert maps to sorted arrays
    const equityData = Array.from(equityDataMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as UTCTimestamp, value }));

    const drawdownData = Array.from(drawdownDataMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time: time as UTCTimestamp, value }));

    // Create equity curve chart
    const equityChart = createChart(equityChartRef.current, {
      width: equityChartRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: foregroundColor,
      },
      grid: {
        vertLines: { color: setRgbaOpacity(borderColor, GRID_LINE_OPACITY) },
        horzLines: { color: setRgbaOpacity(borderColor, GRID_LINE_OPACITY) },
      },
      rightPriceScale: {
        borderColor,
      },
      timeScale: {
        borderColor,
        timeVisible: true,
      },
    });

    const equitySeries = equityChart.addSeries(LineSeries, {
      color: result.totalReturn >= 0 ? "#22c55e" : "#ef4444",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    equitySeries.setData(equityData);

    // Add initial balance line (only if we have data)
    if (equityData.length > 0) {
      const lastEquityPoint = equityData.at(-1);
      if (lastEquityPoint) {
        equityChart
          .addSeries(LineSeries, {
            color: mutedForegroundColor,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceFormat: {
              type: "price",
              precision: 2,
              minMove: 0.01,
            },
          })
          .setData([
            { time: equityData[0].time, value: result.initialBalance },
            {
              time: lastEquityPoint.time,
              value: result.initialBalance,
            },
          ]);
      }
    }

    // Create drawdown chart
    const drawdownChart = createChart(drawdownChartRef.current, {
      width: drawdownChartRef.current.clientWidth,
      height: 200,
      layout: {
        background: { color: "transparent" },
        textColor: foregroundColor,
      },
      grid: {
        vertLines: { color: setRgbaOpacity(borderColor, GRID_LINE_OPACITY) },
        horzLines: { color: setRgbaOpacity(borderColor, GRID_LINE_OPACITY) },
      },
      rightPriceScale: {
        borderColor,
      },
      timeScale: {
        borderColor,
        timeVisible: true,
      },
    });

    const drawdownSeries = drawdownChart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 2,
      priceFormat: {
        type: "percent",
        precision: 2,
        minMove: 0.01,
      },
    });

    drawdownSeries.setData(drawdownData);

    // Handle window resize with ResizeObserver for better detection of visibility changes
    const handleResize = () => {
      if (equityChartRef.current && drawdownChartRef.current) {
        const equityWidth = equityChartRef.current.clientWidth;
        const drawdownWidth = drawdownChartRef.current.clientWidth;

        if (equityWidth > 0) {
          equityChart.applyOptions({ width: equityWidth });
        }
        if (drawdownWidth > 0) {
          drawdownChart.applyOptions({ width: drawdownWidth });
        }
      }
    };

    // Use ResizeObserver to detect container size changes (including when tab becomes visible)
    const equityResizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    const drawdownResizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    equityResizeObserver.observe(equityChartRef.current);
    drawdownResizeObserver.observe(drawdownChartRef.current);

    // Also listen to window resize
    window.addEventListener("resize", handleResize);

    // Initial resize
    handleResize();

    return () => {
      equityResizeObserver.disconnect();
      drawdownResizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      equityChart.remove();
      drawdownChart.remove();
    };
  }, [result]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);

  const formatPercent = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Price Chart with Trade Markers */}
      {candles && candles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Price Chart with Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <BacktestChart
              candles={candles}
              height={400}
              symbol={result.symbol}
              trades={result.trades}
            />
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Backtest Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Strategy</p>
              <p className="font-semibold text-lg">{result.strategy}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Symbol</p>
              <p className="font-semibold text-lg">{result.symbol}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Initial Balance</p>
              <p className="font-semibold text-lg">
                {formatCurrency(result.initialBalance)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Final Balance</p>
              <p className="font-semibold text-lg">
                {formatCurrency(result.finalBalance)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Total Return</p>
              <p
                className={`font-semibold text-lg ${
                  result.totalReturn >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {formatCurrency(result.totalReturn)} (
                {formatPercent(result.totalReturnPercent)})
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Total Trades</p>
              <p className="font-semibold text-lg">{result.totalTrades}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Win Rate</p>
              <p className="font-semibold text-lg">
                {formatPercent(result.winRate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Max Drawdown</p>
              <p className="font-semibold text-lg text-red-500">
                {formatPercent(result.maxDrawdown)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Winning Trades</p>
              <p className="font-semibold text-green-500 text-lg">
                {result.winningTrades}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Losing Trades</p>
              <p className="font-semibold text-lg text-red-500">
                {result.losingTrades}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Sharpe Ratio</p>
              <p className="font-semibold text-lg">
                {result.sharpeRatio !== null &&
                !Number.isNaN(result.sharpeRatio)
                  ? result.sharpeRatio.toFixed(2)
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equity Curve */}
      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full" ref={equityChartRef} />
        </CardContent>
      </Card>

      {/* Drawdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Drawdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full" ref={drawdownChartRef} />
        </CardContent>
      </Card>

      {/* Trade Log */}
      <Card>
        <CardHeader>
          <CardTitle>Trade Log ({result.trades.length} trades)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.trades.map((trade, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs">
                    {trade.timestamp.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={trade.type === "BUY" ? "default" : "destructive"}
                    >
                      {trade.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(trade.price)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {trade.quantity.toFixed(QUANTITY_DECIMAL_PLACES)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {trade.pnl !== undefined ? (
                      <span
                        className={
                          trade.pnl >= 0 ? "text-green-500" : "text-red-500"
                        }
                      >
                        {formatCurrency(trade.pnl)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
