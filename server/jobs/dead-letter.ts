/**
 * Dead Letter Queue Handler
 * Manages jobs that have permanently failed after max retries
 */

import { db } from "../db";
import { deadLetterJobs } from "@shared/schema";
import { eq, isNull, isNotNull, desc, and, lt, sql } from "drizzle-orm";
import { logger } from "../logger";
import type { Job } from "./queue";
import { enqueueJob } from "./queue";

/**
 * Move a failed job to the dead letter queue
 */
export async function moveToDeadLetter(job: Job, errorMessage: string): Promise<void> {
  try {
    await db.insert(deadLetterJobs).values({
      originalJobId: job.id,
      type: job.type,
      payload: job.payload,
      error: errorMessage,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      firstFailedAt: job.startedAt || new Date(),
      lastFailedAt: new Date(),
    });

    logger.warn(`[DLQ] Job ${job.id} moved to dead letter queue`, {
      jobId: job.id,
      type: job.type,
      attempts: job.attempts,
      error: errorMessage,
    });
  } catch (error) {
    logger.error("[DLQ] Failed to move job to dead letter queue", {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get dead letter jobs (with pagination)
 */
export async function getDeadLetterJobs(options: {
  limit?: number;
  offset?: number;
  resolved?: boolean;
} = {}): Promise<{
  jobs: Array<{
    id: number;
    originalJobId: string;
    type: string;
    payload: unknown;
    error: string | null;
    attempts: number;
    maxAttempts: number;
    firstFailedAt: Date | null;
    lastFailedAt: Date | null;
    retriedAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date | null;
  }>;
  total: number;
}> {
  const { limit = 50, offset = 0, resolved = false } = options;

  const whereCondition = resolved
    ? undefined
    : isNull(deadLetterJobs.resolvedAt);

  const jobsList = await db
    .select()
    .from(deadLetterJobs)
    .where(whereCondition)
    .orderBy(desc(deadLetterJobs.lastFailedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deadLetterJobs)
    .where(whereCondition);

  return {
    jobs: jobsList,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get a single dead letter job by ID
 */
export async function getDeadLetterJob(id: number) {
  const [job] = await db
    .select()
    .from(deadLetterJobs)
    .where(eq(deadLetterJobs.id, id))
    .limit(1);

  return job || null;
}

/**
 * Retry a dead letter job
 * Creates a new job with the same payload and marks the DLQ entry as retried
 */
export async function retryDeadLetterJob(id: number): Promise<{
  success: boolean;
  newJobId?: string;
  error?: string;
}> {
  const dlqJob = await getDeadLetterJob(id);
  if (!dlqJob) {
    return { success: false, error: "Dead letter job not found" };
  }

  if (dlqJob.resolvedAt) {
    return { success: false, error: "Dead letter job already resolved" };
  }

  try {
    // Create new job from DLQ entry
    const newJob = await enqueueJob(dlqJob.type, dlqJob.payload, {
      maxAttempts: 3, // Reset attempts
    });

    // Mark DLQ entry as retried
    await db
      .update(deadLetterJobs)
      .set({ retriedAt: new Date() })
      .where(eq(deadLetterJobs.id, id));

    logger.info(`[DLQ] Job ${dlqJob.originalJobId} retried as ${newJob.id}`, {
      dlqId: id,
      newJobId: newJob.id,
      type: dlqJob.type,
    });

    return { success: true, newJobId: newJob.id };
  } catch (error) {
    logger.error("[DLQ] Failed to retry dead letter job", {
      dlqId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Mark a dead letter job as resolved (manually handled)
 */
export async function resolveDeadLetterJob(id: number): Promise<boolean> {
  const result = await db
    .update(deadLetterJobs)
    .set({ resolvedAt: new Date() })
    .where(eq(deadLetterJobs.id, id));

  const resolved = (result.rowCount ?? 0) > 0;
  if (resolved) {
    logger.info(`[DLQ] Job ${id} marked as resolved`);
  }

  return resolved;
}

/**
 * Get DLQ statistics
 */
export async function getDeadLetterStats(): Promise<{
  total: number;
  unresolved: number;
  byType: Record<string, number>;
}> {
  const allJobs = await db.select().from(deadLetterJobs);

  let unresolved = 0;
  const byType: Record<string, number> = {};

  for (const job of allJobs) {
    if (!job.resolvedAt) {
      unresolved++;
    }
    byType[job.type] = (byType[job.type] || 0) + 1;
  }

  return {
    total: allJobs.length,
    unresolved,
    byType,
  };
}

/**
 * Cleanup old resolved DLQ entries
 */
export async function cleanupOldDeadLetterJobs(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);

  // Only delete jobs that are:
  // 1. Resolved (resolvedAt IS NOT NULL)
  // 2. Old enough (resolvedAt < cutoff)
  // Unresolved jobs should be kept until manually handled
  const result = await db
    .delete(deadLetterJobs)
    .where(
      and(
        isNotNull(deadLetterJobs.resolvedAt),
        lt(deadLetterJobs.resolvedAt, cutoff)
      )
    );

  const deleted = result.rowCount ?? 0;
  if (deleted > 0) {
    logger.info(`[DLQ] Cleaned up ${deleted} old resolved dead letter jobs`);
  }

  return deleted;
}
