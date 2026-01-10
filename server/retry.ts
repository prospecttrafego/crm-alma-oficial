/**
 * Retry Utility with Exponential Backoff
 * For reliable external API calls
 */

import { logger } from "./logger";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Function to determine if error is retryable (default: all errors) */
  isRetryable?: (error: unknown) => boolean;
  /** Optional label for logging */
  label?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "label" | "isRetryable">> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number
): number {
  // Exponential backoff: initialDelay * (factor ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delay = exponentialDelay + jitter;
  // Cap at maxDelay
  return Math.min(delay, maxDelayMs);
}

/**
 * Default function to determine if an error is retryable
 * Retries on: network errors, timeouts, 5xx errors, 429 (rate limit)
 */
function defaultIsRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors
    if (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("timeout")
    ) {
      return true;
    }
    // Check for HTTP status codes in error message
    if (message.includes("5") && message.includes("error")) {
      return true;
    }
  }
  return true; // Default to retryable for unknown errors
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, label: 'FetchData' }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_OPTIONS.maxRetries,
    initialDelayMs = DEFAULT_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    backoffFactor = DEFAULT_OPTIONS.backoffFactor,
    isRetryable = defaultIsRetryable,
    label = "Operation",
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !isRetryable(error)) {
        logger.error(`${label} failed after ${attempt + 1} attempts`, {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }

      // Calculate delay for next retry
      const delay = calculateDelay(attempt, initialDelayMs, maxDelayMs, backoffFactor);

      logger.warn(`${label} failed, retrying in ${Math.round(delay)}ms`, {
        attempt: attempt + 1,
        maxRetries: maxRetries + 1,
        delayMs: Math.round(delay),
        error: error instanceof Error ? error.message : String(error),
      });

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Create a retryable version of a function with preset options
 *
 * @example
 * const retryableFetch = createRetryable(
 *   (url: string) => fetch(url),
 *   { maxRetries: 3, label: 'API Call' }
 * );
 * const result = await retryableFetch('https://api.example.com');
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}
