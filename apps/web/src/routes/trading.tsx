/**
 * Trading Terminal Page
 * Complete trading interface with charts, order form, and tables
 */

import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import {
  Activity,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CombinedSentimentCard } from "../components/combined-sentiment-card";
import { ExchangeSelector } from "../components/exchange-selector";
import { FundingRatesCard } from "../components/futures/funding-rates-card";
import { FuturesMetricsCompact } from "../components/futures/futures-metrics-compact";
import { OpenInterestCard } from "../components/futures/open-interest-card";
import { FuturesPositionsTable } from "../components/futures-positions-table";
import type { Indicator } from "../components/indicator-controls";
import { IndicatorControls } from "../components/indicator-controls";
import { MLPredictionCard } from "../components/ml-prediction-card";
import { OrderBook } from "../components/order-book";
import { OrderForm } from "../components/order-form";
import { OrdersTable } from "../components/orders-table";
import { RecentTrades } from "../components/recent-trades";
import { SymbolCombobox } from "../components/symbol-combobox";
import { TradingChart } from "../components/trading-chart";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Switch } from "../components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { useAllSymbols } from "../hooks/use-market-data";
import { useExchange } from "../lib/exchange-context";

type TradingSearchParams = {
  symbol?: string;
};

export const Route = createFileRoute("/trading")({
  component: TradingPage,
  validateSearch: (search: Record<string, unknown>): TradingSearchParams => ({
    symbol: search.symbol as string | undefined,
  }),
});

