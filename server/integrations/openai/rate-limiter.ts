/**
 * OpenAI Rate Limiter
 * Implements rate limiting, daily quotas, and caching for OpenAI API calls
 */

import { redis } from "../../redis";
import { Ratelimit } from "@upstash/ratelimit";
import { openaiLogger } from "../../logger";
import { getErrorStatusCode } from "../../lib/circuit-breaker";

// ==================== CONFIGURATION ====================

// Rate limits (per minute)
const OPENAI_RPM_LIMIT = 20; // requests per minute
const OPENAI_RPM_WINDOW = "1 m";

// Daily limits (cost control)
const DAILY_CALL_LIMIT = parseInt(process.env.OPENAI_DAILY_LIMIT || "500", 10);
const DAILY_COUNTER_KEY = "alma:openai:daily";

// Score cache configuration
const SCORE_CACHE_PREFIX = "alma:openai:score";
const SCORE_CACHE_TTL = 3600; // 1 hour - scores don't change rapidly

// ==================== RATE LIMITER ====================

let openaiRateLimiter: Ratelimit | null = null;

if (redis) {
  openaiRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(OPENAI_RPM_LIMIT, OPENAI_RPM_WINDOW),
    analytics: true,
    prefix: "alma:ratelimit:openai",
  });
  openaiLogger.info("[OpenAI] Rate limiter initialized", { rpm: OPENAI_RPM_LIMIT });
}

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: "rate_limit" | "daily_quota" | "rate_limit_unavailable";
  retryAfter?: number;
  remaining?: number;
  dailyRemaining?: number;
}

/**
 * Check if an OpenAI API call is allowed
 * Checks both per-minute rate limit and daily quota
 */
export async function checkOpenAIRateLimit(identifier: string = "global"): Promise<RateLimitCheckResult> {
  // Without Redis, allow all calls (best effort)
  if (!redis) {
    return { allowed: true };
  }

  try {
    // Check daily quota first
    const dailyCount = await getDailyCallCount();
    if (dailyCount >= DAILY_CALL_LIMIT) {
      openaiLogger.warn("[OpenAI] Daily quota exceeded", {
        count: dailyCount,
        limit: DAILY_CALL_LIMIT,
      });
      return {
        allowed: false,
        reason: "daily_quota",
        dailyRemaining: 0,
      };
    }

    // Check rate limit
    if (openaiRateLimiter) {
      const result = await openaiRateLimiter.limit(identifier);
      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        openaiLogger.warn("[OpenAI] Rate limit hit", {
          identifier,
          remaining: result.remaining,
          retryAfter,
        });
        return {
          allowed: false,
          reason: "rate_limit",
          retryAfter,
          remaining: result.remaining,
          dailyRemaining: DAILY_CALL_LIMIT - dailyCount,
        };
      }
    }

    return {
      allowed: true,
      remaining: openaiRateLimiter ? OPENAI_RPM_LIMIT : undefined,
      dailyRemaining: DAILY_CALL_LIMIT - dailyCount,
    };
  } catch (error) {
    openaiLogger.error("[OpenAI] Rate limit check failed - failing closed for safety", {
      error: error instanceof Error ? error.message : String(error),
    });
    // On error, deny the call (fail closed) to prevent uncontrolled API costs
    return {
      allowed: false,
      reason: "rate_limit_unavailable",
      retryAfter: 60,
    };
  }
}

/**
 * Record an OpenAI API call (increment daily counter)
 */
