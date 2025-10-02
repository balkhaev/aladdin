/**
 * Conditional Value at Risk (CVaR) Card Component
 * Отображает CVaR (Expected Shortfall) с разными уровнями доверия
 */

import { AlertTriangle, TrendingDown } from "lucide-react";
import { useCVaR } from "../hooks/use-risk";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type RiskCVaRCardProps = {
  portfolioId: string;
};

const CONFIDENCE_95 = 95;
const CONFIDENCE_99 = 99;
const TAIL_RISK_HIGH = 1.5;
const TAIL_RISK_MODERATE = 1.2;
const PERCENT_MULTIPLIER = 100;
const TAIL_RISK_MAX = 2;

const getTailRiskColor = (tailRisk: number) => {
  if (tailRisk > TAIL_RISK_HIGH) return "text-red-600";
  if (tailRisk > TAIL_RISK_MODERATE) return "text-yellow-600";
  return "text-green-600";
};

const getTailRiskBgColor = (tailRisk: number) => {
  if (tailRisk > TAIL_RISK_HIGH) return "bg-red-600";
  if (tailRisk > TAIL_RISK_MODERATE) return "bg-yellow-600";
  return "bg-green-600";
};

const getTailRiskLabel = (tailRisk: number) => {
  if (tailRisk > TAIL_RISK_HIGH) return "⚠️ Высокий хвостовой риск";
  if (tailRisk > TAIL_RISK_MODERATE) return "⚡ Умеренный хвостовой риск";
  return "✅ Низкий хвостовой риск";
};

export function RiskCVaRCard({ portfolioId }: RiskCVaRCardProps) {
  const { data: cvar95, isLoading: loading95 } = useCVaR(
    portfolioId,
    CONFIDENCE_95
  );
  const { data: cvar99, isLoading: loading99 } = useCVaR(
    portfolioId,
    CONFIDENCE_99
  );

  if (loading95 || loading99) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Conditional VaR (CVaR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatPercent = (cvar_value: number, currentValue: number) =>
    ((cvar_value / currentValue) * PERCENT_MULTIPLIER).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Conditional VaR (CVaR)
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Expected Shortfall - средний убыток в худших сценариях
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="95">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="95">95% доверия</TabsTrigger>
            <TabsTrigger value="99">99% доверия</TabsTrigger>
          </TabsList>

          <TabsContent className="mt-4 space-y-4" value="95">
            {cvar95 ? (
              <>
                {/* CVaR Value */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    Средний убыток в худших 5% случаев
                  </p>
                  <p className="font-bold text-3xl text-red-600">
                    {formatCurrency(cvar95.cvar95)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatPercent(cvar95.cvar95, cvar95.portfolioValue)}% от
                    текущей стоимости
                  </p>
                </div>

                {/* Comparison with VaR */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">VaR 95%</p>
                    <p className="font-semibold text-red-500">
                      {formatCurrency(cvar95.var95)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">CVaR 95%</p>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(cvar95.cvar95)}
                    </p>
                  </div>
                </div>

                {/* Tail Risk Ratio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Tail Risk Ratio
                    </span>
                    <span
                      className={`font-semibold ${getTailRiskColor(cvar95.tailRisk95)}`}
                    >
                      {cvar95.tailRisk95.toFixed(2)}x
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full ${getTailRiskBgColor(cvar95.tailRisk95)}`}
                      style={{
                        width: `${Math.min((cvar95.tailRisk95 / TAIL_RISK_MAX) * PERCENT_MULTIPLIER, PERCENT_MULTIPLIER)}%`,
                      }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {getTailRiskLabel(cvar95.tailRisk95)}
                  </p>
                </div>

                {/* Info Box */}
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div className="text-blue-800 text-xs">
                      <p className="font-medium">Что такое CVaR?</p>
                      <p className="mt-1">
                        CVaR показывает средний убыток, если портфель попадет в
                        худшие 5% случаев. Это более точная мера tail risk, чем
                        VaR.
                      </p>
                      <p className="mt-1">
                        <strong>Tail Risk Ratio = CVaR / VaR:</strong>
                        <br />• {"<"} 1.2: low tail risk
                        <br />• 1.2-1.5: moderate tail risk
                        <br />• {">"} 1.5: high tail risk
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Недостаточно данных для расчета CVaR (нужно минимум 30 дней
                истории)
              </p>
            )}
          </TabsContent>

          <TabsContent className="mt-4 space-y-4" value="99">
            {cvar99 ? (
              <>
                {/* CVaR Value */}
                <div className="space-y-1">
                  <p className="text-muted-foreground text-sm">
                    Средний убыток в худших 1% случаев
                  </p>
                  <p className="font-bold text-3xl text-red-700">
                    {formatCurrency(cvar99.cvar99)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatPercent(cvar99.cvar99, cvar99.portfolioValue)}% от
                    текущей стоимости
                  </p>
                </div>

                {/* Comparison with VaR */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">VaR 99%</p>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(cvar99.var99)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">CVaR 99%</p>
                    <p className="font-semibold text-red-700">
                      {formatCurrency(cvar99.cvar99)}
                    </p>
                  </div>
                </div>

                {/* Tail Risk Ratio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Tail Risk Ratio
                    </span>
                    <span
                      className={`font-semibold ${getTailRiskColor(cvar99.tailRisk99)}`}
                    >
                      {cvar99.tailRisk99.toFixed(2)}x
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full ${getTailRiskBgColor(cvar99.tailRisk99)}`}
                      style={{
                        width: `${Math.min((cvar99.tailRisk99 / TAIL_RISK_MAX) * PERCENT_MULTIPLIER, PERCENT_MULTIPLIER)}%`,
                      }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {getTailRiskLabel(cvar99.tailRisk99)} в экстремальных
                    случаях
                  </p>
                </div>

                {/* Info Box */}
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div className="text-blue-800 text-xs">
                      <p className="font-medium">CVaR 99%</p>
                      <p className="mt-1">
                        Показывает средний убыток в самых экстремальных
                        сценариях (худший 1% случаев). Важно для оценки рисков в
                        периоды сильной волатильности.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Недостаточно данных для расчета CVaR (нужно минимум 30 дней
                истории)
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
