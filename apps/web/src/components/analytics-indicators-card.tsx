/**
 * Technical Indicators Card Component
 * Отображает технические индикаторы (RSI, MACD, EMA, SMA, BB)
 */

import { Activity, TrendingUp } from "lucide-react";
import { useIndicators } from "../hooks/use-analytics";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type AnalyticsIndicatorsCardProps = {
  symbol: string;
  timeframe?: string;
};

export function AnalyticsIndicatorsCard({
  symbol,
  timeframe = "15m",
}: AnalyticsIndicatorsCardProps) {
  const { data: indicators, isLoading } = useIndicators({
    symbol,
    timeframe,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Технические индикаторы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (!indicators) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Технические индикаторы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Нет данных по индикаторам
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRSIColor = (value: number) => {
    if (value > 70) return "text-red-600";
    if (value < 30) return "text-green-600";
    return "text-gray-600";
  };

  const getRSISignalBadge = (signal: string) => {
    switch (signal) {
      case "overbought":
        return (
          <Badge className="bg-red-100 text-red-700" variant="secondary">
            Перекуплен
          </Badge>
        );
      case "oversold":
        return (
          <Badge className="bg-green-100 text-green-700" variant="secondary">
            Перепродан
          </Badge>
        );
      default:
        return <Badge variant="secondary">Нейтрально</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Технические индикаторы
          </CardTitle>
          <Badge variant="outline">
            {symbol} · {timeframe}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="rsi">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="rsi">RSI</TabsTrigger>
            <TabsTrigger value="macd">MACD</TabsTrigger>
            <TabsTrigger value="ema">EMA</TabsTrigger>
            <TabsTrigger value="sma">SMA</TabsTrigger>
            <TabsTrigger value="bb">BB</TabsTrigger>
          </TabsList>

          {/* RSI */}
          <TabsContent className="mt-4 space-y-4" value="rsi">
            {indicators.rsi ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      RSI (14)
                    </span>
                    {getRSISignalBadge(indicators.rsi.signal)}
                  </div>
                  <p
                    className={`font-bold text-3xl ${getRSIColor(indicators.rsi.value)}`}
                  >
                    {indicators.rsi.value.toFixed(2)}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 via-gray-500 to-red-500"
                      style={{ width: `${indicators.rsi.value}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-green-600">30 (Перепродан)</span>
                    <span className="text-gray-600">50</span>
                    <span className="text-red-600">70 (Перекуплен)</span>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium">Интерпретация:</p>
                  <p className="mt-1 text-muted-foreground">
                    {indicators.rsi.value > 70 &&
                      "RSI выше 70 указывает на перекупленность. Возможна коррекция вниз."}
                    {indicators.rsi.value < 30 &&
                      "RSI ниже 30 указывает на перепроданность. Возможен отскок вверх."}
                    {indicators.rsi.value >= 30 &&
                      indicators.rsi.value <= 70 &&
                      "RSI в нейтральной зоне. Нет явных сигналов перекупленности или перепроданности."}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">RSI недоступен</p>
            )}
          </TabsContent>

          {/* MACD */}
          <TabsContent className="mt-4 space-y-4" value="macd">
            {indicators.macd ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">MACD</p>
                    <p className="font-semibold">
                      {indicators.macd.macd.toFixed(4)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Signal</p>
                    <p className="font-semibold">
                      {indicators.macd.signal.toFixed(4)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">Histogram</p>
                    <p
                      className={`font-semibold ${
                        indicators.macd.histogram > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {indicators.macd.histogram.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium">Интерпретация:</p>
                  <p className="mt-1 text-muted-foreground">
                    {indicators.macd.histogram > 0
                      ? "MACD выше сигнальной линии - бычий сигнал"
                      : "MACD ниже сигнальной линии - медвежий сигнал"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">MACD недоступен</p>
            )}
          </TabsContent>

          {/* EMA */}
          <TabsContent className="mt-4 space-y-4" value="ema">
            {indicators.ema ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      EMA 12
                    </span>
                    <span className="font-semibold">
                      ${indicators.ema.ema12.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      EMA 26
                    </span>
                    <span className="font-semibold">
                      ${indicators.ema.ema26.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium">Интерпретация:</p>
                  <p className="mt-1 text-muted-foreground">
                    {indicators.ema.ema12 > indicators.ema.ema26
                      ? "EMA 12 выше EMA 26 - бычий тренд"
                      : "EMA 12 ниже EMA 26 - медвежий тренд"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">EMA недоступна</p>
            )}
          </TabsContent>

          {/* SMA */}
          <TabsContent className="mt-4 space-y-4" value="sma">
            {indicators.sma ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      SMA 20
                    </span>
                    <span className="font-semibold">
                      ${indicators.sma.sma20.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      SMA 50
                    </span>
                    <span className="font-semibold">
                      ${indicators.sma.sma50.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      SMA 200
                    </span>
                    <span className="font-semibold">
                      ${indicators.sma.sma200.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium">Интерпретация:</p>
                  <p className="mt-1 text-muted-foreground">
                    {indicators.sma.sma20 > indicators.sma.sma50 &&
                    indicators.sma.sma50 > indicators.sma.sma200
                      ? "Все SMA в бычьем порядке - сильный восходящий тренд"
                      : indicators.sma.sma20 < indicators.sma.sma50 &&
                          indicators.sma.sma50 < indicators.sma.sma200
                        ? "Все SMA в медвежьем порядке - сильный нисходящий тренд"
                        : "Смешанные сигналы - тренд неопределен"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">SMA недоступна</p>
            )}
          </TabsContent>

          {/* Bollinger Bands */}
          <TabsContent className="mt-4 space-y-4" value="bb">
            {indicators.bollingerBands ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Верхняя полоса
                    </span>
                    <span className="font-semibold text-red-600">
                      ${indicators.bollingerBands.upper.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Средняя линия
                    </span>
                    <span className="font-semibold">
                      ${indicators.bollingerBands.middle.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Нижняя полоса
                    </span>
                    <span className="font-semibold text-green-600">
                      ${indicators.bollingerBands.lower.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Bandwidth
                    </span>
                    <span className="font-semibold">
                      {indicators.bollingerBands.bandwidth.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-xs">
                  <p className="font-medium">Интерпретация:</p>
                  <p className="mt-1 text-muted-foreground">
                    {indicators.bollingerBands.bandwidth < 0.02
                      ? "Узкие полосы (Squeeze) - возможен сильный прорыв"
                      : indicators.bollingerBands.bandwidth > 0.1
                        ? "Широкие полосы - высокая волатильность"
                        : "Нормальная ширина полос"}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Bollinger Bands недоступны
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