export async function recordOpenAICall(): Promise<void> {
  if (!redis) return;

  try {
    const key = getDailyKey();
    const count = await redis.incr(key);

    // Set expiry on first call of the day
    if (count === 1) {
      // Expire at midnight UTC
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const ttl = Math.ceil((midnight.getTime() - now.getTime()) / 1000);
      await redis.expire(key, ttl);
    }
  } catch (error) {
    openaiLogger.error("[OpenAI] Failed to record API call", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get current daily call count
 */
export async function getDailyCallCount(): Promise<number> {
  if (!redis) return 0;

  try {
    const count = await redis.get<number>(getDailyKey());
    return count || 0;
  } catch (error) {
    openaiLogger.error("[OpenAI] Failed to get daily count", {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

function getDailyKey(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `${DAILY_COUNTER_KEY}:${date}`;
}

// ==================== SCORE CACHE ====================

export interface CachedScore {
  score: number;
  factors: {
    engagement: number;
    dealValue: number;
    activityLevel: number;
    recency: number;
    completeness: number;
  };
  recommendation: string;
  nextBestAction: string;
  cachedAt: number;
}

/**
 * Generate cache key for a scoring request
 */
function getScoreCacheKey(entityType: "contact" | "deal", entityId: number): string {
  return `${SCORE_CACHE_PREFIX}:${entityType}:${entityId}`;
}

/**
 * Get cached score for an entity
 */
export async function getCachedScore(
  entityType: "contact" | "deal",
  entityId: number
): Promise<CachedScore | null> {
  if (!redis) return null;

  try {
    const key = getScoreCacheKey(entityType, entityId);
    const cached = await redis.get<CachedScore>(key);

    if (cached) {
      openaiLogger.info("[OpenAI] Cache hit for score", {
        entityType,
        entityId,
        cacheAge: Math.round((Date.now() - cached.cachedAt) / 1000),
      });
    }

    return cached;
  } catch (error) {
    openaiLogger.error("[OpenAI] Failed to get cached score", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Cache a score result
 */
export async function cacheScore(
  entityType: "contact" | "deal",
  entityId: number,
  score: CachedScore
): Promise<void> {
  if (!redis) return;

  try {
    const key = getScoreCacheKey(entityType, entityId);
    await redis.setex(key, SCORE_CACHE_TTL, {
      ...score,
      cachedAt: Date.now(),
    });
    openaiLogger.info("[OpenAI] Score cached", { entityType, entityId });
  } catch (error) {
    openaiLogger.error("[OpenAI] Failed to cache score", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Invalidate cached score (call when entity data changes)
 */
export async function invalidateScoreCache(
  entityType: "contact" | "deal",
  entityId: number
): Promise<void> {
  if (!redis) return;

  try {
    const key = getScoreCacheKey(entityType, entityId);
    await redis.del(key);
    openaiLogger.info("[OpenAI] Score cache invalidated", { entityType, entityId });
  } catch (error) {
    openaiLogger.error("[OpenAI] Failed to invalidate score cache", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ==================== STATS ====================

export interface OpenAIUsageStats {
  dailyCallCount: number;
  dailyLimit: number;
  dailyRemaining: number;
  percentUsed: number;
  rateLimitRpm: number;
  redisAvailable: boolean;
}

/**
 * Get OpenAI usage statistics
 */
export async function getOpenAIUsageStats(): Promise<OpenAIUsageStats> {
  const dailyCallCount = await getDailyCallCount();
  const dailyRemaining = Math.max(0, DAILY_CALL_LIMIT - dailyCallCount);

  return {
    dailyCallCount,
    dailyLimit: DAILY_CALL_LIMIT,
    dailyRemaining,
    percentUsed: Math.round((dailyCallCount / DAILY_CALL_LIMIT) * 100),
    rateLimitRpm: OPENAI_RPM_LIMIT,
    redisAvailable: !!redis,
  };
}

// ==================== EXPONENTIAL BACKOFF ====================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

/**
 * Execute a function with exponential backoff
 * Specifically designed for 429 (rate limit) errors
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseDelay = options.baseDelayMs ?? BASE_DELAY_MS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a rate limit error (429)
      const statusCode = getErrorStatusCode(error);
      const isRateLimitError = statusCode === 429;

      if (!isRateLimitError || attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;

      openaiLogger.warn("[OpenAI] Rate limited, retrying with backoff", {
        attempt: attempt + 1,
        maxRetries,
        delayMs: Math.round(delay),
      });

      await sleep(delay);
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
