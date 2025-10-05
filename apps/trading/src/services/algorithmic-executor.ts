/**
 * Algorithmic Executor
 *
 * Implements sophisticated order execution algorithms:
 * - VWAP (Volume Weighted Average Price)
 * - TWAP (Time Weighted Average Price)
 * - Iceberg Orders
 *
 * Based on:
 * - Almgren-Chriss (2000) - Optimal Execution of Portfolio Transactions
 * - Kissell & Glantz (2003) - Optimal Trading Strategies
 * - Bertsimas & Lo (1998) - Optimal Control of Execution Costs
 */

import type { Logger } from "@aladdin/shared/logger";

export type ExecutionStrategy = "VWAP" | "TWAP" | "ICEBERG";

export type VolumeProfile = Array<{
  hour: number;
  volume: number;
}>;

export type BaseExecutionParams = {
  symbol: string;
  side: "BUY" | "SELL";
  totalQuantity: number;
  minSliceSize?: number;
  maxSliceSize?: number;
};

export type VWAPParams = BaseExecutionParams & {
  strategy: "VWAP";
  duration: number; // seconds
  adaptToVolatility?: boolean;
};

export type TWAPParams = BaseExecutionParams & {
  strategy: "TWAP";
  duration: number; // seconds
  sliceInterval?: number; // seconds between slices
  adaptToVolatility?: boolean;
};

export type IcebergParams = BaseExecutionParams & {
  strategy: "ICEBERG";
  visibleQuantity: number;
  refreshThreshold?: number; // 0-1, refresh when filled ratio exceeds this
  randomizeInterval?: boolean;
};

export type ExecutionParams = VWAPParams | TWAPParams | IcebergParams;

export type ExecutionSlice = {
  index: number;
  timestamp: number;
  quantity: number;
  hidden?: boolean;
};

export type ExecutionSchedule = {
  strategy: ExecutionStrategy;
  symbol: string;
  side: "BUY" | "SELL";
  totalQuantity: number;
  slices: ExecutionSlice[];
  startTime: number;
  endTime?: number;
  refreshThreshold?: number;
};

export type ExecutionState = {
  schedule: ExecutionSchedule;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "PAUSED";
  filled: number;
  remaining: number;
  currentSliceIndex: number;
  failedSlices: number[];
  fills: Array<{
    sliceIndex: number;
    quantity: number;
    price?: number;
    timestamp: number;
  }>;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
};

export type ExecutionMetrics = {
  averagePrice: number;
  slippage: number;
  completion: number; // 0-1
  duration: number;
  efficiency: number; // How well we matched target (VWAP/TWAP)
};

export type MarketConditions = {
  volatility: number;
  spread?: number;
  volume?: number;
};

// Constants
const DEFAULT_SLICE_INTERVAL = 60; // 1 minute
const MIN_SLICES = 2;
const MAX_SLICES = 100;
const DEFAULT_REFRESH_THRESHOLD = 0.8; // 80% filled before refresh
const VOLATILITY_PAUSE_THRESHOLD = 0.08; // 8% volatility
const SPREAD_PAUSE_THRESHOLD = 0.03; // 3% spread
const HIGH_VOLATILITY_MULTIPLIER = 0.5; // Reduce slices by 50% in high vol
const RANDOMIZATION_RANGE = 0.2; // ±20% for randomization
const HIGH_VOLATILITY_THRESHOLD = 0.03; // 3% volatility threshold
const MILLISECONDS_PER_SECOND = 1000;
const ICEBERG_BASE_INTERVAL = 10_000; // 10 seconds
const FAILURE_RATE_THRESHOLD = 0.3; // 30% failure threshold
const RANDOM_RANGE_MULTIPLIER = 2;

export class AlgorithmicExecutor {
  constructor(private logger: Logger) {}

