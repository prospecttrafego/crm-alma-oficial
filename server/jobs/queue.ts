/**
 * Background Job Queue with Redis persistence
 * In production, Redis is REQUIRED for job persistence across restarts
 * In development, falls back to in-memory queue with a warning
 */

import { logger } from "../logger";
import { nanoid } from "nanoid";
import { moveToDeadLetter } from "./dead-letter";
import {
  Job,
  JobStatus,
  JobHandler,
  QueueStats,
  QueueHealth,
  MAX_JOBS,
} from "./types";
import {
  saveJob,
  loadJob,
  removeJob,
  trimRedisJobs,
  dequeueJobId,
  finalizeJob,
  enqueueJobId,
  getAllJobIds,
  getInMemoryJobs,
  isRedisAvailable,
} from "./storage";

// Re-export types for consumers
export type { Job, JobStatus, JobHandler, QueueStats, QueueHealth };

// Production check at startup
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !isRedisAvailable()) {
  logger.error("[Jobs] CRITICAL: Redis is not configured but required in production!");
  logger.error("[Jobs] Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables");
}
if (!isRedisAvailable()) {
  logger.warn("[Jobs] Running with in-memory queue (jobs will be lost on restart)");
}

// Registered handlers
const handlers = new Map<string, JobHandler>();

// In-memory queue (fallback when Redis is not available)
const queue: string[] = [];
let isProcessing = false;
let workerInterval: NodeJS.Timeout | null = null;

// Track load failures per job to prevent infinite requeue loops (livelock prevention)
const loadFailures = new Map<string, number>();
const MAX_LOAD_FAILURES = 5; // After this many failures, skip the job entirely

/**
 * Clear load failure tracking for a job (called when job is successfully processed or removed)
 */
function clearLoadFailure(jobId: string): void {
  loadFailures.delete(jobId);
}

/**
 * Increment load failure count and return whether we should skip this job
 */
function recordLoadFailure(jobId: string): boolean {
  const current = loadFailures.get(jobId) || 0;
  const newCount = current + 1;
  loadFailures.set(jobId, newCount);

  if (newCount >= MAX_LOAD_FAILURES) {
    loadFailures.delete(jobId); // Clean up tracking
    return true; // Should skip
  }
  return false;
}

/**
 * Start the job worker
 */
export function startJobWorker(intervalMs: number = 2000): void {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    void processQueue();
  }, intervalMs);
  void processQueue();
}

/**
 * Stop the job worker
 */
export function stopJobWorker(): void {
  if (!workerInterval) return;
  clearInterval(workerInterval);
  workerInterval = null;
}

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
export async function enqueueJob<T>(
  type: string,
  payload: T,
  options: { maxAttempts?: number } = {}
): Promise<Job<T>> {
  const job: Job<T> = {
    id: nanoid(),
    type,
    payload,
    status: "pending",
    createdAt: new Date(),
    attempts: 0,
    maxAttempts: options.maxAttempts || 3,
  };

  if (!isRedisAvailable()) {
    const jobs = getInMemoryJobs();
    if (jobs.size >= MAX_JOBS) {
      const oldestKeys = Array.from(jobs.keys()).slice(0, 100);
      oldestKeys.forEach((key) => jobs.delete(key));
    }

    jobs.set(job.id, job as Job);
    queue.push(job.id);
  } else {
    await saveJob(job);
    await enqueueJobId(job.id);
    await trimRedisJobs();
  }

  logger.info(`[Jobs] Enqueued job ${job.id} (${type})`);

  // Start processing if not already running
  void processQueue();

  return job;
}

/**
 * Get job by ID
 */
export async function getJob(id: string): Promise<Job | undefined> {
  return loadJob(id);
}

/**
 * Get job status
 */
export async function getJobStatus(id: string): Promise<JobStatus | undefined> {
  const job = await getJob(id);
  return job?.status;
}

/**
 * Dequeue a job ID from the queue
 */
async function dequeue(): Promise<string | null> {
  if (!isRedisAvailable()) {
    return queue.shift() || null;
  }
  return dequeueJobId();
}

