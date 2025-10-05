/**
 * Unified Analytics Page
 * Portfolio analytics + Trading intelligence in one place
 */

import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Brain, Database, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PortfolioSummaryDashboard } from "@/components/analytics/portfolio-summary-dashboard";
import { CacheMonitoringCard } from "@/components/cache-monitoring-card";
import { DivergenceAlerts } from "@/components/intelligence/divergence-alerts";
import { PortfolioSentimentTable } from "@/components/intelligence/portfolio-sentiment-table";
import { SmartSignalsCard } from "@/components/intelligence/smart-signals-card";
import { WatchlistSentiment } from "@/components/intelligence/watchlist-sentiment";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortfolios } from "@/hooks/use-portfolio";

export const Route = createFileRoute("/_auth/analytics-unified")({
  component: UnifiedAnalyticsPage,
});

function UnifiedAnalyticsPage() {
  const { data: portfolios, isLoading: isLoadingPortfolios } = usePortfolios();
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");

  // Auto-select first portfolio
  if (!selectedPortfolioId && portfolios && portfolios.length > 0) {
    setSelectedPortfolioId(portfolios[0].id);
  }

  if (isLoadingPortfolios) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!portfolios || portfolios.length === 0) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
              <BarChart3 className="size-6 text-purple-500" />
            </div>
            <div>
              <h1 className="font-bold text-3xl tracking-tight">Аналитика</h1>
              <p className="text-muted-foreground">
                Метрики портфеля и торговая аналитика
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="space-y-3 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="size-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">Портфели не найдены</h3>
              <p className="text-muted-foreground text-sm">
                Создайте портфель на странице "Портфель", чтобы увидеть
                аналитику
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10">
              <BarChart3 className="size-6 text-purple-500" />
            </div>
            <div>
              <h1 className="font-bold text-3xl tracking-tight">Аналитика</h1>
              <p className="text-muted-foreground">
                Метрики портфеля и торговая аналитика
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Selector */}
        <Select
          onValueChange={setSelectedPortfolioId}
          value={selectedPortfolioId}
        >
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Выберите портфель" />
          </SelectTrigger>
          <SelectContent>
            {portfolios.map((portfolio) => (
              <SelectItem key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content Tabs */}
      <Tabs className="space-y-6" defaultValue="performance">
        <TabsList className="grid w-full grid-cols-4 lg:w-[660px]">
          <TabsTrigger className="gap-2" value="performance">
            <BarChart3 className="size-4" />
            <span className="hidden sm:inline">Метрики</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="intelligence">
            <Brain className="size-4" />
            <span className="hidden sm:inline">Intelligence</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="signals">
            <TrendingUp className="size-4" />
            <span className="hidden sm:inline">Сигналы</span>
          </TabsTrigger>
          <TabsTrigger className="gap-2" value="admin">
            <Database className="size-4" />
            <span className="hidden sm:inline">Admin</span>
          </TabsTrigger>
        </TabsList>

        {/* Performance Metrics Tab */}
        <TabsContent className="space-y-6" value="performance">
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">
              Метрики производительности
            </h2>
            <p className="text-muted-foreground text-sm">
              Детальная статистика и расширенные метрики портфеля
            </p>
          </div>
          {selectedPortfolioId && (
            <PortfolioSummaryDashboard portfolioId={selectedPortfolioId} />
          )}
        </TabsContent>

        {/* Trading Intelligence Tab */}
        <TabsContent className="space-y-6" value="intelligence">
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">
              AI-powered Market Intelligence
            </h2>
            <p className="text-muted-foreground text-sm">
              Анализ настроений рынка и дивергенций
            </p>
          </div>

          {/* Market Intelligence Panel */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WatchlistSentiment />
            </div>
            <div>
              <DivergenceAlerts />
            </div>
          </div>

          {/* Portfolio Sentiment */}
          {selectedPortfolioId && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">
                Sentiment активов портфеля
              </h3>
              <PortfolioSentimentTable portfolioId={selectedPortfolioId} />
            </div>
          )}
        </TabsContent>

        {/* Smart Signals Tab */}
        <TabsContent className="space-y-6" value="signals">
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">Торговые сигналы</h2>
            <p className="text-muted-foreground text-sm">
              Высококонфиденциальные торговые возможности на основе
              мультиисточникового анализа
            </p>
          </div>
          <SmartSignalsCard portfolioId={selectedPortfolioId} />
        </TabsContent>

        {/* Admin Tab */}
        <TabsContent className="space-y-6" value="admin">
          <div className="space-y-3">
            <h2 className="font-semibold text-xl">System Administration</h2>
            <p className="text-muted-foreground text-sm">
              Мониторинг кэша и системные настройки
            </p>
          </div>
          <CacheMonitoringCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
