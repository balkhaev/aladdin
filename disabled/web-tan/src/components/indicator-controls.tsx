import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export type Indicator = "EMA" | "SMA" | "RSI" | "MACD" | "BB";

type IndicatorControlsProps = {
  selected: Indicator[];
  onChange: (indicators: Indicator[]) => void;
};

const AVAILABLE_INDICATORS: Array<{
  value: Indicator;
  label: string;
  description: string;
}> = [
  {
    value: "EMA",
    label: "EMA (12, 26)",
    description: "Exponential Moving Average",
  },
  {
    value: "SMA",
    label: "SMA (20, 50, 200)",
    description: "Simple Moving Average",
  },
  { value: "RSI", label: "RSI (14)", description: "Relative Strength Index" },
  {
    value: "MACD",
    label: "MACD",
    description: "Moving Average Convergence Divergence",
  },
  {
    value: "BB",
    label: "Bollinger Bands",
    description: "Volatility Indicator",
  },
];

export function IndicatorControls({
  selected,
  onChange,
}: IndicatorControlsProps) {
  const [open, setOpen] = useState(false);

  const toggleIndicator = (indicator: Indicator) => {
    if (selected.includes(indicator)) {
      onChange(selected.filter((i) => i !== indicator));
    } else {
      onChange([...selected, indicator]);
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <TrendingUp className="mr-2 h-4 w-4" />
          Indicators {selected.length > 0 && `(${selected.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <Card className="border-0 shadow-none">
          <CardContent className="space-y-3 p-0">
            <div className="font-semibold text-sm">Technical Indicators</div>
            {AVAILABLE_INDICATORS.map((indicator) => (
              <div className="flex items-start space-x-2" key={indicator.value}>
                <Checkbox
                  checked={selected.includes(indicator.value)}
                  id={indicator.value}
                  onCheckedChange={() => toggleIndicator(indicator.value)}
                />
                <div className="flex-1 space-y-0.5">
                  <Label
                    className="cursor-pointer font-medium text-sm leading-none"
                    htmlFor={indicator.value}
                  >
                    {indicator.label}
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    {indicator.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
