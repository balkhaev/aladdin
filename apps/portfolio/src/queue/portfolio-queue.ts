import type { Logger } from "@aladdin/logger";
import { Queue, QueueEvents, Worker } from "bullmq";
import Redis from "ioredis";
import type { PortfolioService } from "../services/portfolio";
import type { PriceUpdateJob, PriceUpdateResult } from "./types";

const JOB_RETRY_ATTEMPTS = 3;
const JOB_RETRY_DELAY = 5000; // 5 seconds
const COMPLETED_JOBS_KEEP = 100;
const FAILED_JOBS_KEEP = 500;

/**
 * Portfolio Queue - асинхронное обновление цен портфелей
 */
export class PortfolioQueue {
  private queue: Queue<PriceUpdateJob>;
  private worker: Worker<PriceUpdateJob, PriceUpdateResult>;
  private queueEvents: QueueEvents;

  constructor(
    private logger: Logger,
    private portfolioService: PortfolioService,
    redisUrl: string
  ) {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    // Создаем очередь для обновления цен
    this.queue = new Queue<PriceUpdateJob>("portfolio-price-update", {
      connection,
      defaultJobOptions: {
        attempts: JOB_RETRY_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: JOB_RETRY_DELAY,
        },
        removeOnComplete: COMPLETED_JOBS_KEEP,
        removeOnFail: FAILED_JOBS_KEEP,
      },
    });

    // Worker для обработки заданий
    this.worker = new Worker<PriceUpdateJob, PriceUpdateResult>(
      "portfolio-price-update",
      async (job) => {
        const { portfolioId, userId } = job.data;

        try {
          this.logger.info("Processing price update job", {
            jobId: job.id,
            portfolioId,
            userId,
          });

          const updated = await this.portfolioService.updatePositionsPrices(
            portfolioId,
            userId
          );

          // Получаем общее количество позиций
          const portfolio = await this.portfolioService.getPortfolio(
            portfolioId,
            userId
          );

          const result: PriceUpdateResult = {
            portfolioId,
            updated,
            total: portfolio?.positions?.length ?? 0,
            success: true,
          };

          this.logger.info("Price update job completed", {
            jobId: job.id,
            ...result,
          });

          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this.logger.error("Price update job failed", {
            jobId: job.id,
            portfolioId,
            userId,
            error: errorMessage,
          });

          return {
            portfolioId,
            updated: 0,
            total: 0,
            success: false,
            error: errorMessage,
          };
        }
      },
      {
        connection: connection.duplicate(),
        concurrency: 5, // Обрабатываем до 5 портфелей параллельно
      }
    );

    // События очереди для мониторинга
    this.queueEvents = new QueueEvents("portfolio-price-update", {
      connection: connection.duplicate(),
    });

    this.setupEventListeners();
  }

  /**
   * Настройка слушателей событий
   */
  private setupEventListeners(): void {
    this.worker.on("completed", (job) => {
      this.logger.debug("Job completed", { jobId: job.id });
    });

    this.worker.on("failed", (job, err) => {
      this.logger.error("Job failed", {
        jobId: job?.id,
        error: err.message,
      });
    });

    this.queueEvents.on("waiting", ({ jobId }) => {
      this.logger.debug("Job waiting", { jobId });
    });

    this.queueEvents.on("active", ({ jobId }) => {
      this.logger.debug("Job active", { jobId });
    });
  }

  /**
   * Добавить задачу на обновление цен портфеля
   */
  async addPriceUpdateJob(
    portfolioId: string,
    userId: string
  ): Promise<string> {
    const job = await this.queue.add(
      "update-prices",
      { portfolioId, userId },
      {
        jobId: `portfolio-${portfolioId}-${Date.now()}`,
      }
    );

    this.logger.info("Price update job added", {
      jobId: job.id,
      portfolioId,
      userId,
    });

    return job.id ?? "";
  }

  /**
   * Получить статус задачи
   */
  async getJobStatus(jobId: string): Promise<{
    state: string;
    progress: number;
    result?: PriceUpdateResult;
    failedReason?: string;
  } | null> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    const failedReason = job.failedReason;

    return {
      state,
      progress: typeof progress === "number" ? progress : 0,
      result: job.returnvalue as PriceUpdateResult | undefined,
      failedReason,
    };
  }

  /**
   * Получить статистику очереди
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }

  /**
   * Очистить очередь
   */
  async cleanup(): Promise<void> {
    await this.worker.close();
    await this.queueEvents.close();
    await this.queue.close();
    this.logger.info("Portfolio queue closed");
  }
}
