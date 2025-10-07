import { useMutation } from "@tanstack/react-query";
import type { BacktestParams, BacktestResult } from "../lib/api/backtest";
import { runBacktest } from "../lib/api/backtest";

/**
 * Hook for running backtests
 */
export function useBacktest() {
  return useMutation<BacktestResult, Error, BacktestParams>({
    mutationFn: (params) => runBacktest(params),
  });
}

