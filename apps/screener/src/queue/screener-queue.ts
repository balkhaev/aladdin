import type { Logger } from "@aladdin/shared/logger";
import { Queue, QueueEvents, Worker } from "bullmq";
import Redis from "ioredis";
import { BinanceAPI } from "../services/binance-api";
import { TechnicalAnalysisService } from "../services/technical-analysis";
import type { ScreenerJob, TechnicalAnalysisResult } from "../types";

const CONCURRENT_JOBS = 10;
const MIN_CANDLES = 200;
const JOB_RETRY_ATTEMPTS = 3;
const JOB_RETRY_DELAY = 2000;
const COMPLETED_JOBS_KEEP = 1000;
const FAILED_JOBS_KEEP = 5000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_DURATION = 1000;
const DEFAULT_RESULTS_LIMIT = 1000;
const DEFAULT_TOP_SIGNALS_LIMIT = 20;
const MAX_RESULTS_FOR_FILTERING = 1000;

export class ScreenerQueue {
  private queue: Queue<ScreenerJob>;
  private worker: Worker<ScreenerJob, TechnicalAnalysisResult | null>;
  private queueEvents: QueueEvents;
  private binanceAPI: BinanceAPI;
  private technicalAnalysis: TechnicalAnalysisService;

  constructor(
    private logger: Logger,
    redisUrl: string
  ) {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue<ScreenerJob>("screener", {
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

    this.binanceAPI = new BinanceAPI(logger);
    this.technicalAnalysis = new TechnicalAnalysisService(logger);

    // Worker для обработки заданий
    this.worker = new Worker<ScreenerJob, TechnicalAnalysisResult | null>(
      "screener",
      async (job) => {
        const { symbol, timeframe } = job.data;

        try {
          this.logger.debug("Processing symbol", { symbol, timeframe });

          // Получаем свечи
          const candles = await this.binanceAPI.getCandles(
            symbol,
            timeframe,
            MIN_CANDLES
          );

          if (candles.length < MIN_CANDLES) {
            this.logger.warn("Not enough candles", {
              symbol,
              count: candles.length,
            });
            return null;
          }

          // Получаем 24h статистику
          const stats = await this.binanceAPI.get24hStats(symbol);

          // Анализируем
          const analysis = this.technicalAnalysis.analyze(
            symbol,
            candles,
            timeframe,
            stats
          );

          if (analysis) {
            this.logger.debug("Analysis completed", {
              symbol,
              recommendation: analysis.signals.recommendation,
              trend: analysis.signals.trend,
            });
          }

          return analysis;
        } catch (error) {
          this.logger.error("Failed to process symbol", { symbol, error });
          throw error;
        }
      },
      {
        connection,
        concurrency: CONCURRENT_JOBS,
        limiter: {
          max: RATE_LIMIT_MAX,
          duration: RATE_LIMIT_DURATION,
        },
      }
    );

    // События очереди
    this.queueEvents = new QueueEvents("screener", { connection });

    this.setupEventListeners();
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventListeners(): void {
    this.worker.on("completed", (job) => {
      this.logger.debug("Job completed", {
        jobId: job.id,
        symbol: job.data.symbol,
      });
    });

    this.worker.on("failed", (job, error) => {
      this.logger.error("Job failed", {
        jobId: job?.id,
        symbol: job?.data.symbol,
        error,
      });
    });

    this.worker.on("error", (error) => {
      this.logger.error("Worker error", error);
    });

    this.queueEvents.on("completed", ({ jobId }) => {
      this.logger.debug("Job event: completed", { jobId });
    });
  }

  /**
   * Запустить полный скрининг всех символов
   */
  async runFullScreening(
    timeframe = "15m"
  ): Promise<{ runId: string; jobCount: number }> {
    try {
      const runId = `run-${Date.now()}`;
      this.logger.info("Starting full screening", { runId, timeframe });

      // Получаем все символы
      const symbols = await this.binanceAPI.getAllSymbols();
      this.logger.info("Fetched symbols for screening", {
        count: symbols.length,
      });

      // Создаем задания для каждого символа
      const jobs = symbols.map((s) => ({
        name: `screen-${s.symbol}`,
        data: {
          symbol: s.symbol,
          timeframe,
        },
        opts: {
          jobId: `${runId}-${s.symbol}`,
        },
      }));

      // Добавляем все задания в очередь
      await this.queue.addBulk(jobs);

      this.logger.info("Added jobs to queue", {
        runId,
        jobCount: jobs.length,
      });

      return { runId, jobCount: jobs.length };
    } catch (error) {
      this.logger.error("Failed to run full screening", error);
      throw error;
    }
  }

  /**
   * Получить результаты скрининга
   */
  async getResults(
    limit = DEFAULT_RESULTS_LIMIT
  ): Promise<TechnicalAnalysisResult[]> {
    try {
      const jobs = await this.queue.getCompleted(0, limit - 1);
      const results: TechnicalAnalysisResult[] = [];

      for (const job of jobs) {
        const result = await job.returnvalue;
        if (result) {
          results.push(result);
        }
      }

      // Сортируем по силе сигнала
      return results.sort((a, b) => b.signals.strength - a.signals.strength);
    } catch (error) {
      this.logger.error("Failed to get results", error);
      throw error;
    }
  }

  /**
   * Получить топ результатов по рекомендациям
   */
  async getTopSignals(
    recommendation: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL",
    limit = DEFAULT_TOP_SIGNALS_LIMIT
  ): Promise<TechnicalAnalysisResult[]> {
    try {
      const allResults = await this.getResults(MAX_RESULTS_FOR_FILTERING);
      return allResults
        .filter((r) => r.signals.recommendation === recommendation)
        .slice(0, limit);
    } catch (error) {
      this.logger.error("Failed to get top signals", error);
      throw error;
    }
  }

  /**
   * Получить статистику очереди
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
    };
  }

  /**
   * Очистить очередь
   */
  async clear(): Promise<void> {
    await this.queue.drain();
    await this.queue.clean(0, 0);
    this.logger.info("Queue cleared");
  }

  /**
   * Остановить воркер и закрыть очередь
   */
  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();
    this.logger.info("Screener queue closed");
  }
}
