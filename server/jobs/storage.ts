/**
 * Job Storage Module
 * Handles Redis/in-memory storage operations for jobs
 */

import { logger } from "../logger";
import { redis } from "../redis";
import {
  Job,
  StoredJob,
  MAX_JOBS,
  REDIS_QUEUE_KEY,
  REDIS_PROCESSING_KEY,
  REDIS_INDEX_KEY,
  REDIS_JOB_PREFIX,
  PROCESSING_STALE_MS,
  STALE_SWEEP_INTERVAL_MS,
} from "./types";

// In-memory job storage (fallback when Redis is not available)
const jobs = new Map<string, Job>();

// Last stale sweep timestamp
let lastStaleSweepAt = 0;

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

/**
 * Save a job to storage
 */
export async function saveJob(job: Job): Promise<void> {
  if (!redis) {
    jobs.set(job.id, job);
    return;
  }

  await redis.set(jobKey(job.id), JSON.stringify(serializeJob(job)));
  await redis.sadd(REDIS_INDEX_KEY, job.id);
}

/**
 * Load a job from storage
 */
export async function loadJob<T = unknown>(id: string): Promise<Job<T> | undefined> {
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

/**
 * Remove a job from storage
 */
export async function removeJob(id: string): Promise<void> {
  if (!redis) {
    jobs.delete(id);
    return;
  }

  await redis.del(jobKey(id));
  await redis.srem(REDIS_INDEX_KEY, id);
  await redis.lrem(REDIS_QUEUE_KEY, 0, id);
  await redis.lrem(REDIS_PROCESSING_KEY, 0, id);
}

/**
 * Trim Redis jobs to keep under MAX_JOBS limit
 */
export async function trimRedisJobs(): Promise<void> {
  if (!redis) return;

  const ids = await redis.smembers<string[]>(REDIS_INDEX_KEY);
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

/**
 * Re-queue stale processing jobs
 */
export async function requeueStaleProcessingJobs(): Promise<void> {
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

/**
 * Dequeue a job ID from the queue
 */
export async function dequeueJobId(): Promise<string | null> {
  if (!redis) {
    // In-memory queue is managed by the queue module
    return null;
  }

  await requeueStaleProcessingJobs();
  return (await redis.lmove<string>(REDIS_QUEUE_KEY, REDIS_PROCESSING_KEY, "left", "right")) || null;
}

/**
 * Finalize a job (remove from processing, optionally requeue)
 */
export async function finalizeJob(jobId: string, requeue: boolean): Promise<void> {
  if (!redis) return;

  await redis.lrem(REDIS_PROCESSING_KEY, 0, jobId);
  if (requeue) {
    await redis.rpush(REDIS_QUEUE_KEY, jobId);
  }
}

/**
 * Enqueue a job ID to the queue
 */
export async function enqueueJobId(jobId: string): Promise<void> {
  if (!redis) return;
  await redis.rpush(REDIS_QUEUE_KEY, jobId);
}

/**
 * Get all job IDs from Redis
 */
export async function getAllJobIds(): Promise<string[]> {
  if (!redis) return [];
  const ids = await redis.smembers<string[]>(REDIS_INDEX_KEY);
  return ids || [];
}

/**
 * Get in-memory jobs map (for fallback mode)
 */
export function getInMemoryJobs(): Map<string, Job> {
  return jobs;
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return !!redis;
}
