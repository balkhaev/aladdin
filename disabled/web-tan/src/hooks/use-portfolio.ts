/**
 * Portfolio React Hooks
 * Custom hooks for portfolio operations using TanStack Query
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdvancedPortfolioMetrics } from "../lib/api/analytics";
import {
  createPortfolio,
  createPosition,
  deletePosition,
  getPortfolioAllocations,
  getPortfolioById,
  getPortfolioPerformance,
  getPortfolios,
  getPortfolioTransactions,
  importPositions,
  updatePosition,
  updatePositionsPrices,
} from "../lib/api/portfolio";

/**
 * Hook to fetch all portfolios
 * Real-time updates handled by usePositionsWebSocket
 */
export function usePortfolios(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["portfolios"],
    queryFn: getPortfolios,
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: Number.POSITIVE_INFINITY, // Данные всегда актуальны благодаря WebSocket
    enabled: options?.enabled !== false, // Allow disabling the query
  });
}

/**
 * Hook to fetch a single portfolio by ID
 * Real-time updates handled by usePositionsWebSocket
 */
export function usePortfolio(id: string) {
  return useQuery({
    queryKey: ["portfolios", id],
    queryFn: () => getPortfolioById(id),
    enabled: Boolean(id),
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: Number.POSITIVE_INFINITY, // Данные всегда актуальны благодаря WebSocket
  });
}

/**
 * Hook to fetch portfolio performance
 * Real-time updates handled by usePositionsWebSocket
 */
export function usePortfolioPerformance(id: string) {
  return useQuery({
    queryKey: ["portfolios", id, "performance"],
    queryFn: () => getPortfolioPerformance(id),
    enabled: Boolean(id),
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: 60_000, // Метрики производительности кешируем на 1 минуту
  });
}

/**
 * Hook to fetch portfolio allocations
 * Real-time updates handled by usePositionsWebSocket
 */
export function usePortfolioAllocations(id: string) {
  return useQuery({
    queryKey: ["portfolios", id, "allocations"],
    queryFn: () => getPortfolioAllocations(id),
    enabled: Boolean(id),
    // Убрали refetchInterval - обновления приходят через WebSocket
    staleTime: 60_000, // Аллокации кешируем на 1 минуту
  });
}

/**
 * Hook to create a new portfolio with optional asset import
 */
