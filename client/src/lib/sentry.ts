import * as Sentry from "@sentry/react";
import type { SafeUser } from "@shared/apiSchemas";

const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
const isEnabled = Boolean(dsn);

export function initClientSentry(): void {
  if (!isEnabled) {
    return;
  }

  const environment =
    (import.meta.env.VITE_APP_ENV as string | undefined)?.trim() ||
    import.meta.env.MODE ||
    "development";

  const release = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || undefined;

  Sentry.init({
    dsn,
    environment,
    release,
    // Keep it conservative; we can tune later.
    tracesSampleRate: 0.0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers["x-api-key"];
      }

      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((crumb) => {
          if (crumb.data && typeof crumb.data === "object" && "password" in crumb.data) {
            (crumb.data as Record<string, unknown>).password = "[REDACTED]";
          }
          return crumb;
        });
      }

      return event;
    },
    ignoreErrors: ["AbortError"],
  });
}

export function setSentryUser(user: SafeUser | null | undefined): void {
  if (!isEnabled) return;

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    // Keep PII minimal by default (email is available but omitted intentionally).
    role: user.role || undefined,
    organizationId: user.organizationId,
  });
}

export function captureClientException(
  error: unknown,
  context?: Record<string, unknown>,
): string | undefined {
  if (!isEnabled) return undefined;

  if (error instanceof Error) {
    return Sentry.captureException(error, { extra: context });
  }

  return Sentry.captureException(new Error(String(error)), { extra: context });
}

