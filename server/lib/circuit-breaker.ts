/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by failing fast when a service is unhealthy
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: After threshold failures, requests fail fast
 * - HALF_OPEN: After timeout, allows one test request
 */

import { logger } from "../logger";

/**
 * Extract HTTP status code from error object (type-safe)
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (error === null || typeof error !== "object") {
    return undefined;
  }
  const obj = error as Record<string, unknown>;
  // Check common status code property names
  const statusCode = obj.statusCode ?? obj.status ?? obj.code;
  if (typeof statusCode === "number") {
    return statusCode;
  }
  return undefined;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting recovery (default: 30000) */
  resetTimeout?: number;
  /** Number of successes in HALF_OPEN to close circuit (default: 2) */
  successThreshold?: number;
  /** Name for logging and metrics */
  name: string;
  /** Function to determine if error should count as failure */
  isFailure?: (error: unknown) => boolean;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    public readonly serviceName: string,
    public readonly state: CircuitState
  ) {
    super(`Circuit breaker is ${state} for service: ${serviceName}`);
    this.name = "CircuitBreakerError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly name: string;
  private readonly isFailure: (error: unknown) => boolean;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
    this.isFailure = options.isFailure ?? (() => true);
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.transitionTo("HALF_OPEN");
      } else {
        throw new CircuitBreakerError(this.name, this.state);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (this.isFailure(error)) {
        this.onFailure(error);
      }
      throw error;
    }
  }

  /**
   * Get current circuit state and metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === "OPEN" && this.shouldAttemptReset()) {
      this.transitionTo("HALF_OPEN");
    }
    return this.state;
  }

  /**
   * Check if circuit is allowing requests
   */
  isAvailable(): boolean {
    const state = this.getState();
    return state === "CLOSED" || state === "HALF_OPEN";
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo("CLOSED");
    this.failures = 0;
    this.successes = 0;
    logger.info(`[CircuitBreaker:${this.name}] Manually reset`);
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.resetTimeout;
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;

    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo("CLOSED");
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === "CLOSED") {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  private onFailure(error: unknown): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;
    this.failures++;

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[CircuitBreaker:${this.name}] Failure recorded: ${errorMsg}`, {
      failures: this.failures,
      threshold: this.failureThreshold,
      state: this.state,
    });

    if (this.state === "HALF_OPEN") {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.transitionTo("OPEN");
      this.successes = 0;
    } else if (this.state === "CLOSED" && this.failures >= this.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    logger.info(`[CircuitBreaker:${this.name}] State transition: ${oldState} -> ${newState}`, {
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
    });
  }
}

// Registry to track all circuit breakers
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Create or get a circuit breaker by name
 */
export function getCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const existing = circuitBreakers.get(options.name);
  if (existing) return existing;

  const breaker = new CircuitBreaker(options);
  circuitBreakers.set(options.name, breaker);
  return breaker;
}

/**
 * Get all circuit breaker metrics
 */
export function getAllCircuitBreakerMetrics(): Record<string, CircuitBreakerMetrics> {
  const metrics: Record<string, CircuitBreakerMetrics> = {};
  circuitBreakers.forEach((breaker, name) => {
    metrics[name] = breaker.getMetrics();
  });
  return metrics;
}

/**
 * Helper to determine if an error should be considered a failure
 * for circuit breaker purposes
 */
export function isServiceFailure(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, timeouts are failures
    if (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("fetch failed")
    ) {
      return true;
    }
    // Check for 5xx status codes in error message (e.g., "status 500", "error 503")
    if (/\b5\d{2}\b/.test(message)) {
      return true;
    }
  }
  // Check for status code on error object
  const statusCode = getErrorStatusCode(error);
  if (statusCode !== undefined) {
    if (statusCode >= 500) {
      return true;
    }
    // 429 Too Many Requests should also trigger circuit
    if (statusCode === 429) {
      return true;
    }
  }
  return false;
}

/**
 * Create a wrapper function that applies circuit breaker to any async function
 */
export function withCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions
): (...args: TArgs) => Promise<TResult> {
  const breaker = getCircuitBreaker(options);
  return (...args: TArgs) => breaker.execute(() => fn(...args));
}