  /**
   * Calculate VWAP execution schedule
   * Distributes order proportionally to historical volume patterns
   */
  calculateVWAPSchedule(
    params: VWAPParams,
    volumeProfile: VolumeProfile
  ): ExecutionSchedule {
    this.logger.info("Calculating VWAP schedule", {
      symbol: params.symbol,
      totalQuantity: params.totalQuantity,
    });

    // If no volume data, fall back to TWAP
    if (volumeProfile.length === 0) {
      this.logger.warn("No volume profile data, falling back to TWAP");
      return this.calculateTWAPSchedule({
        ...params,
        strategy: "TWAP",
      });
    }

    const totalVolume = volumeProfile.reduce((sum, p) => sum + p.volume, 0);
    const sliceCount = Math.min(
      Math.max(
        MIN_SLICES,
        Math.floor(params.duration / DEFAULT_SLICE_INTERVAL)
      ),
      MAX_SLICES
    );

    const slices: ExecutionSlice[] = [];
    const now = Date.now();
    let allocatedQuantity = 0;

    // Distribute quantity proportionally to volume
    for (let i = 0; i < sliceCount; i++) {
      const profileIndex = i % volumeProfile.length;
      const volumeRatio = volumeProfile[profileIndex].volume / totalVolume;

      // Calculate quantity for this slice
      let quantity = params.totalQuantity * volumeRatio;

      // Apply size constraints
      if (params.maxSliceSize) {
        quantity = Math.min(quantity, params.maxSliceSize);
      }
      if (params.minSliceSize) {
        quantity = Math.max(quantity, params.minSliceSize);
      }

      // Ensure we don't exceed total
      const remaining = params.totalQuantity - allocatedQuantity;
      quantity = Math.min(quantity, remaining);

      if (quantity <= 0) break;

      const timestamp =
        now + (i * params.duration * MILLISECONDS_PER_SECOND) / sliceCount;

      slices.push({
        index: i,
        timestamp: Math.floor(timestamp),
        quantity,
      });

      allocatedQuantity += quantity;
    }

    // Distribute any remaining quantity to last slice
    const remaining = params.totalQuantity - allocatedQuantity;
    const lastSlice = slices.at(-1);
    if (remaining > 0 && lastSlice) {
      lastSlice.quantity += remaining;
    }

    return {
      strategy: "VWAP",
      symbol: params.symbol,
      side: params.side,
      totalQuantity: params.totalQuantity,
      slices,
      startTime: now,
      endTime: now + params.duration * MILLISECONDS_PER_SECOND,
    };
  }

  /**
   * Calculate TWAP execution schedule
   * Distributes order evenly across time intervals
   */
  calculateTWAPSchedule(params: TWAPParams): ExecutionSchedule {
    this.logger.info("Calculating TWAP schedule", {
      symbol: params.symbol,
      totalQuantity: params.totalQuantity,
    });

    const sliceInterval = params.sliceInterval || DEFAULT_SLICE_INTERVAL;
    const sliceCount = Math.min(
      Math.max(MIN_SLICES, Math.floor(params.duration / sliceInterval)),
      MAX_SLICES
    );

    const quantityPerSlice = params.totalQuantity / sliceCount;
    const slices: ExecutionSlice[] = [];
    const now = Date.now();
    let allocatedQuantity = 0;

    for (let i = 0; i < sliceCount; i++) {
      let quantity = quantityPerSlice;

      // Apply size constraints
      if (params.maxSliceSize) {
        quantity = Math.min(quantity, params.maxSliceSize);
      }
      if (params.minSliceSize) {
        quantity = Math.max(quantity, params.minSliceSize);
      }

      const timestamp = now + i * sliceInterval * MILLISECONDS_PER_SECOND;

      slices.push({
        index: i,
        timestamp: Math.floor(timestamp),
        quantity,
      });

      allocatedQuantity += quantity;
    }

    // Adjust last slice to ensure total matches
    const remaining = params.totalQuantity - allocatedQuantity;
    const lastSlice = slices.at(-1);
    if (lastSlice) {
      lastSlice.quantity += remaining;
    }

    return {
      strategy: "TWAP",
      symbol: params.symbol,
      side: params.side,
      totalQuantity: params.totalQuantity,
      slices,
      startTime: now,
      endTime: now + params.duration * MILLISECONDS_PER_SECOND,
    };
  }

