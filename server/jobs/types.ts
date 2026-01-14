/**
 * Job Queue Types and Constants
 */

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

// Serialized job for Redis storage
export type StoredJob<T = unknown> = Omit<Job<T>, "createdAt" | "startedAt" | "completedAt"> & {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

// Job handler function type
export type JobHandler<T = unknown, R = unknown> = (payload: T) => Promise<R>;

// Queue stats
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// Queue health
export interface QueueHealth {
  healthy: boolean;
  redisAvailable: boolean;
  isProduction: boolean;
  workerRunning: boolean;
  stats: QueueStats;
}

// Constants
export const MAX_JOBS = 1000;
export const PROCESSING_STALE_MS = 15 * 60 * 1000; // 15 minutes
export const STALE_SWEEP_INTERVAL_MS = 60 * 1000; // 1 minute

// Redis keys
export const REDIS_QUEUE_KEY = "alma:jobs:queue";
export const REDIS_PROCESSING_KEY = "alma:jobs:processing";
export const REDIS_INDEX_KEY = "alma:jobs:index";
export const REDIS_JOB_PREFIX = "alma:jobs:job:";
