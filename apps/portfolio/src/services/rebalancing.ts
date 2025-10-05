/**
 * Portfolio Rebalancing Engine
 *
 * Автоматическая ребалансировка портфеля для поддержания целевых весов:
 * - Periodic rebalancing (календарная)
 * - Threshold-based rebalancing (по отклонениям)
 * - Opportunistic rebalancing (по рыночным условиям)
 * - Transaction cost optimization
 *
 * Интеграция с Portfolio Optimizer для получения оптимальных весов
 */

import type { Logger } from "@aladdin/logger";

export type RebalancingStrategy =
  | "periodic" // Календарная (раз в месяц/квартал)
  | "threshold" // По отклонению от целевых весов
  | "opportunistic" // По рыночным условиям
  | "hybrid"; // Комбинация

export type RebalancingFrequency = "daily" | "weekly" | "monthly" | "quarterly";

export type RebalancingConfig = {
  strategy: RebalancingStrategy;
  frequency?: RebalancingFrequency;
  thresholdPercent?: number; // Порог отклонения для threshold strategy (5% = 0.05)
  minTradeSize?: number; // Минимальный размер сделки (USD)
  maxTransactionCost?: number; // Максимальная комиссия (% от портфеля)
  allowPartialRebalance?: boolean; // Разрешить частичную ребалансировку
};

export type Position = {
  symbol: string;
  quantity: number;
  currentPrice: number;
  value: number;
};

export type RebalancingAction = {
  symbol: string;
  action: "buy" | "sell" | "hold";
  currentWeight: number;
  targetWeight: number;
  currentValue: number;
  targetValue: number;
  deltaValue: number;
  deltaQuantity: number;
  estimatedCost: number; // Комиссия
};

export type RebalancingPlan = {
  needsRebalancing: boolean;
  reason: string;
  totalValue: number;
  actions: RebalancingAction[];
  totalTransactionCost: number;
  estimatedSlippage: number;
  netBenefit: number; // Польза от ребалансировки минус издержки
  priority: "low" | "medium" | "high";
};

// Constants
const PERCENT_MULTIPLIER = 100;
const DEFAULT_THRESHOLD = 0.05; // 5%
const DEFAULT_MIN_TRADE_SIZE = 10; // $10 USD
const MAKER_FEE = 0.001; // 0.1% Binance maker fee
const SLIPPAGE_ESTIMATE = 0.0005; // 0.05% estimated slippage
const LOW_PRIORITY_THRESHOLD = 0.03; // 3%
const MEDIUM_PRIORITY_THRESHOLD = 0.07; // 7%
const HIGH_PRIORITY_THRESHOLD = 0.1; // 10%
const OPPORTUNISTIC_THRESHOLD = 0.08; // 8%
const MS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const HOURS_IN_DAY = 24;
const MS_PER_DAY =
  MS_IN_SECOND * SECONDS_IN_MINUTE * MINUTES_IN_HOUR * HOURS_IN_DAY;
const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const DAYS_IN_QUARTER = 90;
const MIN_DAYS_SINCE_REBALANCE = 1;
const MONTHS_IN_QUARTER = 3;

export class RebalancingEngine {
  constructor(private logger: Logger) {}

  /**
   * Analyze portfolio and generate rebalancing plan
   */
  analyzeRebalancing(params: {
    positions: Position[];
    targetWeights: Record<string, number>;
    config: RebalancingConfig;
    lastRebalanceDate?: Date;
  }): RebalancingPlan {
    const { positions, targetWeights, config, lastRebalanceDate } = params;

    this.logger.info("Analyzing rebalancing", {
      positionsCount: positions.length,
      strategy: config.strategy,
    });

    // Calculate total portfolio value
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);

    if (totalValue === 0) {
      return this.createEmptyPlan("Portfolio value is zero");
    }

    // Calculate current weights
    const currentWeights: Record<string, number> = {};
    for (const pos of positions) {
      currentWeights[pos.symbol] = pos.value / totalValue;
    }