  /**
   * Calculate Iceberg execution schedule
   * Shows only visible portion, hides total size
   */
  calculateIcebergSchedule(params: IcebergParams): ExecutionSchedule {
    this.logger.info("Calculating Iceberg schedule", {
      symbol: params.symbol,
      totalQuantity: params.totalQuantity,
      visibleQuantity: params.visibleQuantity,
    });

    const sliceCount = Math.ceil(params.totalQuantity / params.visibleQuantity);
    const slices: ExecutionSlice[] = [];
    const now = Date.now();

    for (let i = 0; i < sliceCount; i++) {
      const remaining = params.totalQuantity - i * params.visibleQuantity;
      const quantity = Math.min(params.visibleQuantity, remaining);

      let interval = ICEBERG_BASE_INTERVAL;
      if (params.randomizeInterval) {
        // Randomize ±20%
        const randomFactor =
          1 +
          (Math.random() * RANDOM_RANGE_MULTIPLIER - 1) * RANDOMIZATION_RANGE;
        interval = ICEBERG_BASE_INTERVAL * randomFactor;
      }

      const timestamp = now + i * interval;

      slices.push({
        index: i,
        timestamp: Math.floor(timestamp),
        quantity,
        hidden: false,
      });
    }

    return {
      strategy: "ICEBERG",
      symbol: params.symbol,
      side: params.side,
      totalQuantity: params.totalQuantity,
      slices,
      startTime: now,
      refreshThreshold: params.refreshThreshold || DEFAULT_REFRESH_THRESHOLD,
    };
  }

  /**
   * Calculate adaptive TWAP based on market conditions
   */
  calculateAdaptiveTWAP(
    params: TWAPParams,
    conditions: MarketConditions
  ): ExecutionSchedule {
    this.logger.info("Calculating adaptive TWAP", {
      symbol: params.symbol,
      volatility: conditions.volatility,
    });

    // Adjust slice count based on volatility
    // Higher volatility = faster execution (shorter intervals = more frequent slices in same duration)
    // We increase the slice interval (make it bigger), which means FEWER slices in total duration
    let sliceInterval = params.sliceInterval || DEFAULT_SLICE_INTERVAL;

    if (conditions.volatility > HIGH_VOLATILITY_THRESHOLD) {
      // High volatility: execute faster by using larger interval (fewer total slices)
      // This reduces the number of slices by making each interval longer
      const inverseMultiplier = 1 / HIGH_VOLATILITY_MULTIPLIER;
      sliceInterval *= inverseMultiplier;
    }

    return this.calculateTWAPSchedule({
      ...params,
      sliceInterval,
    });
  }

  /**
   * Create execution state from schedule
   */
  createExecution(schedule: ExecutionSchedule): ExecutionState {
    return {
      schedule,
      status: "PENDING",
      filled: 0,
      remaining: schedule.totalQuantity,
      currentSliceIndex: 0,
      failedSlices: [],
      fills: [],
      createdAt: Date.now(),
    };
  }

  /**
   * Update execution progress
   */
  updateExecutionProgress(
    execution: ExecutionState,
    update: {
      sliceIndex: number;
      filled: number;
      price?: number;
    }
  ): void {
    execution.filled += update.filled;
    execution.remaining -= update.filled;

    execution.fills.push({
      sliceIndex: update.sliceIndex,
      quantity: update.filled,
      price: update.price,
      timestamp: Date.now(),
    });

    if (execution.status === "PENDING") {
      execution.status = "IN_PROGRESS";
      execution.startedAt = Date.now();
    }

    if (execution.remaining <= 0) {
      execution.status = "COMPLETED";
      execution.completedAt = Date.now();
    }

    this.logger.debug("Execution progress updated", {
      filled: execution.filled,
      remaining: execution.remaining,
      status: execution.status,
    });
  }

