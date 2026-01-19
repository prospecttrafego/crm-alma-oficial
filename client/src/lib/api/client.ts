/**
 * API Client - Type-safe HTTP client for backend communication
 */

import type { ApiError } from "@shared/types";
import type { ZodType } from "zod";

/**
 * Custom error class for API request failures
 * Provides structured error information from the backend
 */
export class ApiRequestError extends Error {
  constructor(
    public readonly error: ApiError,
    public readonly status: number,
  ) {
    super(error.message);
    this.name = "ApiRequestError";
  }

  get code() {
    return this.error.code;
  }

  get details() {
    return this.error.details;
  }

  isValidationError() {
    return this.code === "VALIDATION_ERROR";
  }

  isNotFound() {
    return this.code === "NOT_FOUND";
  }

  isUnauthorized() {
    return this.code === "UNAUTHORIZED";
  }

  isForbidden() {
    return this.code === "FORBIDDEN";
  }

  isConflict() {
    return this.code === "CONFLICT";
  }
}

/**
 * Type-safe API client for making HTTP requests
 */
export class ApiClient {
  private baseUrl = "";

  /**
   * Make an HTTP request to the backend
   */
  async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    data?: unknown,
    schema?: ZodType<T>,
  ): Promise<T> {
    // #region agent log (debug)
    const shouldLog =
      url.includes("/api/channel-configs/") ||
      url.startsWith("/api/pipelines") ||
      url.startsWith("/api/deals");
    const log = (payload: { runId: string; hypothesisId: string; message: string; data?: Record<string, unknown> }) => {
      if (!shouldLog) return;
      fetch("http://127.0.0.1:7242/ingest/4c918a94-219d-47dd-b910-955f475d04dc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: payload.runId,
          hypothesisId: payload.hypothesisId,
          location: "client/src/lib/api/client.ts:request",
          message: payload.message,
          data: payload.data,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };
    log({
      runId: "pre-fix",
      hypothesisId: url.includes("/whatsapp/connect") ? "H1" : "H3",
      message: "ApiClient request start",
      data: { method, url, hasBody: !!data },
    });
    // #endregion agent log (debug)

    const response = await fetch(this.baseUrl + url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    let json: any = null;
    if (response.status !== 204) {
      try {
        json = await response.json();
      } catch {
        json = null;
      }
    }

    // #region agent log (debug)
    log({
      runId: "pre-fix",
      hypothesisId: url.includes("/whatsapp/connect") ? "H1" : "H3",
      message: "ApiClient response received",
      data: { method, url, status: response.status, ok: response.ok },
    });
    // #endregion agent log (debug)

    if (!response.ok) {
      throw new ApiRequestError(
        json?.error || {
          code: "UNKNOWN_ERROR",
          message: json?.message || "Erro desconhecido",
        },
        response.status,
      );
    }

    const payload =
      json && typeof json === "object" && "success" in json && "data" in json
        ? (json as any).data
        : json;

    if (!schema) {
      return payload as T;
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      console.error("[ApiClient] Invalid response schema", {
        url,
        status: response.status,
        issues: parsed.error.issues,
        payload,
      });

      // #region agent log (debug)
      // Não logar payload aqui (pode conter PII). Apenas metadados e issues.
      log({
        runId: "pre-fix",
        hypothesisId: url.includes("/whatsapp/connect") ? "H1" : "H3",
        message: "ApiClient schema validation failed",
        data: {
          method,
          url,
          status: response.status,
          issuesCount: parsed.error.issues.length,
          firstIssue: parsed.error.issues[0]
            ? {
                path: parsed.error.issues[0].path.join("."),
                code: parsed.error.issues[0].code,
              }
            : null,
        },
      });
      // #endregion agent log (debug)

      throw new ApiRequestError(
        {
          code: "INVALID_RESPONSE",
          message: "Resposta inválida do servidor",
          details: parsed.error.issues as unknown,
        },
        response.status,
      );
    }

    return parsed.data;
  }

  /**
   * GET request
   */
  get<T>(url: string, schema?: ZodType<T>) {
    return this.request<T>("GET", url, undefined, schema);
  }

  /**
   * POST request
   */
  post<T>(url: string, data: unknown, schema?: ZodType<T>) {
    return this.request<T>("POST", url, data, schema);
  }

  /**
   * PATCH request
   */
  patch<T>(url: string, data: unknown, schema?: ZodType<T>) {
    return this.request<T>("PATCH", url, data, schema);
  }

  /**
   * PUT request
   */
  put<T>(url: string, data: unknown, schema?: ZodType<T>) {
    return this.request<T>("PUT", url, data, schema);
  }

  /**
   * DELETE request
   */
  delete<T>(url: string, data?: unknown, schema?: ZodType<T>) {
    return this.request<T>("DELETE", url, data, schema);
  }
}

// Singleton instance
export const api = new ApiClient();

