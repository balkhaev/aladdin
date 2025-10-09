import type { ClickHouseClient } from "@aladdin/clickhouse";
import type { Logger } from "@aladdin/logger";
import type { NatsClient } from "@aladdin/messaging";
import type { QueueStats, ScraperJob, ScraperJobResult } from "./types";

/**
 * ScraperQueueManager
 * Manages JetStream queues for all scrapers
 */
export class ScraperQueueManager {
  private queues: Map<
    string,
    { pending: number; active: number; completed: number; failed: number }
  >;
  private jobHandlers: Map<
    string,
    (job: ScraperJob) => Promise<ScraperJobResult>
  >;
  private processing = false;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly natsClient: NatsClient,
    private readonly clickhouse: ClickHouseClient,
    private readonly logger: Logger
  ) {
    this.queues = new Map();
    this.jobHandlers = new Map();

    // Initialize queues
    this.initializeQueue("scraper.reddit");
    this.initializeQueue("scraper.twitter");
    this.initializeQueue("scraper.news");
    this.initializeQueue("scraper.telegram");
  }

  /**
   * Initialize a queue
   */
  private initializeQueue(name: string): void {
    this.queues.set(name, {
      pending: 0,
      active: 0,
      completed: 0,
      failed: 0,
    });
    this.logger.info("Queue initialized", { queue: name });
  }

  /**
   * Register job handler for a specific queue
   */
  registerHandler(
    queueName: string,
    handler: (jobData: ScraperJob) => Promise<ScraperJobResult>
  ): void {
    this.jobHandlers.set(queueName, handler);
    this.logger.info("Handler registered", { queue: queueName });
  }

  /**
   * Add job to queue
   */
  async addJob(queueName: string, job: ScraperJob): Promise<void> {
    const stats = this.queues.get(queueName);
    if (!stats) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      // Publish job to NATS
      await this.natsClient.publish(`jobs.${queueName}`, job);

      // Update stats
      stats.pending++;

      this.logger.info("Job added to queue", {
        queue: queueName,
        jobId: job.id,
        type: job.type,
      });

      // Store job in ClickHouse
      await this.storeJob(queueName, job);
    } catch (error) {
      this.logger.error("Failed to add job to queue", {
        queue: queueName,
        jobId: job.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Start processing jobs from all queues
   */
  async startProcessing(): Promise<void> {
    if (this.processing) {
      this.logger.warn("Queue processing already started");
      return;
    }

    this.processing = true;
    this.logger.info("Starting queue processing for all queues");

    // Subscribe to all job queues
    for (const queueName of this.queues.keys()) {
      await this.subscribeToQueue(queueName);
    }

    // Start stats collection
    this.startStatsCollection();
  }

  /**
   * Stop processing jobs
   */
  stopProcessing(): void {
    this.processing = false;

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    this.logger.info("Queue processing stopped");
  }

  /**
   * Subscribe to a specific queue
   */
  private async subscribeToQueue(queueName: string): Promise<void> {
    const handler = this.jobHandlers.get(queueName);
    if (!handler) {
      this.logger.warn("No handler registered for queue", { queue: queueName });
      return;
    }

    try {
      await this.natsClient.subscribe(
        `jobs.${queueName}`,
        async (job: ScraperJob) => {
          await this.processJob(queueName, job, handler);
        }
      );

      this.logger.info("Subscribed to queue", { queue: queueName });
    } catch (error) {
      this.logger.error("Failed to subscribe to queue", {
        queue: queueName,
        error,
      });
    }
  }

  /**
   * Process a single job
   */
  private async processJob(
    queueName: string,
    job: ScraperJob,
    handler: (jobData: ScraperJob) => Promise<ScraperJobResult>
  ): Promise<void> {
    const stats = this.queues.get(queueName);
    if (!stats) return;

    const startTime = Date.now();

    try {
      // Update stats
      stats.pending = Math.max(0, stats.pending - 1);
      stats.active++;

      this.logger.info("Processing job", {
        queue: queueName,
        jobId: job.id,
        type: job.type,
        attempt: job.attempts + 1,
      });

      // Execute handler
      const result = await handler(job);

      // Update stats
      stats.active--;
      stats.completed++;

      const processingDuration = Date.now() - startTime;

      this.logger.info("Job completed", {
        queue: queueName,
        jobId: job.id,
        success: result.success,
        itemsProcessed: result.itemsProcessed,
        durationMs: processingDuration,
      });

      // Store result
      await this.storeJobResult(queueName, result);

      // Publish result event
      await this.natsClient.publish(`results.${queueName}`, result);
    } catch (error) {
      stats.active--;
      stats.failed++;

      const failureDuration = Date.now() - startTime;

      this.logger.error("Job failed", {
        queue: queueName,
        jobId: job.id,
        attempt: job.attempts + 1,
        maxAttempts: job.maxAttempts,
        durationMs: failureDuration,
        error,
      });

      // Retry if attempts remaining
      if (job.attempts < job.maxAttempts) {
        const nextAttempt = job.attempts + 1;
        const retryJob: ScraperJob = {
          ...job,
          attempts: nextAttempt,
        };

        this.logger.info("Retrying job", {
          queue: queueName,
          jobId: job.id,
          attempt: retryJob.attempts,
        });

        // Re-add to queue with delay
        setTimeout(() => {
          this.addJob(queueName, retryJob).catch((err) => {
            this.logger.error("Failed to retry job", {
              queue: queueName,
              jobId: job.id,
              error: err,
            });
          });
        }, 5000 * job.attempts); // Exponential backoff
      } else {
        // Store failed result
        const failedResult: ScraperJobResult = {
          jobId: job.id,
          success: false,
          itemsProcessed: 0,
          durationMs: failureDuration,
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        };

        await this.storeJobResult(queueName, failedResult);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(queueName: string): QueueStats | null {
    const stats = this.queues.get(queueName);
    if (!stats) return null;

    return {
      name: queueName,
      ...stats,
    };
  }

  /**
   * Get all queue statistics
   */
  getAllQueueStats(): QueueStats[] {
    return Array.from(this.queues.entries()).map(([name, stats]) => ({
      name,
      ...stats,
    }));
  }

  /**
   * Store job in ClickHouse
   */
  private async storeJob(queueName: string, job: ScraperJob): Promise<void> {
    try {
      const query = `
        INSERT INTO aladdin.scraper_jobs (
          job_id,
          queue_name,
          job_type,
          priority,
          job_data,
          attempts,
          max_attempts,
          created_at
        ) VALUES (
          '${job.id}',
          '${queueName}',
          '${job.type}',
          ${job.priority},
          '${JSON.stringify(job.data).replace(/'/g, "\\'")}',
          ${job.attempts},
          ${job.maxAttempts},
          '${job.createdAt.toISOString()}'
        )
      `;

      await this.clickhouse.execute(query);
    } catch (error) {
      this.logger.error("Failed to store job", { jobId: job.id, error });
    }
  }

  /**
   * Store job result in ClickHouse
   */
  private async storeJobResult(
    queueName: string,
    result: ScraperJobResult
  ): Promise<void> {
    try {
      const errorStr = result.error
        ? `'${result.error.replace(/'/g, "\\'")}'`
        : "NULL";

      const query = `
        INSERT INTO aladdin.scraper_job_results (
          job_id,
          queue_name,
          success,
          items_processed,
          duration_ms,
          error,
          completed_at
        ) VALUES (
          '${result.jobId}',
          '${queueName}',
          ${result.success ? 1 : 0},
          ${result.itemsProcessed},
          ${result.durationMs},
          ${errorStr},
          '${result.completedAt.toISOString()}'
        )
      `;

      await this.clickhouse.execute(query);
    } catch (error) {
      this.logger.error("Failed to store job result", {
        jobId: result.jobId,
        error,
      });
    }
  }

  /**
   * Start collecting stats periodically
   */
  private startStatsCollection(): void {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(() => {
      this.publishStats();
    }, 10_000); // Every 10 seconds
  }

  /**
   * Publish stats to NATS
   */
  private async publishStats(): Promise<void> {
    try {
      const stats = this.getAllQueueStats();
      await this.natsClient.publish("scraper.stats", stats);
    } catch (error) {
      this.logger.error("Failed to publish stats", { error });
    }
  }

  /**
   * Schedule periodic job
   */
  async schedulePeriodicJob(
    queueName: string,
    jobTemplate: Omit<ScraperJob, "id" | "createdAt" | "attempts">,
    intervalMs: number
  ): Promise<void> {
    const schedule = async () => {
      const job: ScraperJob = {
        ...jobTemplate,
        id: `${jobTemplate.type}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date(),
        attempts: 0,
      };

      await this.addJob(queueName, job);
    };

    // Schedule immediately
    await schedule();

    // Schedule periodically
    setInterval(() => {
      schedule().catch((error) => {
        this.logger.error("Failed to schedule periodic job", {
          queue: queueName,
          type: jobTemplate.type,
          error,
        });
      });
    }, intervalMs);

    this.logger.info("Periodic job scheduled", {
      queue: queueName,
      type: jobTemplate.type,
      intervalMs,
    });
  }
}
