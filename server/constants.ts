/**
 * Central constants file for the CRM server
 * All magic numbers and configuration values should be defined here
 */

// =============================================================================
// Authentication & Security
// =============================================================================

/** Password reset token size in bytes (32 bytes = 64 hex characters) */
export const PASSWORD_RESET_TOKEN_BYTES = 32;

/** Password reset token expiration in minutes */
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 15;

/** Maximum login attempts before rate limiting */
export const LOGIN_MAX_ATTEMPTS = 5;

/** Window for counting login attempts in milliseconds (1 minute) */
export const LOGIN_WINDOW_MS = 60 * 1000;

/** Session TTL in milliseconds (1 week) */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// =============================================================================
// Database & Connection Pool
// =============================================================================

/** Maximum database connections in pool */
export const DB_POOL_MAX = 20;

/** Minimum database connections in pool */
export const DB_POOL_MIN = 5;

/** Idle connection timeout in milliseconds */
export const DB_POOL_IDLE_TIMEOUT_MS = 30000;

/** Connection acquisition timeout in milliseconds */
export const DB_POOL_CONNECTION_TIMEOUT_MS = 2000;

/** Maximum times a connection can be reused before being closed */
export const DB_POOL_MAX_USES = 7500;

// =============================================================================
// Caching (Redis)
// =============================================================================

/** Messages cache TTL in seconds (5 minutes) */
export const MESSAGES_CACHE_TTL_SECONDS = 300;

/** Maximum number of messages to cache per conversation */
export const MAX_CACHED_MESSAGES = 20;

/** Generic cache TTL in seconds (5 minutes) */
export const DEFAULT_CACHE_TTL_SECONDS = 300;

/** User presence TTL in seconds (1 minute) */
export const PRESENCE_TTL_SECONDS = 60;

/** Rate limit for login attempts via Redis */
export const LOGIN_RATE_LIMIT_MAX = 5;

// =============================================================================
// Background Jobs
// =============================================================================

/** Maximum number of jobs to keep in queue */
export const MAX_JOBS = 1000;

/** Time after which a processing job is considered stale (15 minutes) */
export const PROCESSING_STALE_MS = 15 * 60 * 1000;

/** Interval for sweeping stale jobs (1 minute) */
export const STALE_SWEEP_INTERVAL_MS = 60 * 1000;

/** Default max age for job cleanup (24 hours) */
export const JOB_CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Dead letter queue max age (30 days) */
export const DLQ_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// =============================================================================
// API & Pagination
// =============================================================================

/** Default pagination limit */
export const DEFAULT_PAGE_LIMIT = 20;

/** Maximum pagination limit */
export const MAX_PAGE_LIMIT = 50;

/** Default conversations limit */
export const DEFAULT_CONVERSATIONS_LIMIT = 30;

// =============================================================================
// External Services
// =============================================================================

/** Signed URL expiration in seconds (15 minutes) */
export const SIGNED_URL_EXPIRY_SECONDS = 15 * 60;

/** OAuth state expiration in milliseconds (10 minutes) */
export const OAUTH_STATE_EXPIRY_MS = 10 * 60 * 1000;

/** Default calendar sync window - past (30 days) */
export const CALENDAR_SYNC_PAST_DAYS = 30;

/** Default calendar sync window - future (90 days) */
export const CALENDAR_SYNC_FUTURE_DAYS = 90;

/** OpenAI rate limit - requests per minute */
export const OPENAI_RPM_LIMIT = 20;

/** Circuit breaker failure threshold before opening */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;

// =============================================================================
// Retry Configuration
// =============================================================================

/** Initial delay for exponential backoff (1 second) */
export const RETRY_INITIAL_DELAY_MS = 1000;

/** Maximum retries for external service calls */
export const RETRY_MAX_ATTEMPTS = 3;

// =============================================================================
// File Cleanup
// =============================================================================

/** Grace period for orphan files before deletion (7 days) */
export const ORPHAN_FILE_GRACE_DAYS = 7;

/** Maximum files to sample when finding orphans */
export const ORPHAN_SAMPLE_SIZE = 1000;
