/**
 * Simple Background Job Queue
 * In-memory queue with async processing for heavy tasks
 *
 * For production at scale, consider using BullMQ with Redis
 */

import { logger } from "../logger";
import { nanoid } from "nanoid";

// Job status enum
export type JobStatus = "pending" | "processing" | "completed" | "failed";

// Job definition
export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  status: JobStatus;
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}

// Job handler function type
export type JobHandler<T = unknown, R = unknown> = (payload: T) => Promise<R>;

// Registered handlers
const handlers = new Map<string, JobHandler>();

// In-memory job storage (limited to last 1000 jobs)
const jobs = new Map<string, Job>();
const MAX_JOBS = 1000;

// Processing queue
const queue: string[] = [];
let isProcessing = false;

/**
 * Register a job handler for a specific job type
 */
export function registerJobHandler<T, R>(type: string, handler: JobHandler<T, R>): void {
  handlers.set(type, handler as JobHandler);
  logger.info(`[Jobs] Registered handler for "${type}"`);
}

/**
 * Enqueue a new job for background processing
 * Returns immediately with job ID
 */
export function enqueueJob<T>(
  type: string,
  payload: T,
  options: { maxAttempts?: number } = {}
): Job<T> {
  const job: Job<T> = {
    id: nanoid(),
    type,
    payload,
    status: "pending",
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: options.maxAttempts || 3,
  };

  // Cleanup old jobs if limit reached
  if (jobs.size >= MAX_JOBS) {
    const oldestKeys = Array.from(jobs.keys()).slice(0, 100);
    oldestKeys.forEach((key) => jobs.delete(key));
  }

  jobs.set(job.id, job as Job);
  queue.push(job.id);

  logger.info(`[Jobs] Enqueued job ${job.id} (${type})`);

  // Start processing if not already running
  processQueue();

  return job;
}

/**
 * Get job by ID
 */
export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

/**
 * Get job status
 */
export function getJobStatus(id: string): JobStatus | undefined {
  return jobs.get(id)?.status;
}

/**
 * Process jobs in the queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const jobId = queue.shift();
    if (!jobId) continue;

    const job = jobs.get(jobId);
    if (!job || job.status !== "pending") continue;

    const handler = handlers.get(job.type);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler registered for job type "${job.type}"`;
      logger.error(`[Jobs] ${job.error}`);
      continue;
    }

    job.status = "processing";
    job.startedAt = new Date();
    job.attempts++;

    try {
      logger.info(`[Jobs] Processing job ${job.id} (${job.type}), attempt ${job.attempts}`);
      job.result = await handler(job.payload);
      job.status = "completed";
      job.completedAt = new Date();
      logger.info(`[Jobs] Job ${job.id} completed successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Jobs] Job ${job.id} failed: ${errorMsg}`);

      if (job.attempts < job.maxAttempts) {
        // Re-queue for retry
        job.status = "pending";
        queue.push(job.id);
        logger.info(`[Jobs] Job ${job.id} re-queued for retry (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        job.status = "failed";
        job.error = errorMsg;
        job.completedAt = new Date();
        logger.error(`[Jobs] Job ${job.id} failed permanently after ${job.attempts} attempts`);
      }
    }
  }

  isProcessing = false;
}

/**
 * Get queue stats
 */
export function getQueueStats(): {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
} {
  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;

  jobs.forEach((job) => {
    switch (job.status) {
      case "pending":
        pending++;
        break;
      case "processing":
        processing++;
        break;
      case "completed":
        completed++;
        break;
      case "failed":
        failed++;
        break;
    }
  });

  return { pending, processing, completed, failed, total: jobs.size };
}

/**
 * Clear completed/failed jobs older than specified age
 */
export function cleanupJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  jobs.forEach((job, id) => {
    if (
      (job.status === "completed" || job.status === "failed") &&
      job.completedAt &&
      job.completedAt.getTime() < cutoff
    ) {
      jobs.delete(id);
      removed++;
    }
  });

  if (removed > 0) {
    logger.info(`[Jobs] Cleaned up ${removed} old jobs`);
  }

  return removed;
}
