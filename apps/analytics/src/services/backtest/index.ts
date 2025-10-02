/**
 * Backtest Module
 * Export all backtest-related classes
 */

export {
  type BacktestConfig,
  BacktestEngine,
  type BacktestResult,
} from "./backtest-engine";
export {
  BaseStrategy,
  type StrategyParams,
  type StrategyTrade,
  type TradeSignal,
} from "./base-strategy";

export * from "./strategies";
