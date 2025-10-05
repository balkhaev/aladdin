import { useState } from "react";
import {
  type BacktestParams,
  type BacktestStrategy,
  getStrategyDescription,
  getStrategyParameters,
} from "../lib/api/backtest";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type BacktestFormProps = {
  onSubmit: (params: BacktestParams) => void;
  isLoading?: boolean;
};

export function BacktestForm({ onSubmit, isLoading }: BacktestFormProps) {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [strategy, setStrategy] = useState<BacktestStrategy>("SMA_CROSSOVER");
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // 3 months ago
    return date.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [initialBalance, setInitialBalance] = useState(10_000);
  const [parameters, setParameters] = useState<Record<string, number>>({});
  const [timeframe, setTimeframe] = useState<BacktestParams["timeframe"]>("1h");

  const strategyParams = getStrategyParameters(strategy);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSubmit({
      symbol,
      strategy,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      initialBalance,
      parameters,
      timeframe,
    });
  };

  const handleStrategyChange = (newStrategy: BacktestStrategy) => {
    setStrategy(newStrategy);
    // Reset parameters when strategy changes
    const params = getStrategyParameters(newStrategy);
    const defaultParams: Record<string, number> = {};
    for (const param of params) {
      defaultParams[param.name] = param.defaultValue;
    }
    setParameters(defaultParams);
  };

  const handleParameterChange = (name: string, value: number) => {
    setParameters((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backtest Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Symbol */}
          <div className="space-y-2">
            <Label htmlFor="symbol">Trading Pair</Label>
            <Input
              id="symbol"
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="BTCUSDT"
              required
              value={symbol}
            />
          </div>

          {/* Strategy */}
          <div className="space-y-2">
            <Label htmlFor="strategy">Strategy</Label>
            <Select
              onValueChange={(value) =>
                handleStrategyChange(value as BacktestStrategy)
              }
              value={strategy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SMA_CROSSOVER">SMA Crossover</SelectItem>
                <SelectItem value="RSI">RSI Oversold/Overbought</SelectItem>
                <SelectItem value="MACD">MACD Crossover</SelectItem>
                <SelectItem value="BOLLINGER_BANDS">
                  Bollinger Bands Bounce
                </SelectItem>
                <SelectItem value="CUSTOM">Custom Strategy</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {getStrategyDescription(strategy)}
            </p>
          </div>

          {/* Timeframe */}
          <div className="space-y-2">
            <Label htmlFor="timeframe">Timeframe</Label>
            <Select
              onValueChange={(value) =>
                setTimeframe(value as BacktestParams["timeframe"])
              }
              value={timeframe}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">1 Minute</SelectItem>
                <SelectItem value="5m">5 Minutes</SelectItem>
                <SelectItem value="15m">15 Minutes</SelectItem>
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="4h">4 Hours</SelectItem>
                <SelectItem value="1d">1 Day</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Smaller timeframes provide more detail but take longer to process
            </p>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">From Date</Label>
              <Input
                id="from"
                onChange={(e) => setFrom(e.target.value)}
                required
                type="date"
                value={from}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To Date</Label>
              <Input
                id="to"
                onChange={(e) => setTo(e.target.value)}
                required
                type="date"
                value={to}
              />
            </div>
          </div>

          {/* Initial Balance */}
          <div className="space-y-2">
            <Label htmlFor="initialBalance">Initial Balance (USDT)</Label>
            <Input
              id="initialBalance"
              min={100}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              required
              step={100}
              type="number"
              value={initialBalance}
            />
          </div>

          {/* Strategy Parameters */}
          {strategyParams.length > 0 && (
            <div className="space-y-3">
              <Label>Strategy Parameters</Label>
              {strategyParams.map((param) => (
                <div className="space-y-1" key={param.name}>
                  <Label className="text-sm" htmlFor={param.name}>
                    {param.label}
                  </Label>
                  <Input
                    id={param.name}
                    max={param.max}
                    min={param.min}
                    onChange={(e) =>
                      handleParameterChange(param.name, Number(e.target.value))
                    }
                    type="number"
                    value={parameters[param.name] || param.defaultValue}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Submit Button */}
          <Button className="w-full" disabled={isLoading} type="submit">
            {isLoading ? "Running Backtest..." : "Run Backtest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