export function useCreatePortfolio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      assets?: Array<{
        symbol: string;
        quantity: number;
        currentPrice: number;
      }>;
      exchange?: string;
      exchangeCredentialsId?: string;
    }) => {
      // Create portfolio
      const portfolio = await createPortfolio({ name: data.name });

      // Import assets if provided
      if (data.assets && data.assets.length > 0) {
        await importPositions(
          portfolio.id,
          data.assets,
          data.exchange,
          data.exchangeCredentialsId
        );
      }

      return portfolio;
    },
    onSuccess: (portfolio, variables) => {
      // Invalidate and refetch portfolios
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });

      const message = variables.assets?.length
        ? `Портфель "${portfolio.name}" создан и импортировано ${variables.assets.length} активов`
        : `Портфель "${portfolio.name}" создан успешно`;

      toast.success(message);
    },
    onError: (error: Error) => {
      toast.error("Ошибка создания портфеля", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to import positions from exchange to portfolio
 */
export function useImportPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      portfolioId,
      assets,
      exchange,
      exchangeCredentialsId,
    }: {
      portfolioId: string;
      assets: Array<{ symbol: string; quantity: number; currentPrice: number }>;
      exchange?: string;
      exchangeCredentialsId?: string;
    }) => {
      // Import positions
      const importResult = await importPositions(
        portfolioId,
        assets,
        exchange,
        exchangeCredentialsId
      );

      // Then update prices from market data
      try {
        await updatePositionsPrices(portfolioId);
      } catch (error) {
        console.warn("Failed to update prices after import:", error);
      }

      return importResult;
    },
    onSuccess: (data) => {
      // Invalidate portfolio queries
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({
        queryKey: ["portfolio", data.portfolioId],
      });

      toast.success(`Импортировано ${data.imported} позиций`, {
        description: "Позиции успешно добавлены в портфель",
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка импорта позиций", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to fetch portfolio positions
 */
export function usePortfolioPositions(portfolioId: string) {
  return useQuery({
    queryKey: ["portfolios", portfolioId, "positions"],
    queryFn: async () => {
      const portfolio = await getPortfolioById(portfolioId);
      return portfolio.positions || [];
    },
    enabled: Boolean(portfolioId),
    staleTime: 60_000,
  });
}

/**
 * Hook to update positions prices
 */
export function useUpdatePositionsPrices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (portfolioId: string) => updatePositionsPrices(portfolioId),
    onSuccess: (data) => {
      // Invalidate portfolio queries
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({
        queryKey: ["portfolio", data.portfolioId],
      });

      toast.success(`Обновлено цен: ${data.updated}`, {
        description: "Цены позиций успешно обновлены",
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка обновления цен", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to get advanced portfolio metrics
 */
export function useAdvancedPortfolioMetrics(
  portfolioId: string,
  params?: { from?: Date; to?: Date; benchmark?: string }
) {
  return useQuery({
    queryKey: [
      "portfolios",
      portfolioId,
      "advanced-metrics",
      params?.from,
      params?.to,
      params?.benchmark,
    ],
    queryFn: () =>
      getAdvancedPortfolioMetrics(portfolioId, {
        from: params?.from?.toISOString(),
        to: params?.to?.toISOString(),
        benchmark: params?.benchmark,
      }),
    enabled: Boolean(portfolioId),
    staleTime: 300_000, // Cache for 5 minutes
  });
}

/**
 * Hook to get portfolio transactions
 */
export function usePortfolioTransactions(
  portfolioId: string,
  params?: { from?: Date; to?: Date; limit?: number }
) {
  return useQuery({
    queryKey: [
      "portfolios",
      portfolioId,
      "transactions",
      params?.from,
      params?.to,
      params?.limit,
    ],
    queryFn: () =>
      getPortfolioTransactions(portfolioId, {
        from: params?.from?.toISOString(),
        to: params?.to?.toISOString(),
        limit: params?.limit,
      }),
    enabled: Boolean(portfolioId),
    staleTime: 60_000, // Cache for 1 minute
  });
}

/**
 * Hook to create position manually
 */
export function useCreatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      portfolioId,
      symbol,
      quantity,
      entryPrice,
      side,
    }: {
      portfolioId: string;
      symbol: string;
      quantity: number;
      entryPrice: number;
      side?: "LONG" | "SHORT";
    }) => createPosition(portfolioId, { symbol, quantity, entryPrice, side }),
    onSuccess: (data, variables) => {
      // Invalidate portfolio queries
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({
        queryKey: ["portfolios", variables.portfolioId],
      });

      toast.success("Позиция добавлена", {
        description: `${data.symbol}: ${data.quantity}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка создания позиции", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to update position manually
 */
export function useUpdatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      portfolioId,
      positionId,
      quantity,
      entryPrice,
    }: {
      portfolioId: string;
      positionId: string;
      quantity?: number;
      entryPrice?: number;
    }) => updatePosition(portfolioId, positionId, { quantity, entryPrice }),
    onSuccess: (data, variables) => {
      // Invalidate portfolio queries
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({
        queryKey: ["portfolios", variables.portfolioId],
      });

      toast.success("Позиция обновлена", {
        description: data.symbol,
      });
    },
    onError: (error: Error) => {
      toast.error("Ошибка обновления позиции", {
        description: error.message,
      });
    },
  });
}

/**
 * Hook to delete position
 */
export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      portfolioId,
      positionId,
    }: {
      portfolioId: string;
      positionId: string;
    }) => deletePosition(portfolioId, positionId),
    onSuccess: (_data, variables) => {
      // Invalidate portfolio queries
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({
        queryKey: ["portfolios", variables.portfolioId],
      });

      toast.success("Позиция удалена");
    },
    onError: (error: Error) => {
      toast.error("Ошибка удаления позиции", {
        description: error.message,
      });
    },
  });
}