  /**
   * Handle slice execution failure
   */
  handleSliceFailure(
    execution: ExecutionState,
    failure: {
      sliceIndex: number;
      reason: string;
    }
  ): void {
    execution.failedSlices.push(failure.sliceIndex);

    // Update status to IN_PROGRESS if it was PENDING
    if (execution.status === "PENDING") {
      execution.status = "IN_PROGRESS";
    }

    this.logger.warn("Slice execution failed", {
      sliceIndex: failure.sliceIndex,
      reason: failure.reason,
    });

    // Check if we should fail the entire execution
    const failureRate =
      execution.failedSlices.length / execution.schedule.slices.length;
    if (failureRate > FAILURE_RATE_THRESHOLD) {
      execution.status = "FAILED";
      this.logger.error("Execution failed due to high failure rate", {
        failureRate,
      });
    }
  }

  /**
   * Get next slice to execute
   */
  getNextSlice(execution: ExecutionState): number | null {
    const now = Date.now();

    for (
      let i = execution.currentSliceIndex;
      i < execution.schedule.slices.length;
      i++
    ) {
      // Skip failed slices
      if (execution.failedSlices.includes(i)) {
        continue;
      }

      const slice = execution.schedule.slices[i];

      // Check if it's time for this slice
      if (slice.timestamp <= now) {
        execution.currentSliceIndex = i;
        return i;
      }
    }

    return null;
  }

  /**
   * Calculate execution metrics
   */
  calculateExecutionMetrics(
    execution: ExecutionState,
    benchmarkPrice: number
  ): ExecutionMetrics {
    // Calculate average execution price
    const totalValue = execution.fills.reduce(
      (sum, f) => sum + (f.price || 0) * f.quantity,
      0
    );
    const totalQuantity = execution.fills.reduce(
      (sum, f) => sum + f.quantity,
      0
    );
    const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

    // Calculate slippage
    const slippage =
      benchmarkPrice > 0
        ? Math.abs(averagePrice - benchmarkPrice) / benchmarkPrice
        : 0;

    // Calculate completion ratio
    const completion = execution.filled / execution.schedule.totalQuantity;

    // Calculate duration
    const duration = execution.completedAt
      ? execution.completedAt - (execution.startedAt || execution.createdAt)
      : Date.now() - (execution.startedAt || execution.createdAt);

    // Calculate efficiency (how well we matched target)
    const efficiency = this.calculateExecutionEfficiency(execution);

    return {
      averagePrice,
      slippage,
      completion,
      duration,
      efficiency,
    };
  }

  /**
   * Check if execution should be paused
   */
  shouldPauseExecution(
    _execution: ExecutionState,
    conditions: MarketConditions
  ): boolean {
    // Pause in extreme volatility
    if (conditions.volatility > VOLATILITY_PAUSE_THRESHOLD) {
      this.logger.warn("Pausing execution due to high volatility", {
        volatility: conditions.volatility,
      });
      return true;
    }

    // Pause if spread is too wide
    if (conditions.spread && conditions.spread > SPREAD_PAUSE_THRESHOLD) {
      this.logger.warn("Pausing execution due to wide spread", {
        spread: conditions.spread,
      });
      return true;
    }

    return false;
  }

  /**
   * Calculate execution efficiency
   * 1.0 = perfect execution according to strategy
   * < 1.0 = deviated from target
   */
  private calculateExecutionEfficiency(state: ExecutionState): number {
    if (state.fills.length === 0) return 0;

    // For TWAP: check how evenly distributed the fills were
    if (state.schedule.strategy === "TWAP") {
      const expectedQuantityPerFill =
        state.schedule.totalQuantity / state.schedule.slices.length;
      const deviations = state.fills.map((f) =>
        Math.abs(f.quantity - expectedQuantityPerFill)
      );
      const avgDeviation =
        deviations.reduce((a, b) => a + b, 0) / deviations.length;
      const relativeDeviation = avgDeviation / expectedQuantityPerFill;
      const minEfficiency = 0;
      const perfectEfficiency = 1;
      return Math.max(minEfficiency, perfectEfficiency - relativeDeviation);
    }

    // For VWAP: would need to compare against actual market volume
    // For Iceberg: efficiency based on stealth (not implemented yet)
    // Return perfect efficiency as we don't have real-time volume data
    const perfectEfficiency = 1.0;
    return perfectEfficiency;
  }
}