    // Check if rebalancing is needed based on strategy
    const shouldRebalance = this.shouldRebalance({
      currentWeights,
      targetWeights,
      config,
      lastRebalanceDate,
    });

    if (!shouldRebalance.needed) {
      return this.createEmptyPlan(shouldRebalance.reason);
    }

    // Generate rebalancing actions
    const actions = this.generateRebalancingActions({
      positions,
      currentWeights,
      targetWeights,
      totalValue,
      config,
    });

    // Calculate costs and benefits
    const totalTransactionCost = actions.reduce(
      (sum, action) => sum + action.estimatedCost,
      0
    );

    const estimatedSlippage = this.estimateSlippage(actions, totalValue);

    // Calculate max deviation as proxy for benefit
    const maxDeviation = Math.max(
      ...actions.map((a) => Math.abs(a.currentWeight - a.targetWeight))
    );

    const netBenefit = maxDeviation - totalTransactionCost / totalValue;

    // Determine priority
    const priority = this.calculatePriority(maxDeviation);

    this.logger.info("Rebalancing plan generated", {
      actionsCount: actions.length,
      totalCost: totalTransactionCost,
      priority,
    });

    return {
      needsRebalancing: true,
      reason: shouldRebalance.reason,
      totalValue,
      actions,
      totalTransactionCost,
      estimatedSlippage,
      netBenefit,
      priority,
    };
  }

  /**
   * Check if rebalancing is needed based on strategy
   */
  private shouldRebalance(params: {
    currentWeights: Record<string, number>;
    targetWeights: Record<string, number>;
    config: RebalancingConfig;
    lastRebalanceDate?: Date;
  }): { needed: boolean; reason: string } {
    const { currentWeights, targetWeights, config, lastRebalanceDate } = params;

    switch (config.strategy) {
      case "periodic": {
        return this.checkPeriodicRebalancing(
          lastRebalanceDate,
          config.frequency ?? "monthly"
        );
      }

      case "threshold": {
        return this.checkThresholdRebalancing(
          currentWeights,
          targetWeights,
          config.thresholdPercent ?? DEFAULT_THRESHOLD
        );
      }

      case "opportunistic": {
        return this.checkOpportunisticRebalancing(
          currentWeights,
          targetWeights
        );
      }

      case "hybrid": {
        // Combine periodic and threshold
        const periodic = this.checkPeriodicRebalancing(
          lastRebalanceDate,
          config.frequency ?? "monthly"
        );
        const threshold = this.checkThresholdRebalancing(
          currentWeights,
          targetWeights,
          config.thresholdPercent ?? DEFAULT_THRESHOLD
        );
        return {
          needed: periodic.needed || threshold.needed,
          reason: periodic.needed ? periodic.reason : threshold.reason,
        };
      }

      default: {
        return { needed: false, reason: "Unknown strategy" };
      }
    }
  }

  /**
   * Check periodic rebalancing schedule
   */
  private checkPeriodicRebalancing(
    lastRebalanceDate: Date | undefined,
    frequency: RebalancingFrequency
  ): { needed: boolean; reason: string } {
    if (!lastRebalanceDate) {
      return { needed: true, reason: "First rebalance" };
    }

    const now = new Date();
    const daysSinceRebalance = Math.floor(
      (now.getTime() - lastRebalanceDate.getTime()) / MS_PER_DAY
    );

    let requiredDays: number;
    switch (frequency) {
      case "daily": {
        requiredDays = MIN_DAYS_SINCE_REBALANCE;
        break;
      }
      case "weekly": {
        requiredDays = DAYS_IN_WEEK;
        break;
      }
      case "monthly": {
        requiredDays = DAYS_IN_MONTH;
        break;
      }
      case "quarterly": {
        requiredDays = DAYS_IN_QUARTER;
        break;
      }
      default: {
        requiredDays = DAYS_IN_MONTH;
        break;
      }
    }

    if (daysSinceRebalance >= requiredDays) {
      return {
        needed: true,
        reason: `Scheduled ${frequency} rebalance (${daysSinceRebalance} days since last)`,
      };
    }

    return {
      needed: false,
      reason: `Next rebalance in ${requiredDays - daysSinceRebalance} days`,
    };
  }

  /**
   * Check threshold-based rebalancing
   */
  private checkThresholdRebalancing(
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>,
    threshold: number
  ): { needed: boolean; reason: string } {
    let maxDeviation = 0;
    let deviatingSymbol = "";

    for (const [symbol, targetWeight] of Object.entries(targetWeights)) {
      const currentWeight = currentWeights[symbol] ?? 0;
      const deviation = Math.abs(currentWeight - targetWeight);

      if (deviation > maxDeviation) {
        maxDeviation = deviation;
        deviatingSymbol = symbol;
      }
    }

    if (maxDeviation > threshold) {
      return {
        needed: true,
        reason: `${deviatingSymbol} deviated by ${(maxDeviation * PERCENT_MULTIPLIER).toFixed(1)}% (threshold: ${(threshold * PERCENT_MULTIPLIER).toFixed(1)}%)`,
      };
    }

    return {
      needed: false,
      reason: `Max deviation ${(maxDeviation * PERCENT_MULTIPLIER).toFixed(1)}% below threshold`,
    };
  }

  /**
   * Check opportunistic rebalancing (based on market conditions)
   */
  private checkOpportunisticRebalancing(
    currentWeights: Record<string, number>,
    targetWeights: Record<string, number>
  ): { needed: boolean; reason: string } {
    // Simplified: rebalance if significant divergence exists
    // In practice, would check market volatility, liquidity, etc.

    let maxDeviation = 0;
    for (const [symbol, targetWeight] of Object.entries(targetWeights)) {
      const currentWeight = currentWeights[symbol] ?? 0;
      const deviation = Math.abs(currentWeight - targetWeight);
      maxDeviation = Math.max(maxDeviation, deviation);
    }

    if (maxDeviation > OPPORTUNISTIC_THRESHOLD) {
      return {
        needed: true,
        reason: `Opportunistic rebalance: deviation ${(maxDeviation * PERCENT_MULTIPLIER).toFixed(1)}%`,
      };
    }

    return { needed: false, reason: "No opportunistic signal" };
  }

  /**
   * Generate rebalancing actions
   */
  private generateRebalancingActions(params: {
    positions: Position[];
    currentWeights: Record<string, number>;
    targetWeights: Record<string, number>;
    totalValue: number;
    config: RebalancingConfig;
  }): RebalancingAction[] {
    const { positions, currentWeights, targetWeights, totalValue, config } =
      params;

    const actions: RebalancingAction[] = [];

    // Create position map
    const positionMap = new Map<string, Position>();
    for (const pos of positions) {
      positionMap.set(pos.symbol, pos);
    }

    // Process each target asset
    for (const [symbol, targetWeight] of Object.entries(targetWeights)) {
      const currentWeight = currentWeights[symbol] ?? 0;
      const position = positionMap.get(symbol);

      const currentValue = position ? position.value : 0;
      const targetValue = totalValue * targetWeight;
      const deltaValue = targetValue - currentValue;

      // Skip if change is too small
      const minTradeSize = config.minTradeSize ?? DEFAULT_MIN_TRADE_SIZE;
      if (Math.abs(deltaValue) < minTradeSize) {
        continue;
      }

      let action: "buy" | "sell" | "hold" = "hold";
      if (deltaValue > 0) {
        action = "buy";
      } else if (deltaValue < 0) {
        action = "sell";
      }

      if (action === "hold") continue;

      const currentPrice = position?.currentPrice ?? 0;
      const deltaQuantity = currentPrice > 0 ? deltaValue / currentPrice : 0;

      const estimatedCost = this.calculateTransactionCost(Math.abs(deltaValue));

      actions.push({
        symbol,
        action,
        currentWeight,
        targetWeight,
        currentValue,
        targetValue,
        deltaValue,
        deltaQuantity,
        estimatedCost,
      });
    }

    return actions;
  }

  /**
   * Calculate transaction cost (fees + slippage)
   */
  private calculateTransactionCost(tradeValue: number): number {
    // Use maker fee (assuming limit orders)
    const fee = tradeValue * MAKER_FEE;

    // Add slippage estimate
    const slippage = tradeValue * SLIPPAGE_ESTIMATE;

    return fee + slippage;
  }

  /**
   * Estimate total slippage impact
   */
  private estimateSlippage(
    actions: RebalancingAction[],
    totalValue: number
  ): number {
    const totalTradeValue = actions.reduce(
      (sum, action) => sum + Math.abs(action.deltaValue),
      0
    );

    // Slippage increases with trade size relative to portfolio
    const slippageRatio = totalTradeValue / totalValue;
    return slippageRatio * SLIPPAGE_ESTIMATE;
  }

  /**
   * Calculate rebalancing priority
   */
  private calculatePriority(maxDeviation: number): "low" | "medium" | "high" {
    if (maxDeviation >= HIGH_PRIORITY_THRESHOLD) {
      return "high";
    }
    if (maxDeviation >= MEDIUM_PRIORITY_THRESHOLD) {
      return "medium";
    }
    if (maxDeviation >= LOW_PRIORITY_THRESHOLD) {
      return "low";
    }
    return "low";
  }

  /**
   * Create empty rebalancing plan
   */
  private createEmptyPlan(reason: string): RebalancingPlan {
    return {
      needsRebalancing: false,
      reason,
      totalValue: 0,
      actions: [],
      totalTransactionCost: 0,
      estimatedSlippage: 0,
      netBenefit: 0,
      priority: "low",
    };
  }

  /**
   * Execute rebalancing (dry-run or actual)
   *
   * Returns orders that should be executed
   */
  executeRebalancing(params: {
    plan: RebalancingPlan;
    dryRun?: boolean;
  }): Array<{
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    type: "LIMIT" | "MARKET";
    price?: number;
  }> {
    const { plan, dryRun = true } = params;

    if (!plan.needsRebalancing) {
      this.logger.info("No rebalancing needed");
      return [];
    }

    this.logger.info(
      dryRun ? "Dry-run rebalancing execution" : "Executing rebalancing",
      {
        actionsCount: plan.actions.length,
        totalCost: plan.totalTransactionCost,
      }
    );

    const orders = plan.actions.map((action) => ({
      symbol: action.symbol,
      side: (action.action === "buy" ? "BUY" : "SELL") as "BUY" | "SELL",
      quantity: Math.abs(action.deltaQuantity),
      type: "LIMIT" as const, // Use limit orders to minimize slippage
      price: action.targetValue / Math.abs(action.deltaQuantity),
    }));

    if (dryRun) {
      this.logger.info("Dry-run orders generated", {
        ordersCount: orders.length,
      });
    }

    return orders;
  }

  /**
   * Calculate rebalancing schedule
   *
   * Returns next rebalancing date based on frequency
   */
  getNextRebalancingDate(
    lastRebalanceDate: Date,
    frequency: RebalancingFrequency
  ): Date {
    const next = new Date(lastRebalanceDate);

    switch (frequency) {
      case "daily": {
        next.setDate(next.getDate() + MIN_DAYS_SINCE_REBALANCE);
        break;
      }
      case "weekly": {
        next.setDate(next.getDate() + DAYS_IN_WEEK);
        break;
      }
      case "monthly": {
        next.setMonth(next.getMonth() + 1);
        break;
      }
      case "quarterly": {
        next.setMonth(next.getMonth() + MONTHS_IN_QUARTER);
        break;
      }
      default: {
        next.setMonth(next.getMonth() + 1);
        break;
      }
    }

    return next;
  }
}