function TradingPage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/trading" });
  const { selectedCredential } = useExchange();

  // Загружаем ВСЕ доступные символы с Binance
  const { data: allSymbolsData } = useAllSymbols();

  // Преобразуем в формат для комбобокса
  const symbols = useMemo(() => {
    if (!allSymbolsData) {
      // Дефолтные символы пока загружаются
      return [
        { value: "BTCUSDT", label: "BTC/USDT" },
        { value: "ETHUSDT", label: "ETH/USDT" },
        { value: "BNBUSDT", label: "BNB/USDT" },
      ];
    }

    return allSymbolsData.map((symbol) => ({
      value: symbol,
      label: symbol.replace("USDT", "/USDT"),
    }));
  }, [allSymbolsData]);

  // Используем символ из URL или дефолтный BTCUSDT (только при первой загрузке)
  const [selectedSymbol, setSelectedSymbol] = useState(
    () => searchParams.symbol?.toUpperCase() || "BTCUSDT"
  );
  const [interval, setInterval] = useState<"1m" | "5m" | "15m" | "1h" | "1d">(
    "15m"
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<Indicator[]>([]);
  const [showMLPrediction, setShowMLPrediction] = useState(false);

  // Get selected exchange from context, default to bybit
  const selectedExchange = selectedCredential?.exchange || "bybit";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Compact Header */}
      <div className="border-border/50 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex h-12 items-center gap-3 px-4">
          <Button
            className="h-8 px-2"
            onClick={() => navigate({ to: "/" })}
            size="sm"
            variant="ghost"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Назад
          </Button>
          <div className="h-6 w-px bg-border/50" />
          <SymbolCombobox
            onValueChange={setSelectedSymbol}
            symbols={symbols}
            value={selectedSymbol}
          />
          <div className="flex gap-1 rounded-md bg-muted/50 p-0.5">
            {(["1m", "5m", "15m", "1h", "1d"] as const).map((int) => (
              <Button
                className={`h-7 px-3 text-xs ${
                  interval === int
                    ? "bg-background shadow-sm"
                    : "hover:bg-background/50"
                }`}
                key={int}
                onClick={() => setInterval(int)}
                size="sm"
                variant={interval === int ? "secondary" : "ghost"}
              >
                {int}
              </Button>
            ))}
          </div>
          <div className="h-6 w-px bg-border/50" />
          <IndicatorControls
            onChange={setSelectedIndicators}
            selected={selectedIndicators}
          />
          <div className="ml-auto flex items-center gap-3">
            <ExchangeSelector />
            <div className="h-6 w-px bg-border/50" />
            <FuturesMetricsCompact symbol={selectedSymbol} />
          </div>
        </div>
      </div>

      {/* Main Trading Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Market Data + Intelligence */}
        <div className="flex w-80 flex-col border-border/50 border-r bg-card/30">
          <Tabs className="flex h-full flex-col gap-0" defaultValue="orderbook">
            <div className="bg-card/50 p-1">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger
                  className="flex items-center gap-1.5 text-xs"
                  value="orderbook"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Book</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex items-center gap-1.5 text-xs"
                  value="trades"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Trades</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex items-center gap-1.5 text-xs"
                  value="sentiment"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">AI</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex items-center gap-1.5 text-xs"
                  value="funding"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">FR</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex items-center gap-1.5 text-xs"
                  value="oi"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">OI</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex items-center gap-1.5 text-xs"
                  value="ml"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">ML</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent forceMount value="orderbook">
                <OrderBook levels={20} symbol={selectedSymbol} />
              </TabsContent>

              <TabsContent forceMount value="trades">
                <RecentTrades maxTrades={30} symbol={selectedSymbol} />
              </TabsContent>

              <TabsContent forceMount value="sentiment">
                <CombinedSentimentCard symbol={selectedSymbol} />
              </TabsContent>

              <TabsContent forceMount value="funding">
                <FundingRatesCard symbol={selectedSymbol} />
              </TabsContent>

              <TabsContent forceMount value="oi">
                <OpenInterestCard symbol={selectedSymbol} />
              </TabsContent>

              <TabsContent forceMount value="ml">
                <MLPredictionCard symbol={selectedSymbol} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Center: Chart Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* ML Toggle */}
          <div className="mb-2 flex items-center justify-end gap-2 px-2">
            <label
              className="flex cursor-pointer items-center gap-2 text-sm"
              htmlFor="ml-toggle"
            >
              <Brain className="h-4 w-4 text-purple-500" />
              <span className="text-muted-foreground">Show ML on Chart</span>
              <Switch
                checked={showMLPrediction}
                id="ml-toggle"
                onCheckedChange={setShowMLPrediction}
              />
            </label>
          </div>

          <div className="h-full flex-1 rounded-lg border border-border/50 bg-card/30 p-1.5 shadow-sm backdrop-blur-sm">
            <TradingChart
              height={600}
              interval={interval}
              selectedIndicators={selectedIndicators}
              showMLPrediction={showMLPrediction}
              symbol={selectedSymbol}
            />
          </div>

          {/* Tables Area - Compact layout */}
          <div className="grid h-72 grid-cols-2 gap-2 border-border/50 border-t bg-card/30 p-2">
            <div className="overflow-auto">
              <FuturesPositionsTable exchange={selectedExchange} />
            </div>
            <div className="overflow-auto">
              <OrdersTable symbol={selectedSymbol} />
            </div>
          </div>
        </div>

        {/* Right: Order Form Panel - Slide from right */}
        <div
          className={`relative flex flex-col border-border/50 border-l bg-card/50 backdrop-blur-sm transition-all duration-300 ease-in-out ${
            isPanelOpen ? "w-80" : "w-0"
          }`}
        >
          {/* Toggle Button */}
          <Button
            aria-label={isPanelOpen ? "Скрыть панель" : "Показать панель"}
            className="-left-6 absolute top-4 z-20 h-12 w-6 rounded-r-none rounded-l-md border border-r-0 bg-card/90 p-0 shadow-lg backdrop-blur-sm hover:bg-card hover:shadow-xl"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            size="sm"
            variant="outline"
          >
            {isPanelOpen ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>

          {isPanelOpen && (
            <ScrollArea className="flex-1">
              <div className="p-3">
                <OrderForm symbol={selectedSymbol} />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
