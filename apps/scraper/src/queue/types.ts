export type ScraperJob = {
  id: string;
  type: "reddit" | "twitter" | "news" | "telegram";
  priority: number;
  data: Record<string, unknown>;
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
};

export type ScraperJobResult = {
  jobId: string;
  success: boolean;
  itemsProcessed: number;
  durationMs: number;
  error?: string;
  completedAt: Date;
};

export type QueueStats = {
  name: string;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  lastProcessedAt?: Date;
};
