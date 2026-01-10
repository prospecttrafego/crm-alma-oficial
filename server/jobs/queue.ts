/**
 * Simple Background Job Queue
 * In-memory queue with optional Redis-backed persistence
 *
 * For production at scale, consider using BullMQ with Redis
 */

import { logger } from "../logger";
import { nanoid } from "nanoid";
import { redis } from "../redis";

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

type StoredJob<T = unknown> = Omit<Job<T>, "createdAt" | "startedAt" | "completedAt"> & {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

// Job handler function type
export type JobHandler<T = unknown, R = unknown> = (payload: T) => Promise<R>;

// Registered handlers
const handlers = new Map<string, JobHandler>();

// In-memory job storage (limited to last 1000 jobs)
const jobs = new Map<string, Job>();
const MAX_JOBS = 1000;

// Processing queue (in-memory fallback)
const queue: string[] = [];
let isProcessing = false;
let lastStaleSweepAt = 0;
let workerInterval: NodeJS.Timeout | null = null;

const PROCESSING_STALE_MS = 15 * 60 * 1000;
const STALE_SWEEP_INTERVAL_MS = 60 * 1000;

const REDIS_QUEUE_KEY = "alma:jobs:queue";
const REDIS_PROCESSING_KEY = "alma:jobs:processing";
const REDIS_INDEX_KEY = "alma:jobs:index";
const REDIS_JOB_PREFIX = "alma:jobs:job:";

function jobKey(id: string): string {
  return `${REDIS_JOB_PREFIX}${id}`;
}

function serializeJob<T>(job: Job<T>): StoredJob<T> {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : undefined,
    completedAt: job.completedAt ? job.completedAt.toISOString() : undefined,
  };
}

function deserializeJob<T>(payload: StoredJob<T>): Job<T> {
  return {
    ...payload,
    createdAt: new Date(payload.createdAt),
    startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
    completedAt: payload.completedAt ? new Date(payload.completedAt) : undefined,
  } as Job<T>;
}

async function saveJob(job: Job): Promise<void> {
  if (!redis) {
    jobs.set(job.id, job);
    return;
  }

  await redis.set(jobKey(job.id), JSON.stringify(serializeJob(job)));
  await redis.sadd(REDIS_INDEX_KEY, job.id);
}

async function loadJob<T = unknown>(id: string): Promise<Job<T> | undefined> {
  if (!redis) {
    return jobs.get(id) as Job<T> | undefined;
  }

  const raw = await redis.get<string>(jobKey(id));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as StoredJob<T>;
    return deserializeJob(parsed);
  } catch {
    return undefined;
  }
}

async function removeJob(id: string): Promise<void> {
  if (!redis) {
    jobs.delete(id);
    return;
  }

  await redis.del(jobKey(id));
  await redis.srem(REDIS_INDEX_KEY, id);
  await redis.lrem(REDIS_QUEUE_KEY, 0, id);
  await redis.lrem(REDIS_PROCESSING_KEY, 0, id);
}

async function trimRedisJobs(): Promise<void> {
  if (!redis) return;

  const ids = await redis.smembers<string>(REDIS_INDEX_KEY);
  if (!ids || ids.length <= MAX_JOBS) return;

  const jobsList = (
    await Promise.all(ids.map(async (id) => ({ id, job: await loadJob(id) })))
  ).filter((entry) => entry.job) as Array<{ id: string; job: Job }>;

  const completedFirst = jobsList.sort((a, b) => {
    const aCompleted = a.job.status === "completed" || a.job.status === "failed";
    const bCompleted = b.job.status === "completed" || b.job.status === "failed";
    if (aCompleted !== bCompleted) return aCompleted ? -1 : 1;
    return a.job.createdAt.getTime() - b.job.createdAt.getTime();
  });

  const toRemove = completedFirst.slice(0, Math.max(0, completedFirst.length - MAX_JOBS));
  await Promise.all(toRemove.map((entry) => removeJob(entry.id)));
}

async function requeueStaleProcessingJobs(): Promise<void> {
  if (!redis) return;

  const now = Date.now();
  if (now - lastStaleSweepAt < STALE_SWEEP_INTERVAL_MS) return;
  lastStaleSweepAt = now;

  const processingIds = await redis.lrange<string>(REDIS_PROCESSING_KEY, 0, -1);
  if (!processingIds || processingIds.length === 0) return;

  for (const jobId of processingIds) {
    const job = await loadJob(jobId);
    if (!job) {
      await redis.lrem(REDIS_PROCESSING_KEY, 0, jobId);
      continue;
    }

    if (job.status === "completed" || job.status === "failed") {
      await redis.lrem(REDIS_PROCESSING_KEY, 0, jobId);
      continue;
    }

    const referenceTime = job.startedAt ?? job.createdAt;
    const ageMs = now - referenceTime.getTime();
    if (ageMs < PROCESSING_STALE_MS) continue;

    job.status = "pending";
    job.startedAt = undefined;
    await saveJob(job);
    await redis.lrem(REDIS_PROCESSING_KEY, 0, jobId);
    await redis.rpush(REDIS_QUEUE_KEY, jobId);

    logger.warn(`[Jobs] Re-queued stale job ${jobId} after ${Math.round(ageMs / 1000)}s`);
  }
}

export function startJobWorker(intervalMs: number = 2000): void {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    void processQueue();
  }, intervalMs);
  void processQueue();
}

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

  if (!redis) {
    if (jobs.size >= MAX_JOBS) {
      const oldestKeys = Array.from(jobs.keys()).slice(0, 100);
      oldestKeys.forEach((key) => jobs.delete(key));
    }

    jobs.set(job.id, job as Job);
    queue.push(job.id);
  } else {
    await saveJob(job);
    await redis.rpush(REDIS_QUEUE_KEY, job.id);
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

async function dequeueJobId(): Promise<string | null> {
  if (!redis) {
    return queue.shift() || null;
  }

  await requeueStaleProcessingJobs();
  return (await redis.lmove<string>(REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, "left", "right")) || null;
}

async function finalizeJob(jobId: string, requeue: boolean): Promise<void> {
  if (!redis) return;

  await redis.lrem(REDIS_PROCESSING_KEY, 0, jobId);
  if (requeue) {
    await redis.rpush(REDIS_QUEUE_KEY, jobId);
  }
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
        jobId = await dequeueJobId();
      } catch (error) {
        logger.error("[Jobs] Failed to dequeue job", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!jobId) break;

      let job: Job | undefined;
      try {
        job = await loadJob(jobId);
      } catch (error) {
        logger.error("[Jobs] Failed to load job", {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (!job || job.status !== "pending") {
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
          logger.error(
            `[Jobs] Job ${job.id} failed permanently after ${job.attempts} attempts`
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
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  if (!redis) {
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

  const ids = await redis.smembers<string>(REDIS_INDEX_KEY);
  if (!ids || ids.length === 0) {
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

  if (!redis) {
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

  const ids = await redis.smembers<string>(REDIS_INDEX_KEY);
  if (!ids || ids.length === 0) return 0;

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
