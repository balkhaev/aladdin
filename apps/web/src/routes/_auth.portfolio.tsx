/**
 * Portfolio Page
 * Страница портфеля с позициями, производительностью и управлением рисками
 */

import { createFileRoute } from "@tanstack/react-router";
import { Briefcase, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { CreatePortfolioDialog } from "../components/create-portfolio-dialog";
import { AddPositionDialog } from "../components/portfolio/add-position-dialog";
import { CorrelationsTable } from "../components/portfolio/correlations-table";
import { PortfolioAllocationChart } from "../components/portfolio/portfolio-allocation-chart";
import { PortfolioMetricsGrid } from "../components/portfolio/portfolio-metrics-grid";
import { PortfolioPerformanceChart } from "../components/portfolio/portfolio-performance-chart";
import { PositionsTableEnhanced } from "../components/portfolio/positions-table-enhanced";
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

export const Route = createFileRoute("/_auth/portfolio")({
  component: PortfolioPage,
});

function PortfolioPage() {
  const { data: portfolios, isLoading } = usePortfolios();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
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
    <div className="flex-1 space-y-4 p-4 md:p-6">
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
            <div className="flex flex-wrap items-center gap-4">
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
              )}
            </div>

            {selectedPortfolioId && (
              <Tabs className="space-y-4" defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Обзор</TabsTrigger>
                  <TabsTrigger value="positions">Позиции</TabsTrigger>
                  <TabsTrigger value="transactions">Транзакции</TabsTrigger>
                  <TabsTrigger value="risks">Риски</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent className="space-y-4" value="overview">
                  <PortfolioMetricsGrid portfolioId={selectedPortfolioId} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <PortfolioPerformanceChart
                      portfolioId={selectedPortfolioId}
                    />
                    <PortfolioAllocationChart
                      portfolioId={selectedPortfolioId}
                    />
                  </div>
                </TabsContent>

                {/* Positions Tab */}
                <TabsContent className="space-y-4" value="positions">
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
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions">
                  <TransactionsTable portfolioId={selectedPortfolioId} />
                </TabsContent>

                {/* Risks Tab */}
                <TabsContent className="space-y-4" value="risks">
                  <div className="grid gap-4 md:grid-cols-2">
                    <RiskVaRCard portfolioId={selectedPortfolioId} />
                    <RiskExposureCard portfolioId={selectedPortfolioId} />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <RiskCVaRCard portfolioId={selectedPortfolioId} />
                    <RiskStressTestCard portfolioId={selectedPortfolioId} />
                  </div>
                  <RiskLimitsCard portfolioId={selectedPortfolioId} />
                  <CorrelationsTable portfolioId={selectedPortfolioId} />
                </TabsContent>
              </Tabs>
            )}
          </>
        );
      })()}
    </div>
  );
}