/**
 * Process jobs in the queue
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      let jobId: string | null = null;
      try {
        jobId = await dequeue();
      } catch (error) {
        logger.error("[Jobs] Failed to dequeue job", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!jobId) break;

      let job: Job | undefined;
      let loadAttempts = 0;
      const maxLoadAttempts = 3;

      while (loadAttempts < maxLoadAttempts) {
        try {
          job = await loadJob(jobId);
          break; // Successfully loaded
        } catch (error) {
          loadAttempts++;
          logger.error("[Jobs] Failed to load job", {
            jobId,
            attempt: loadAttempts,
            maxAttempts: maxLoadAttempts,
            error: error instanceof Error ? error.message : String(error),
          });

          if (loadAttempts < maxLoadAttempts) {
            // Wait before retry (exponential backoff: 100ms, 200ms, 400ms...)
            await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, loadAttempts - 1)));
          }
        }
      }

      // If job couldn't be loaded after retries, track the failure
      if (!job) {
        const shouldSkip = recordLoadFailure(jobId);
        if (shouldSkip) {
          logger.error(`[Jobs] Job ${jobId} could not be loaded after ${MAX_LOAD_FAILURES} total attempts, skipping permanently`);
          await finalizeJob(jobId, false); // Remove from queue permanently
        } else {
          logger.warn(`[Jobs] Job ${jobId} could not be loaded after ${maxLoadAttempts} attempts, requeuing for later`);
          await finalizeJob(jobId, true); // Requeue for later attempt
        }
        continue;
      }

      // Job loaded successfully, clear any load failure tracking
      clearLoadFailure(jobId);

      if (job.status !== "pending") {
        await finalizeJob(jobId, false);
        continue;
      }

      const handler = handlers.get(job.type);
      if (!handler) {
        job.status = "failed";
        job.error = `No handler registered for job type "${job.type}"`;
        await saveJob(job);
        await finalizeJob(jobId, false);
        logger.error(`[Jobs] ${job.error}`);
        continue;
      }

      job.status = "processing";
      job.startedAt = new Date();
      job.attempts++;
      await saveJob(job);

      try {
        logger.info(`[Jobs] Processing job ${job.id} (${job.type}), attempt ${job.attempts}`);
        job.result = await handler(job.payload);
        job.status = "completed";
        job.completedAt = new Date();
        await saveJob(job);
        await finalizeJob(jobId, false);
        logger.info(`[Jobs] Job ${job.id} completed successfully`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[Jobs] Job ${job.id} failed: ${errorMsg}`);

        if (job.attempts < job.maxAttempts) {
          job.status = "pending";
          await saveJob(job);
          await finalizeJob(jobId, true);
          logger.info(
            `[Jobs] Job ${job.id} re-queued for retry (attempt ${job.attempts}/${job.maxAttempts})`
          );
        } else {
          job.status = "failed";
          job.error = errorMsg;
          job.completedAt = new Date();
          await saveJob(job);
          await finalizeJob(jobId, false);

          // Move to dead letter queue for analysis and potential retry
          await moveToDeadLetter(job, errorMsg);

          logger.error(
            `[Jobs] Job ${job.id} failed permanently after ${job.attempts} attempts (moved to DLQ)`
          );
        }
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<QueueStats> {
  if (!isRedisAvailable()) {
    const jobs = getInMemoryJobs();
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

  const ids = await getAllJobIds();
  if (ids.length === 0) {
    return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };
  }

  let pending = 0;
  let processing = 0;
  let completed = 0;
  let failed = 0;

  const loaded = await Promise.all(ids.map((id) => loadJob(id)));
  for (const job of loaded) {
    if (!job) continue;
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
  }

  return { pending, processing, completed, failed, total: ids.length };
}

/**
 * Clear completed/failed jobs older than specified age
 */
export async function cleanupJobs(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  if (!isRedisAvailable()) {
    const jobs = getInMemoryJobs();
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

  const ids = await getAllJobIds();
  if (ids.length === 0) return 0;

  for (const id of ids) {
    const job = await loadJob(id);
    if (!job) {
      await removeJob(id);
      removed++;
      continue;
    }

    if (
      (job.status === "completed" || job.status === "failed") &&
      job.completedAt &&
      job.completedAt.getTime() < cutoff
    ) {
      await removeJob(id);
      removed++;
    }
  }

  if (removed > 0) {
    logger.info(`[Jobs] Cleaned up ${removed} old jobs`);
  }

  return removed;
}

/**
 * Check if Redis is available for job persistence
 */
export { isRedisAvailable };

/**
 * Health check for job queue
 */
export async function getJobQueueHealth(): Promise<QueueHealth> {
  const stats = await getQueueStats();
  const redisAvailable = isRedisAvailable();
  const workerRunning = !!workerInterval;

  // In production, we require Redis
  const healthy = isProduction
    ? redisAvailable && workerRunning
    : workerRunning;

  return {
    healthy,
    redisAvailable,
    isProduction,
    workerRunning,
    stats,
  };
}
