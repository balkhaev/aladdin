/**
 * Portfolio Page
 * Страница портфеля с позициями, производительностью и управлением рисками
 */

import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, RefreshCcw, TrendingUp } from "lucide-react";
import { useState } from "react";
import { CreatePortfolioDialog } from "../components/create-portfolio-dialog";
import { AddPositionDialog } from "../components/portfolio/add-position-dialog";
import { CorrelationsTable } from "../components/portfolio/correlations-table";
import { OptimizationDialog } from "../components/portfolio/optimization-dialog";
import { OptimizationResultsCard } from "../components/portfolio/optimization-results-card";
import { PortfolioAllocationChart } from "../components/portfolio/portfolio-allocation-chart";
import { PortfolioMetricsGrid } from "../components/portfolio/portfolio-metrics-grid";
import { PortfolioPerformanceChart } from "../components/portfolio/portfolio-performance-chart";
import { PortfolioSummaryCard } from "../components/portfolio/portfolio-summary-card";
import { PositionsTableEnhanced } from "../components/portfolio/positions-table-enhanced";
import { RebalancingDialog } from "../components/portfolio/rebalancing-dialog";
import { TransactionsTable } from "../components/portfolio/transactions-table";
import { RiskCVaRCard } from "../components/risk-cvar-card";
import { RiskExposureCard } from "../components/risk-exposure-card";
import { RiskLimitsCard } from "../components/risk-limits-card";
import { RiskStressTestCard } from "../components/risk-stress-test-card";
import { RiskVaRCard } from "../components/risk-var-card";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  usePortfolio,
  usePortfolios,
  useUpdatePositionsPrices,
} from "../hooks/use-portfolio";
import type { OptimizedPortfolio } from "../lib/api/portfolio";

export const Route = createFileRoute("/_auth/portfolio")({
  component: PortfolioPage,
});

function PortfolioPage() {
  const { data: portfolios, isLoading } = usePortfolios();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [showRebalancingDialog, setShowRebalancingDialog] = useState(false);
  const [optimizationResult, setOptimizationResult] =
    useState<OptimizedPortfolio | null>(null);
  const updatePricesMutation = useUpdatePositionsPrices();
  const { data: portfolio } = usePortfolio(selectedPortfolioId);

  // Auto-select first portfolio
  if (!selectedPortfolioId && portfolios && portfolios.length > 0) {
    setSelectedPortfolioId(portfolios[0].id);
  }

  const handleUpdatePrices = () => {
    if (selectedPortfolioId) {
      updatePricesMutation.mutate(selectedPortfolioId);
    }
  };

  return (
    <div className="flex-1 space-y-3 p-3">
      {/* Portfolio Selector */}
      {(() => {
        if (isLoading) {
          return <p className="text-muted-foreground">Загрузка портфелей...</p>;
        }

        if (!portfolios || portfolios.length === 0) {
          return (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 font-semibold text-lg">Нет портфелей</h3>
              <p className="mt-2 text-muted-foreground">
                Создайте портфель, чтобы начать управлять позициями и рисками
              </p>
              <div className="mt-6">
                <CreatePortfolioDialog />
              </div>
            </div>
          );
        }

        return (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-full md:w-64">
                <Select
                  onValueChange={setSelectedPortfolioId}
                  value={selectedPortfolioId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите портфель" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPortfolioId && (
                <>
                  <Button
                    disabled={updatePricesMutation.isPending}
                    onClick={handleUpdatePrices}
                    variant="outline"
                  >
                    <RefreshCcw
                      className={`mr-2 h-4 w-4 ${updatePricesMutation.isPending ? "animate-spin" : ""}`}
                    />
                    Обновить цены
                  </Button>
                  <Button
                    onClick={() => setShowOptimizationDialog(true)}
                    variant="outline"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Optimize Portfolio
                  </Button>
                </>
              )}
            </div>

            {selectedPortfolioId && (
              <Tabs className="space-y-3" defaultValue="overview">
                <TabsList className="h-9">
                  <TabsTrigger className="text-xs" value="overview">
                    Обзор
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="positions">
                    Позиции
                  </TabsTrigger>
                  <TabsTrigger className="text-xs" value="optimization">
                    Оптимизация
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent className="space-y-3" value="overview">
                  <PortfolioSummaryCard portfolioId={selectedPortfolioId} />
                  <PortfolioMetricsGrid portfolioId={selectedPortfolioId} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <PortfolioPerformanceChart
                      portfolioId={selectedPortfolioId}
                    />
                    <PortfolioAllocationChart
                      portfolioId={selectedPortfolioId}
                    />
                  </div>

                  {/* Risk Metrics */}
                  <div className="space-y-2">
                    <h3 className="trading-heading px-1 text-muted-foreground">
                      RISK METRICS
                    </h3>
                    <div className="grid gap-2 md:grid-cols-2">
                      <RiskVaRCard portfolioId={selectedPortfolioId} />
                      <RiskExposureCard portfolioId={selectedPortfolioId} />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <RiskCVaRCard portfolioId={selectedPortfolioId} />
                      <RiskStressTestCard portfolioId={selectedPortfolioId} />
                    </div>
                    <RiskLimitsCard portfolioId={selectedPortfolioId} />
                  </div>
                </TabsContent>

                {/* Positions Tab */}
                <TabsContent className="space-y-3" value="positions">
                  <div className="flex justify-end">
                    <AddPositionDialog portfolioId={selectedPortfolioId} />
                  </div>
                  {portfolio && portfolio.positions.length > 0 ? (
                    <PositionsTableEnhanced
                      portfolioId={selectedPortfolioId}
                      positions={portfolio.positions}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Нет открытых позиций
                    </p>
                  )}

                  {/* Transactions */}
                  <div className="space-y-2">
                    <h3 className="trading-heading px-1 text-muted-foreground">
                      ИСТОРИЯ ОПЕРАЦИЙ
                    </h3>
                    <TransactionsTable portfolioId={selectedPortfolioId} />
                  </div>
                </TabsContent>

                {/* Optimization Tab */}
                <TabsContent className="space-y-3" value="optimization">
                  {optimizationResult && (
                    <OptimizationResultsCard result={optimizationResult} />
                  )}
                  <CorrelationsTable portfolioId={selectedPortfolioId} />
                </TabsContent>
              </Tabs>
            )}

            {/* Optimization Dialog */}
            {portfolio && (
              <>
                <OptimizationDialog
                  availableAssets={portfolio.positions.map((p) => p.symbol)}
                  onClose={() => setShowOptimizationDialog(false)}
                  onOptimized={setOptimizationResult}
                  open={showOptimizationDialog}
                  portfolioId={selectedPortfolioId}
                />
                <RebalancingDialog
                  currentPositions={portfolio.positions.map((p) => ({
                    symbol: p.symbol,
                    value: p.value,
                  }))}
                  onClose={() => setShowRebalancingDialog(false)}
                  open={showRebalancingDialog}
                  portfolioId={selectedPortfolioId}
                />
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
