/**
 * Optimization Progress Service
 * Track real-time progress of hyperparameter optimization
 */

import type { Logger } from "@aladdin/shared/logger";
import type { OptimizationTrial } from "../types";

export type OptimizationProgress = {
  optimizationId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  currentTrial: number;
  totalTrials: number;
  completedTrials: OptimizationTrial[];
  startTime: number;
  estimatedTimeRemaining?: number;
  error?: string;
};

export class OptimizationProgressService {
  private progressMap = new Map<string, OptimizationProgress>();

  constructor(private readonly logger: Logger) {}

  /**
   * Start tracking optimization
   */
  startOptimization(
    optimizationId: string,
    totalTrials: number
  ): void {
    this.progressMap.set(optimizationId, {
      optimizationId,
      status: "RUNNING",
      currentTrial: 0,
      totalTrials,
      completedTrials: [],
      startTime: Date.now(),
    });

    this.logger.info(
      `Started tracking optimization ${optimizationId} (${totalTrials} trials)`
    );
  }

  /**
   * Update progress with completed trial
   */
  updateProgress(optimizationId: string, trial: OptimizationTrial): void {
    const progress = this.progressMap.get(optimizationId);
    if (!progress) {
      this.logger.warn(`Optimization ${optimizationId} not found in progress map`);
      return;
    }

    progress.currentTrial = progress.completedTrials.length + 1;
    progress.completedTrials.push(trial);

    // Estimate time remaining
    const elapsedTime = Date.now() - progress.startTime;
    const avgTimePerTrial = elapsedTime / progress.currentTrial;
    const remainingTrials = progress.totalTrials - progress.currentTrial;
    progress.estimatedTimeRemaining = avgTimePerTrial * remainingTrials;

    this.logger.debug(
      `Optimization ${optimizationId}: ${progress.currentTrial}/${progress.totalTrials} trials completed`
    );
  }

  /**
   * Mark optimization as completed
   */
  completeOptimization(optimizationId: string): void {
    const progress = this.progressMap.get(optimizationId);
    if (!progress) {
      return;
    }

    progress.status = "COMPLETED";
    progress.estimatedTimeRemaining = 0;

    this.logger.info(`Optimization ${optimizationId} completed`);

    // Clean up after 1 hour
    setTimeout(() => {
      this.progressMap.delete(optimizationId);
      this.logger.debug(`Cleaned up optimization ${optimizationId} from progress map`);
    }, 60 * 60 * 1000);
  }

  /**
   * Mark optimization as failed
   */
  failOptimization(optimizationId: string, error: string): void {
    const progress = this.progressMap.get(optimizationId);
    if (!progress) {
      return;
    }

    progress.status = "FAILED";
    progress.error = error;
    progress.estimatedTimeRemaining = 0;

    this.logger.error(`Optimization ${optimizationId} failed: ${error}`);

    // Clean up after 1 hour
    setTimeout(() => {
      this.progressMap.delete(optimizationId);
    }, 60 * 60 * 1000);
  }

  /**
   * Get optimization progress
   */
  getProgress(optimizationId: string): OptimizationProgress | undefined {
    return this.progressMap.get(optimizationId);
  }

  /**
   * Check if optimization is running
   */
  isRunning(optimizationId: string): boolean {
    const progress = this.progressMap.get(optimizationId);
    return progress?.status === "RUNNING";
  }

  /**
   * Get all active optimizations
   */
  getActiveOptimizations(): OptimizationProgress[] {
    return Array.from(this.progressMap.values()).filter(
      (p) => p.status === "RUNNING"
    );
  }

  /**
   * Clean up old completed/failed optimizations
   */
  cleanup(): void {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    for (const [id, progress] of this.progressMap.entries()) {
      if (
        progress.status !== "RUNNING" &&
        now - progress.startTime > ONE_HOUR
      ) {
        this.progressMap.delete(id);
        this.logger.debug(`Cleaned up optimization ${id}`);
      }
    }
  }
}

