/**
 * Sentry Error Tracking Module
 * Centralizes error tracking and performance monitoring
 */

import * as Sentry from "@sentry/node";
import type { Request, Response, NextFunction } from "express";

const SENTRY_DSN = process.env.SENTRY_DSN;
const isProduction = process.env.NODE_ENV === "production";
const isEnabled = !!SENTRY_DSN;
const sentryEnvironment = process.env.APP_ENV || process.env.NODE_ENV || "development";
const sentryRelease =
  process.env.APP_VERSION || process.env.SOURCE_COMMIT || "unknown";

/**
 * Initialize Sentry
 * Call this early in server startup
 */
export function initSentry(): void {
  if (!isEnabled) {
    console.log("[Sentry] Not configured (SENTRY_DSN not set)");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: sentryEnvironment,
    release: sentryRelease,

    // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
    // We recommend adjusting this value in production
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // Capture unhandled promise rejections
    // NOTE: using a function preserves Sentry's default integrations.
    integrations: (integrations) => [
      ...integrations,
      Sentry.onUnhandledRejectionIntegration({
        mode: "warn",
      }),
    ],

    // Filter out sensitive data
    beforeSend(event, _hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["x-api-key"];
      }

      // Remove sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.data?.password) {
            crumb.data.password = "[REDACTED]";
          }
          return crumb;
        });
      }

      return event;
    },

    // Ignore certain errors
    ignoreErrors: [
      // Ignore client-side navigation errors
      "AbortError",
      // Ignore rate limit errors (expected behavior)
      "Rate limit exceeded",
    ],
  });

  console.log("[Sentry] Initialized successfully");
}

/**
 * Sentry request handler middleware (v10+)
 * In Sentry v10+, request context is automatically captured via instrumentation
 * This is a no-op placeholder for compatibility
 */
export function sentryRequestHandler(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

/**
 * Sentry error handler middleware
 * Captures errors and sends them to Sentry before passing to next error handler
 */
export function sentryErrorHandler(
  err: Error & { status?: number; statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isEnabled) {
    return next(err);
  }

  // Determine if this is a server error worth capturing
  const status = err.status || err.statusCode || 500;
  const shouldCapture = status >= 500;

  if (shouldCapture) {
    Sentry.captureException(err, {
      extra: {
        requestId: (req as { requestId?: string }).requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        userId: req.user?.id,
      },
    });
  }

  next(err);
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, unknown>): string | undefined {
  if (!isEnabled) return undefined;

  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message manually
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: Record<string, unknown>
): string | undefined {
  if (!isEnabled) return undefined;

  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error reports
 */
export function setUser(user: { id: string; email?: string; role?: string } | null): void {
  if (!isEnabled) return;
  Sentry.setUser(user);
}

/**
 * Add custom context to error reports
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (!isEnabled) return;
  Sentry.setContext(name, context);
}

/**
 * Add a breadcrumb to the current scope
 */
export function addBreadcrumb(breadcrumb: {
  category?: string;
  message: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  data?: Record<string, unknown>;
}): void {
  if (!isEnabled) return;
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Check if Sentry is enabled
 */
export function isSentryEnabled(): boolean {
  return isEnabled;
}

/**
 * Middleware to set user context from request
 */
export function sentryUserMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!isEnabled) return next();

  if (req.user) {
    setUser({
      id: req.user.id,
      email: req.user.email || undefined,
      role: req.user.role || undefined,
    });
  }

  next();
}
